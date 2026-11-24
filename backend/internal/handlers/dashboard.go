package handlers

import (
	"database/sql"
	"net/http"
	"strconv"

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
	ParticipantsTotal  int `json:"participants_total"` // registrations, attended or not
	AttendedTotal      int `json:"attended_total"`     // of those, checked in on at least one day
	CertificatesIssued int `json:"certificates_issued"`
	OpenNow            int `json:"open_now"`
	// The same figures split CS / IT: events by the programme they are for
	// ("all" = open to both), people by the registrant's major ("all" = no major set).
	ByProgram map[string]programSplit `json:"by_program"`
}

type programSplit struct {
	CS  int `json:"cs"`
	IT  int `json:"it"`
	All int `json:"all"`
}

// regDeptSQL is a registrant's "ชั้นปีที่ N · สาขา" text as it was when they
// registered (registrations.dept), so a later profile change — moving up a
// year, switching major — doesn't move them in reports of past events.
// Registrations made before that was kept fall back to the profile.
// Needs the aliases reg (registrations) and u (users).
const regDeptSQL = `COALESCE(reg.dept, u.dept)`

// userProgramSQL is 'cs', 'it' or 'all' (no major) for a dept text expression,
// read from the major in it (as studentProgram does).
func userProgramSQL(dept string) string {
	return `CASE WHEN COALESCE(` + dept + `, '') LIKE '%สารสนเทศ%' THEN 'it'
	             WHEN COALESCE(` + dept + `, '') LIKE '%คอมพิวเตอร์%' THEN 'cs' ELSE 'all' END`
}

// notTeacherSQL keeps a registration alias out of the dashboard and report
// figures when a teacher made it: teachers join events like students but are
// not counted as participants.
func notTeacherSQL(regAlias string) string {
	return regAlias + ".user_id NOT IN (SELECT id FROM users WHERE role = 'teacher')"
}

// Summary is the figures on the events page. With ?fy=2569 every figure is for
// that fiscal year's events (registrations, attendance and certificates of
// those events); ?fy=all counts every event. Without fy: the events of the
// current fiscal year, and the people figures across all years.
func (h *DashboardHandler) Summary(c *gin.Context) {
	// scope narrows events alias e; eventsScope is for the events count.
	scope, eventsScope := "", " AND "+fiscalYearSQL("e.date_start")+" = "+fiscalYearSQL(todayTH)
	switch fy := c.Query("fy"); fy {
	case "":
	case "all":
		eventsScope = ""
	default:
		n, err := strconv.Atoi(fy)
		if err != nil || n < 2400 || n > 2800 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ปีงบประมาณไม่ถูกต้อง"})
			return
		}
		scope = " AND " + fiscalYearSQL("e.date_start") + " = " + strconv.Itoa(n)
		eventsScope = scope
	}

	var r summaryRow
	err := h.DB.QueryRow(`
		SELECT
			(SELECT COUNT(*) FROM events e WHERE e.is_listed = 1`+eventsScope+`),
			(SELECT COUNT(*) FROM registrations reg JOIN events e ON e.id = reg.event_id WHERE e.is_listed = 1`+scope+` AND `+notTeacherSQL("reg")+`),
			(SELECT COUNT(*) FROM registrations reg JOIN events e ON e.id = reg.event_id WHERE e.is_listed = 1`+scope+` AND `+notTeacherSQL("reg")+`
			   AND (reg.status IN ('attended', 'certified') OR EXISTS (SELECT 1 FROM registration_checkins rc WHERE rc.registration_id = reg.id))),
			(SELECT COUNT(*) FROM registrations reg JOIN events e ON e.id = reg.event_id WHERE e.is_listed = 1`+scope+` AND reg.status = 'certified' AND `+notTeacherSQL("reg")+`),
			(SELECT COUNT(*) FROM events e WHERE e.is_listed = 1`+scope+` AND (`+effectiveStatusSQL+`) = 'open')
	`).Scan(&r.EventsThisYear, &r.ParticipantsTotal, &r.AttendedTotal, &r.CertificatesIssued, &r.OpenNow)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	// One row per (figure, programme): the events by their programme, the
	// registrations by the registrant's.
	r.ByProgram = map[string]programSplit{}
	rows, err := h.DB.Query(`
		SELECT 'events_this_year', program, COUNT(*) FROM events e
		 WHERE e.is_listed = 1` + eventsScope + ` GROUP BY program
		UNION ALL
		SELECT 'open_now', program, COUNT(*) FROM events e
		 WHERE e.is_listed = 1` + scope + ` AND (` + effectiveStatusSQL + `) = 'open' GROUP BY program
		UNION ALL
		SELECT 'participants_total', p, COUNT(*) FROM (
		  SELECT ` + userProgramSQL(regDeptSQL) + ` AS p FROM registrations reg
		  JOIN events e ON e.id = reg.event_id JOIN users u ON u.id = reg.user_id
		  WHERE e.is_listed = 1` + scope + ` AND u.role <> 'teacher') x GROUP BY p
		UNION ALL
		SELECT 'attended_total', p, COUNT(*) FROM (
		  SELECT ` + userProgramSQL(regDeptSQL) + ` AS p FROM registrations reg
		  JOIN events e ON e.id = reg.event_id JOIN users u ON u.id = reg.user_id
		  WHERE e.is_listed = 1` + scope + ` AND u.role <> 'teacher'
		    AND (reg.status IN ('attended', 'certified') OR EXISTS (SELECT 1 FROM registration_checkins rc WHERE rc.registration_id = reg.id))) x GROUP BY p
		UNION ALL
		SELECT 'certificates_issued', p, COUNT(*) FROM (
		  SELECT ` + userProgramSQL(regDeptSQL) + ` AS p FROM registrations reg
		  JOIN events e ON e.id = reg.event_id JOIN users u ON u.id = reg.user_id
		  WHERE e.is_listed = 1` + scope + ` AND u.role <> 'teacher' AND reg.status = 'certified') x GROUP BY p`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()
	for rows.Next() {
		var figure, program string
		var n int
		if err := rows.Scan(&figure, &program, &n); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		sp := r.ByProgram[figure]
		switch program {
		case "cs":
			sp.CS += n
		case "it":
			sp.IT += n
		default:
			sp.All += n
		}
		r.ByProgram[figure] = sp
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
		LEFT JOIN registrations r ON r.event_id = e.id AND ` + notTeacherSQL("r") + `
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

// userYearSQL is the year of study ('1'..'5', 5 = five and above) in a dept
// text expression ("นักศึกษาชั้นปีที่ 3 · ..."), or ” when none is given.
func userYearSQL(dept string) string {
	return `COALESCE(CAST(LEAST(CAST(REGEXP_SUBSTR(REGEXP_SUBSTR(COALESCE(` + dept + `, ''), 'ชั้นปีที่ *[0-9]+'), '[0-9]+') AS UNSIGNED), 5) AS CHAR), '')`
}

type audienceRow struct {
	Program    string `json:"program"` // cs | it | all (no major set)
	Year       string `json:"year"`    // "1".."5" | "" (not set)
	Registered int    `json:"registered"`
	Attended   int    `json:"attended"`
	Certified  int    `json:"certified"`
}

// Audience splits the people of one fiscal year's finished events (?fy=2570)
// by programme and year of study, read from each registrant's profile — the
// same registrations the yearly figures count (teachers left out).
func (h *DashboardHandler) Audience(c *gin.Context) {
	fy, err := strconv.Atoi(c.Query("fy"))
	if err != nil || fy < 2400 || fy > 2800 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ปีงบประมาณไม่ถูกต้อง"})
		return
	}
	rows, err := h.DB.Query(`
		SELECT p, y, COUNT(*), COALESCE(SUM(went), 0), COALESCE(SUM(cert), 0) FROM (
		  SELECT `+userProgramSQL(regDeptSQL)+` AS p, `+userYearSQL(regDeptSQL)+` AS y,
		         (reg.status IN ('attended', 'certified') OR EXISTS (SELECT 1 FROM registration_checkins rc WHERE rc.registration_id = reg.id)) AS went,
		         reg.status = 'certified' AS cert
		  FROM registrations reg
		  JOIN events e ON e.id = reg.event_id JOIN users u ON u.id = reg.user_id
		  WHERE e.is_listed = 1 AND e.status = 'done' AND u.role <> 'teacher'
		    AND `+fiscalYearSQL("e.date_start")+` = ?) x
		GROUP BY p, y`, fy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()
	list := []audienceRow{}
	for rows.Next() {
		var r audienceRow
		if err := rows.Scan(&r.Program, &r.Year, &r.Registered, &r.Attended, &r.Certified); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"audience": list})
}
