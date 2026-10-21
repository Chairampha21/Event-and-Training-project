package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

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
	Link      models.NullString `json:"link"`            // in-app path to open when pressed
	Items     json.RawMessage   `json:"items,omitempty"` // a summary's parts: [{label, link}]
	IsRead    bool              `json:"is_read"`
	CreatedAt string            `json:"created_at"`
}

func (h *NotificationsHandler) List(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	rows, err := h.DB.Query(
		`SELECT id, icon, tone, title, message, link, items, is_read, UNIX_TIMESTAMP(created_at) FROM notifications
		 WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`, claims.UserID,
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
		var createdUnix int64
		var items sql.NullString
		if err := rows.Scan(&n.ID, &n.Icon, &n.Tone, &n.Title, &n.Message, &n.Link, &items, &isRead, &createdUnix); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		if items.Valid {
			n.Items = json.RawMessage(items.String)
		}
		n.IsRead = isRead == 1
		// Sent as an explicit UTC instant (not the DB's zone-less string) so the
		// browser's "x นาทีที่แล้ว" is right whatever timezone the viewer is in.
		n.CreatedAt = time.Unix(createdUnix, 0).UTC().Format(time.RFC3339)
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

// MarkAllRead flips every unread notification of the caller in one call — the
// bell's "อ่านทั้งหมด" button.
func (h *NotificationsHandler) MarkAllRead(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	if _, err := h.DB.Exec(`UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0`, claims.UserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.Status(http.StatusNoContent)
}

// ClearAll deletes the caller's notifications — the bell's "ล้าง" button.
func (h *NotificationsHandler) ClearAll(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	if _, err := h.DB.Exec(`DELETE FROM notifications WHERE user_id = ?`, claims.UserID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.Status(http.StatusNoContent)
}
