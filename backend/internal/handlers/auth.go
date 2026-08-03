package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
)

type AuthHandler struct {
	DB              *sql.DB
	JWTSecret       string
	JWTExpiresHours int
}

func NewAuthHandler(db *sql.DB, jwtSecret string, jwtExpiresHours int) *AuthHandler {
	return &AuthHandler{DB: db, JWTSecret: jwtSecret, JWTExpiresHours: jwtExpiresHours}
}

func (h *AuthHandler) signToken(u models.User) (string, error) {
	claims := middleware.Claims{
		UserID: u.ID,
		Role:   u.Role,
		Name:   u.Name,
		Email:  u.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(h.JWTExpiresHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.JWTSecret))
}

const userPublicFields = `id, name, email, role, student_id, dept, active, created_at`

func scanUser(row interface{ Scan(dest ...any) error }) (models.User, error) {
	var u models.User
	var active int
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.StudentID, &u.Dept, &active, &u.CreatedAt)
	u.Active = active == 1
	return u, err
}

type registerBody struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	StudentID string `json:"student_id"`
	Dept      string `json:"dept"`
}

// Register always creates a 'student' account — admin/organizer accounts are
// provisioned separately (see database/schema.sql seed comment).
func (h *AuthHandler) Register(c *gin.Context) {
	var body registerBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	name := strings.TrimSpace(body.Name)
	email := strings.ToLower(strings.TrimSpace(body.Email))

	if name == "" || email == "" || body.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกชื่อ อีเมล และรหัสผ่านให้ครบ"})
		return
	}
	if !strings.HasSuffix(email, "@silpakorn.edu") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ต้องใช้อีเมล @silpakorn.edu เท่านั้น"})
		return
	}
	if len(body.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	res, err := h.DB.Exec(
		`INSERT INTO users (name, email, password_hash, role, student_id, dept) VALUES (?, ?, ?, 'student', ?, ?)`,
		name, email, string(hash), nullIfEmpty(body.StudentID), nullIfEmpty(body.Dept),
	)
	if err != nil {
		if isDuplicateErr(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "อีเมลนี้ถูกใช้งานแล้ว"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	id, _ := res.LastInsertId()

	row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE id = ?`, id)
	user, err := scanUser(row)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	token, err := h.signToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &user.ID, "CREATE", "สมัครสมาชิกใหม่: "+user.Name)
	c.JSON(http.StatusCreated, gin.H{"user": user, "token": token})
}

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var body loginBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || body.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกอีเมลและรหัสผ่าน"})
		return
	}

	var (
		u            models.User
		passwordHash string
		active       int
	)
	row := h.DB.QueryRow(
		`SELECT id, name, email, role, student_id, dept, active, created_at, password_hash FROM users WHERE email = ?`,
		email,
	)
	err := row.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.StudentID, &u.Dept, &active, &u.CreatedAt, &passwordHash)
	if err == sql.ErrNoRows || active != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	u.Active = true

	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"})
		return
	}

	token, err := h.signToken(u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &u.ID, "LOGIN", "")
	c.JSON(http.StatusOK, gin.H{"user": u, "token": token})
}

func (h *AuthHandler) Me(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE id = ?`, claims.UserID)
	user, err := scanUser(row)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบผู้ใช้งาน"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func nullIfEmpty(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func isDuplicateErr(err error) bool {
	return strings.Contains(err.Error(), "Error 1062")
}
