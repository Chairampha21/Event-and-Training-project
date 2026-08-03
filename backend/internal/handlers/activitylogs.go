package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/models"
)

type ActivityLogsHandler struct {
	DB *sql.DB
}

func NewActivityLogsHandler(db *sql.DB) *ActivityLogsHandler {
	return &ActivityLogsHandler{DB: db}
}

type activityLogRow struct {
	ID        int64             `json:"id"`
	UserName  models.NullString `json:"user_name"`
	Action    string            `json:"action"`
	Detail    models.NullString `json:"detail"`
	CreatedAt string            `json:"created_at"`
}

func (h *ActivityLogsHandler) List(c *gin.Context) {
	rows, err := h.DB.Query(
		`SELECT l.id, u.name, l.action, l.detail, l.created_at
		 FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
		 ORDER BY l.created_at DESC LIMIT 50`,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []activityLogRow{}
	for rows.Next() {
		var r activityLogRow
		if err := rows.Scan(&r.ID, &r.UserName, &r.Action, &r.Detail, &r.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"logs": list})
}
