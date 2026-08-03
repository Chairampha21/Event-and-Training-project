package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
)

type UsersHandler struct {
	DB *sql.DB
}

func NewUsersHandler(db *sql.DB) *UsersHandler {
	return &UsersHandler{DB: db}
}

// defaultTempPassword is assigned to accounts the admin creates directly (no
// self-registration email flow exists yet) — same convention as the seed data.
const defaultTempPassword = "Passw0rd!"

func (h *UsersHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(`SELECT ` + userPublicFields + ` FROM users ORDER BY role ASC, name ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []gin.H{}
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, gin.H{
			"id": u.ID, "name": u.Name, "email": u.Email, "role": u.Role,
			"student_id": u.StudentID, "dept": u.Dept, "active": u.Active, "created_at": u.CreatedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{"users": list})
}

type upsertUserBody struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Dept  string `json:"dept"`
}

func validRole(r string) bool {
	return r == "admin" || r == "organizer" || r == "student"
}

func (h *UsersHandler) Create(c *gin.Context) {
	var b upsertUserBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	name, email := strings.TrimSpace(b.Name), strings.ToLower(strings.TrimSpace(b.Email))
	if name == "" || email == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกชื่อและอีเมลให้ครบ"})
		return
	}
	if !strings.HasSuffix(email, "@silpakorn.edu") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ต้องใช้อีเมล @silpakorn.edu เท่านั้น"})
		return
	}
	if !validRole(b.Role) {
		b.Role = "student"
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(defaultTempPassword), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	res, err := h.DB.Exec(
		`INSERT INTO users (name, email, password_hash, role, dept) VALUES (?, ?, ?, ?, ?)`,
		name, email, string(hash), b.Role, nullIfEmpty(b.Dept),
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

	claims, _ := middleware.CurrentUser(c)
	activitylog.Log(h.DB, &claims.UserID, "CREATE", "เพิ่มผู้ใช้งาน: "+name)
	c.JSON(http.StatusCreated, gin.H{"id": id, "temp_password": defaultTempPassword})
}

func (h *UsersHandler) Update(c *gin.Context) {
	var b upsertUserBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	sets := []string{}
	args := []any{}
	if b.Name != "" {
		sets = append(sets, "name = ?")
		args = append(args, strings.TrimSpace(b.Name))
	}
	if b.Email != "" {
		sets = append(sets, "email = ?")
		args = append(args, strings.ToLower(strings.TrimSpace(b.Email)))
	}
	if b.Role != "" {
		if !validRole(b.Role) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "บทบาทไม่ถูกต้อง"})
			return
		}
		sets = append(sets, "role = ?")
		args = append(args, b.Role)
	}
	if b.Dept != "" {
		sets = append(sets, "dept = ?")
		args = append(args, b.Dept)
	}
	if len(sets) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่มีข้อมูลที่จะแก้ไข"})
		return
	}

	args = append(args, c.Param("id"))
	_, err := h.DB.Exec(`UPDATE users SET `+strings.Join(sets, ", ")+` WHERE id = ?`, args...)
	if err != nil {
		if isDuplicateErr(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "อีเมลนี้ถูกใช้งานแล้ว"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE id = ?`, c.Param("id"))
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

func (h *UsersHandler) SetActive(c *gin.Context) {
	var body struct {
		Active bool `json:"active"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	res, err := h.DB.Exec(`UPDATE users SET active = ? WHERE id = ?`, body.Active, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบผู้ใช้งาน"})
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *UsersHandler) Delete(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	if c.Param("id") == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	var name string
	if err := h.DB.QueryRow(`SELECT name FROM users WHERE id = ?`, c.Param("id")).Scan(&name); err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบผู้ใช้งาน"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	if _, err := h.DB.Exec(`DELETE FROM users WHERE id = ?`, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &claims.UserID, "DELETE", "ลบผู้ใช้งาน: "+name)
	c.Status(http.StatusNoContent)
}
