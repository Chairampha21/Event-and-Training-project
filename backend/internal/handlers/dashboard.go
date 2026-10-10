package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
)

type DashboardHandler struct {
	DB *sql.DB
}

func NewDashboardHandler(db *sql.DB) *DashboardHandler {
	return &DashboardHandler{DB: db}
}

type yearlyRow struct {
	ReportYear       int     `json:"report_year"` // ปีงบประมาณ (พ.ศ.)
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

// fiscalYearSQL is the Thai fiscal year (ปีงบประมาณ) of a date expression, in
// the Buddhist era: the year runs 1 October – 30 September and is named after
// the year it ends in, so October 2025 – September 2026 is ปีงบประมาณ 2569.
// The v_dashboard_yearly view uses the same rule.
func fiscalYearSQL(dateExpr string) string {
	return "(YEAR(" + dateExpr + ") + (MONTH(" + dateExpr + ") >= 10) + 543)"
}

type summaryRow struct {
	EventsThisYear     int `json:"events_this_year"`
	ParticipantsTotal  int `json:"participants_total"`
	CertificatesIssued int `json:"certificates_issued"`
	OpenNow            int `json:"open_now"`
}

func (h *DashboardHandler) Summary(c *gin.Context) {
	var r summaryRow
	err := h.DB.QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM events WHERE is_listed = 1 AND `+fiscalYearSQL("date_start")+` = `+fiscalYearSQL(todayTH)+`),
			(SELECT COUNT(*) FROM registrations reg JOIN events e ON e.id = reg.event_id WHERE e.is_listed = 1),
			(SELECT COUNT(*) FROM registrations reg JOIN events e ON e.id = reg.event_id WHERE e.is_listed = 1 AND reg.status = 'certified'),
			(SELECT COUNT(*) FROM events WHERE is_listed = 1 AND (`+effectiveStatusSQL+`) = 'open')
	`).Scan(&r.EventsThisYear, &r.ParticipantsTotal, &r.CertificatesIssued, &r.OpenNow)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"summary": r})
}

type budgetRow struct {
	EventID         int64             `json:"event_id"`
	Title           string            `json:"title"`
	Category        string            `json:"category"`
	ReportYear      int               `json:"report_year"` // ปีงบประมาณ (พ.ศ.)
	DateStart       string            `json:"date_start"`
	DateEnd         models.NullString `json:"date_end"`
	Status          string            `json:"status"`
	Ended           bool              `json:"ended"` // last day reached or event closed — actual spend may be recorded
	BudgetPlanned   models.NullFloat  `json:"budget_planned"`
	BudgetOther     models.NullFloat  `json:"budget_other"`
	BudgetTotal     models.NullFloat  `json:"budget_total"`
	BudgetActual    models.NullFloat  `json:"budget_actual"`
	RegisteredCount int               `json:"registered_count"`
	AttendedCount   int               `json:"attended_count"`
	CanEdit         bool              `json:"can_edit"`
}

// Budget lists every listed event with its planned and actual budget — one row
// per event, so the dashboard can roll them up by year and category and still
// show the per-event detail behind each total. Unlike the yearly view this is
// not limited to finished events: a planned budget matters before the event runs.
func (h *DashboardHandler) Budget(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	rows, err := h.DB.Query(`
		SELECT e.id, e.title, e.category, ` + fiscalYearSQL("e.date_start") + `, e.date_start, e.date_end, e.status,
		       (e.status = 'done' OR ` + todayTH + ` >= COALESCE(e.date_end, e.date_start)),
		       e.budget_planned, e.budget_other, e.budget_actual,
		       COUNT(r.id), COALESCE(SUM(r.checked_in), 0), e.organizer_id
		FROM events e
		LEFT JOIN registrations r ON r.event_id = e.id
		WHERE e.is_listed = 1
		GROUP BY e.id
		ORDER BY e.date_start DESC, e.id DESC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []budgetRow{}
	for rows.Next() {
		var r budgetRow
		var organizerID sql.NullInt64
		if err := rows.Scan(&r.EventID, &r.Title, &r.Category, &r.ReportYear, &r.DateStart, &r.DateEnd, &r.Status,
			&r.Ended, &r.BudgetPlanned, &r.BudgetOther, &r.BudgetActual, &r.RegisteredCount, &r.AttendedCount, &organizerID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		r.BudgetTotal = budgetTotal(r.BudgetPlanned, r.BudgetOther)
		r.CanEdit = claims.Role == "admin" || (organizerID.Valid && organizerID.Int64 == claims.UserID)
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"budget": list})
}
