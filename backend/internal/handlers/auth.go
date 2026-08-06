package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
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
	GoogleClientID  string
}

func NewAuthHandler(db *sql.DB, jwtSecret string, jwtExpiresHours int, googleClientID string) *AuthHandler {
	return &AuthHandler{DB: db, JWTSecret: jwtSecret, JWTExpiresHours: jwtExpiresHours, GoogleClientID: googleClientID}
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

type googleLoginBody struct {
	Credential string `json:"credential"`
}

// googleTokenInfo mirrors the subset of fields Google's tokeninfo endpoint
// returns for an ID token that we actually need to validate and provision
// an account from — see https://oauth2.googleapis.com/tokeninfo?id_token=...
type googleTokenInfo struct {
	Aud           string `json:"aud"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	HD            string `json:"hd"`
	Name          string `json:"name"`
	Error         string `json:"error_description"`
}

// GoogleLogin verifies a Google Identity Services ID token and either logs
// in the matching existing account or auto-provisions a new 'student'
// account for it — same @silpakorn.edu restriction as manual registration,
// enforced here (not just relied on via Google Workspace hd) since this app
// isn't necessarily running under a Workspace-restricted OAuth consent screen.
func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	if h.GoogleClientID == "" {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "ยังไม่ได้ตั้งค่า Google Sign-In บนระบบนี้"})
		return
	}
	var body googleLoginBody
	if err := c.ShouldBindJSON(&body); err != nil || body.Credential == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + body.Credential)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "ตรวจสอบบัญชี Google ไม่สำเร็จ"})
		return
	}
	defer resp.Body.Close()

	var info googleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "ตรวจสอบบัญชี Google ไม่สำเร็จ"})
		return
	}
	if resp.StatusCode != http.StatusOK || info.Error != "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "โทเคน Google ไม่ถูกต้องหรือหมดอายุ"})
		return
	}
	if info.Aud != h.GoogleClientID {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "โทเคน Google ไม่ตรงกับระบบนี้"})
		return
	}
	if info.EmailVerified != "true" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "อีเมล Google ยังไม่ได้ยืนยัน"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(info.Email))
	if !strings.HasSuffix(email, "@silpakorn.edu") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ต้องใช้บัญชี Google ของอีเมล @silpakorn.edu เท่านั้น"})
		return
	}

	row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE email = ?`, email)
	user, err := scanUser(row)
	isNew := false
	if err == sql.ErrNoRows {
		isNew = true
		randomHash, herr := bcrypt.GenerateFromPassword([]byte(randomHex(32)), bcrypt.DefaultCost)
		if herr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		name := strings.TrimSpace(info.Name)
		if name == "" {
			name = email
		}
		res, ierr := h.DB.Exec(
			`INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'student')`,
			name, email, string(randomHash),
		)
		if ierr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		id, _ := res.LastInsertId()
		row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE id = ?`, id)
		user, err = scanUser(row)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if !user.Active {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้ถูกระงับการใช้งาน"})
		return
	}
	// Google Sign-In is a student convenience path only — staff (organizer/
	// admin) keep using email + password so account access stays deliberate.
	if user.Role != "student" {
		c.JSON(http.StatusForbidden, gin.H{"error": "เข้าสู่ระบบด้วย Google ใช้ได้เฉพาะบัญชีนักศึกษา กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน"})
		return
	}

	token, err := h.signToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	if isNew {
		activitylog.Log(h.DB, &user.ID, "CREATE", "สมัครสมาชิกใหม่ผ่าน Google: "+user.Name)
	} else {
		activitylog.Log(h.DB, &user.ID, "LOGIN", "เข้าสู่ระบบด้วย Google")
	}
	c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
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

type updateMeBody struct {
	Name      string `json:"name"`
	Dept      string `json:"dept"`
	StudentID string `json:"student_id"`
}

// UpdateMe lets a logged-in user edit their own display name/dept/student ID
// — email and role are deliberately not editable here (those stay admin-only
// via the /users endpoints, to avoid self-service privilege changes).
func (h *AuthHandler) UpdateMe(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	var b updateMeBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	name := strings.TrimSpace(b.Name)
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกชื่อให้ครบ"})
		return
	}

	_, err := h.DB.Exec(
		`UPDATE users SET name = ?, dept = ?, student_id = ? WHERE id = ?`,
		name, nullIfEmpty(b.Dept), nullIfEmpty(b.StudentID), claims.UserID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE id = ?`, claims.UserID)
	user, err := scanUser(row)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &claims.UserID, "UPDATE", "แก้ไขโปรไฟล์ตนเอง")
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
