package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
)

type BlacklistHandler struct {
	DB *sql.DB
}

func NewBlacklistHandler(db *sql.DB) *BlacklistHandler {
	return &BlacklistHandler{DB: db}
}

type blacklistEntry struct {
	ID            int64             `json:"id"`
	UserID        models.NullInt    `json:"user_id"`
	Name          string            `json:"name"`
	Email         models.NullString `json:"email"`
	StudentID     models.NullString `json:"student_id"`
	Reason        string            `json:"reason"`
	CreatedBy     models.NullInt    `json:"created_by"`
	CreatedByName models.NullString `json:"created_by_name"`
	CreatedAt     string            `json:"created_at"`
	RestoredAt    models.NullString `json:"restored_at"`
}

// List returns currently-suspended entries by default; ?all=1 includes restored ones too.
func (h *BlacklistHandler) List(c *gin.Context) {
	where := "b.restored_at IS NULL"
	if c.Query("all") == "1" {
		where = "1=1"
	}
	rows, err := h.DB.Query(`SELECT b.id, b.user_id, b.name, b.email, b.student_id, b.reason, b.created_by, u.name, b.created_at, b.restored_at
		FROM blacklist_entries b LEFT JOIN users u ON u.id = b.created_by
		WHERE ` + where + ` ORDER BY b.created_at DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []blacklistEntry{}
	for rows.Next() {
		var e blacklistEntry
		if err := rows.Scan(&e.ID, &e.UserID, &e.Name, &e.Email, &e.StudentID, &e.Reason, &e.CreatedBy, &e.CreatedByName, &e.CreatedAt, &e.RestoredAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, e)
	}
	c.JSON(http.StatusOK, gin.H{"blacklist": list})
}

type userLookupResult struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Email     string `json:"email"`
	StudentID string `json:"student_id"`
}

// LookupUsers searches students by student ID or name so organizers/admins can
// pick an existing user when adding a blacklist entry, without needing the
// admin-only /api/users listing.
func (h *BlacklistHandler) LookupUsers(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusOK, gin.H{"users": []userLookupResult{}})
		return
	}
	like := "%" + q + "%"
	rows, err := h.DB.Query(
		`SELECT id, name, email, COALESCE(student_id, '') FROM users
		 WHERE role = 'student' AND (student_id LIKE ? OR name LIKE ?)
		 ORDER BY student_id LIMIT 8`,
		like, like,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []userLookupResult{}
	for rows.Next() {
		var u userLookupResult
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.StudentID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, u)
	}
	c.JSON(http.StatusOK, gin.H{"users": list})
}

type createBlacklistBody struct {
	Name      string `json:"name"`
	Email     string `json:"email"`
	StudentID string `json:"student_id"`
	Reason    string `json:"reason"`
}

func (h *BlacklistHandler) Create(c *gin.Context) {
	var b createBlacklistBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	if strings.TrimSpace(b.Name) == "" || strings.TrimSpace(b.Reason) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกชื่อและเหตุผลให้ครบ"})
		return
	}

	var userID sql.NullInt64
	if b.Email != "" {
		_ = h.DB.QueryRow(`SELECT id FROM users WHERE email = ?`, strings.ToLower(strings.TrimSpace(b.Email))).Scan(&userID)
	}

	claims, _ := middleware.CurrentUser(c)
	res, err := h.DB.Exec(
		`INSERT INTO blacklist_entries (user_id, name, email, student_id, reason, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
		userID, strings.TrimSpace(b.Name), nullIfEmpty(b.Email), nullIfEmpty(b.StudentID), strings.TrimSpace(b.Reason), claims.UserID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	id, _ := res.LastInsertId()

	activitylog.Log(h.DB, &claims.UserID, "BLACKLIST", "เพิ่มรายชื่อ Blacklist: "+b.Name)
	c.JSON(http.StatusCreated, gin.H{"id": id})
}

func (h *BlacklistHandler) Restore(c *gin.Context) {
	var name string
	if err := h.DB.QueryRow(`SELECT name FROM blacklist_entries WHERE id = ?`, c.Param("id")).Scan(&name); err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบรายการ"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	if _, err := h.DB.Exec(`UPDATE blacklist_entries SET restored_at = NOW() WHERE id = ?`, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	activitylog.Log(h.DB, &claims.UserID, "BLACKLIST", "คืนสิทธิ์: "+name)
	c.Status(http.StatusNoContent)
}
