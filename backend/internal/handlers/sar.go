package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
)

type SARHandler struct {
	DB *sql.DB
}

func NewSARHandler(db *sql.DB) *SARHandler {
	return &SARHandler{DB: db}
}

// sarReport is now just the "wrap-up poster" an organizer attaches to a
// finished event — the earlier long-form fields (purpose/outcome/gaps/
// improvement) were dropped from the API in favor of a simple poster
// archive, per direct feedback that the text report wasn't what got used.
type sarReport struct {
	ID             int64             `json:"id"`
	EventID        int64             `json:"event_id"`
	ReportCode     string            `json:"report_code"`
	RecapPosterURL models.NullString `json:"recap_poster_url"`
	CreatedAt      string            `json:"created_at"`
	UpdatedAt      string            `json:"updated_at"`
}

func (h *SARHandler) checkAccess(c *gin.Context) (int64, sql.NullInt64, bool) {
	eventID := c.Param("id")
	var organizerID sql.NullInt64
	err := h.DB.QueryRow(`SELECT organizer_id FROM events WHERE id = ?`, eventID).Scan(&organizerID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบกิจกรรม"})
		return 0, organizerID, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return 0, organizerID, false
	}
	claims, _ := middleware.CurrentUser(c)
	if claims.Role != "admin" && !(organizerID.Valid && organizerID.Int64 == claims.UserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์เข้าถึง SAR ของกิจกรรมนี้"})
		return 0, organizerID, false
	}
	return claims.UserID, organizerID, true
}

func (h *SARHandler) Get(c *gin.Context) {
	if _, _, ok := h.checkAccess(c); !ok {
		return
	}
	var r sarReport
	err := h.DB.QueryRow(
		`SELECT id, event_id, report_code, recap_poster_url, created_at, updated_at
		 FROM sar_reports WHERE event_id = ?`, c.Param("id"),
	).Scan(&r.ID, &r.EventID, &r.ReportCode, &r.RecapPosterURL, &r.CreatedAt, &r.UpdatedAt)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ยังไม่มี SAR สำหรับกิจกรรมนี้"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sar": r})
}

type upsertSARBody struct {
	RecapPoster string `json:"recap_poster"`
}

// Upsert saves (or clears, if RecapPoster is empty) the wrap-up poster for
// an event's SAR record, creating the record on first upload.
func (h *SARHandler) Upsert(c *gin.Context) {
	userID, _, ok := h.checkAccess(c)
	if !ok {
		return
	}
	var b upsertSARBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	eventID := c.Param("id")
	var existingID sql.NullInt64
	_ = h.DB.QueryRow(`SELECT id FROM sar_reports WHERE event_id = ?`, eventID).Scan(&existingID)

	if existingID.Valid {
		_, err := h.DB.Exec(`UPDATE sar_reports SET recap_poster_url = ? WHERE id = ?`, nullIfEmpty(b.RecapPoster), existingID.Int64)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
	} else {
		code, err := nextSARCode(h.DB)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		_, err = h.DB.Exec(
			`INSERT INTO sar_reports (event_id, report_code, recap_poster_url, status, created_by) VALUES (?, ?, ?, 'final', ?)`,
			eventID, code, nullIfEmpty(b.RecapPoster), userID,
		)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
	}

	activitylog.Log(h.DB, &userID, "UPDATE", "บันทึกโปสเตอร์สรุปข่าว กิจกรรม #"+eventID)

	var r sarReport
	err := h.DB.QueryRow(
		`SELECT id, event_id, report_code, recap_poster_url, created_at, updated_at
		 FROM sar_reports WHERE event_id = ?`, eventID,
	).Scan(&r.ID, &r.EventID, &r.ReportCode, &r.RecapPosterURL, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"sar": r})
}

func nextSARCode(db *sql.DB) (string, error) {
	year := time.Now().Year() + 543
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM sar_reports WHERE report_code LIKE ?`, fmt.Sprintf("SAR-%d-%%", year)).Scan(&count); err != nil {
		return "", err
	}
	for seq := count + 1; ; seq++ {
		code := fmt.Sprintf("SAR-%d-%03d", year, seq)
		var exists int
		if err := db.QueryRow(`SELECT COUNT(*) FROM sar_reports WHERE report_code = ?`, code).Scan(&exists); err != nil {
			return "", err
		}
		if exists == 0 {
			return code, nil
		}
	}
}
