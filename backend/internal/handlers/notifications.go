package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
)

type NotificationsHandler struct {
	DB *sql.DB
}

func NewNotificationsHandler(db *sql.DB) *NotificationsHandler {
	return &NotificationsHandler{DB: db}
}

type notification struct {
	ID        int64             `json:"id"`
	Icon      models.NullString `json:"icon"`
	Tone      models.NullString `json:"tone"`
	Title     string            `json:"title"`
	Message   models.NullString `json:"message"`
	IsRead    bool              `json:"is_read"`
	CreatedAt string            `json:"created_at"`
}

func (h *NotificationsHandler) List(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	rows, err := h.DB.Query(
		`SELECT id, icon, tone, title, message, is_read, created_at FROM notifications
		 WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, claims.UserID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []notification{}
	for rows.Next() {
		var n notification
		var isRead int
		if err := rows.Scan(&n.ID, &n.Icon, &n.Tone, &n.Title, &n.Message, &isRead, &n.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		n.IsRead = isRead == 1
		list = append(list, n)
	}
	c.JSON(http.StatusOK, gin.H{"notifications": list})
}

func (h *NotificationsHandler) MarkRead(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	res, err := h.DB.Exec(`UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`, c.Param("id"), claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบการแจ้งเตือนนี้"})
		return
	}
	c.Status(http.StatusNoContent)
}
