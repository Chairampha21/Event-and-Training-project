package handlers

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/middleware"
)

// An event's coordinator (อาจารย์ผู้ประสานงาน) is chosen by name. When that
// name is a teacher's account (title + Thai name, as it prints), the event is
// linked to the account, so the teacher can follow the event's report.

// teacherNameSQL is a user's full Thai name the way the coordinator list
// shows it: no space after a title that ends in "." or is นาย/นาง/นางสาว.
const teacherNameSQL = `CASE
	WHEN COALESCE(title_th, '') = '' THEN name
	WHEN title_th LIKE '%.' OR title_th IN ('นาย', 'นาง', 'นางสาว', 'เด็กชาย', 'เด็กหญิง') THEN CONCAT(title_th, name)
	ELSE CONCAT(title_th, ' ', name) END`

// coordinatorFor returns the id of the active teacher whose full name is
// name (nil when there is none, e.g. a coordinator from outside).
func coordinatorFor(db *sql.DB, name *string) any {
	if name == nil || strings.TrimSpace(*name) == "" {
		return nil
	}
	n := strings.TrimSpace(*name)
	var id int64
	err := db.QueryRow(`SELECT id FROM users WHERE role = 'teacher' AND active = 1 AND (`+teacherNameSQL+` = ? OR name = ?)
		ORDER BY id LIMIT 1`, n, n).Scan(&id)
	if err != nil {
		return nil
	}
	return id
}

// coordinates reports whether the signed-in user is the event's coordinator
// (a teacher following its report, read-only).
func coordinates(c *gin.Context, coordinatorID sql.NullInt64) bool {
	claims, _ := middleware.CurrentUser(c)
	return claims.Role == "teacher" && coordinatorID.Valid && coordinatorID.Int64 == claims.UserID
}

// Coordinators lists the teacher accounts, by full name, for the event
// form's coordinator choice (organizer/admin).
func (h *UsersHandler) Coordinators(c *gin.Context) {
	rows, err := h.DB.Query(`SELECT id, ` + teacherNameSQL + ` FROM users WHERE role = 'teacher' AND active = 1 ORDER BY name`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()
	type coordinator struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
	}
	list := []coordinator{}
	for rows.Next() {
		var t coordinator
		if err := rows.Scan(&t.ID, &t.Name); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, t)
	}
	c.JSON(http.StatusOK, gin.H{"coordinators": list})
}
