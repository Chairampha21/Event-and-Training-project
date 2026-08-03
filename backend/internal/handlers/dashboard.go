package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/middleware"
)

type DashboardHandler struct {
	DB *sql.DB
}

func NewDashboardHandler(db *sql.DB) *DashboardHandler {
	return &DashboardHandler{DB: db}
}

type yearlyRow struct {
	ReportYear       int     `json:"report_year"`
	Category         string  `json:"category"`
	EventCount       int     `json:"event_count"`
	ParticipantCount int     `json:"participant_count"`
	CertificateCount int     `json:"certificate_count"`
	AvgSatisfaction  float64 `json:"avg_satisfaction"`
}

func (h *DashboardHandler) Yearly(c *gin.Context) {
	rows, err := h.DB.Query(`SELECT report_year, category, event_count, participant_count, certificate_count, avg_satisfaction FROM v_dashboard_yearly ORDER BY report_year DESC, category ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []yearlyRow{}
	for rows.Next() {
		var r yearlyRow
		var avg sql.NullFloat64
		if err := rows.Scan(&r.ReportYear, &r.Category, &r.EventCount, &r.ParticipantCount, &r.CertificateCount, &avg); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		r.AvgSatisfaction = avg.Float64
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"yearly": list})
}

type eventStatsRow struct {
	EventID         int64   `json:"event_id"`
	Title           string  `json:"title"`
	Category        string  `json:"category"`
	DateStart       string  `json:"date_start"`
	RegisteredCount int     `json:"registered_count"`
	CheckedInCount  int     `json:"checked_in_count"`
	CertifiedCount  int     `json:"certified_count"`
	AttendRatePct   float64 `json:"attend_rate_pct"`
}

func (h *DashboardHandler) EventStats(c *gin.Context) {
	var organizerID sql.NullInt64
	err := h.DB.QueryRow(`SELECT organizer_id FROM events WHERE id = ?`, c.Param("id")).Scan(&organizerID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบกิจกรรม"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	claims, _ := middleware.CurrentUser(c)
	if claims.Role != "admin" && !(organizerID.Valid && organizerID.Int64 == claims.UserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์เข้าถึงสถิติของกิจกรรมนี้"})
		return
	}

	var r eventStatsRow
	var attendRate sql.NullFloat64
	err = h.DB.QueryRow(
		`SELECT event_id, title, category, date_start, registered_count, checked_in_count, certified_count, attend_rate_pct
		 FROM v_event_stats WHERE event_id = ?`, c.Param("id"),
	).Scan(&r.EventID, &r.Title, &r.Category, &r.DateStart, &r.RegisteredCount, &r.CheckedInCount, &r.CertifiedCount, &attendRate)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลสถิติ"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	r.AttendRatePct = attendRate.Float64
	c.JSON(http.StatusOK, gin.H{"stats": r})
}
