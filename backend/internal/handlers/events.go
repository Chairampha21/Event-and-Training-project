package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
)

type EventsHandler struct {
	DB *sql.DB
}

func NewEventsHandler(db *sql.DB) *EventsHandler {
	return &EventsHandler{DB: db}
}

const eventFields = `
  id, title, description, category, subcategory, poster_url,
  organizer_id, organizer_name,
  day_mode, date_start, date_end, time_range,
  attend_mode, place, online_link, capacity, capacity_onsite, capacity_online,
  status, cycle_stage,
  pretest_enabled, pretest_link, pretest_pass_pct, pretest_time_limit_min,
  cert_template_url, cert_signer_name, cert_signer_title,
  email_on_register, email_before_event, email_after_event,
  is_listed, created_at, updated_at,
  (SELECT COUNT(*) FROM registrations reg WHERE reg.event_id = events.id) AS registered_count
`

func scanEvent(row interface{ Scan(dest ...any) error }) (models.Event, error) {
	var e models.Event
	var pretestEnabled, emailOnRegister, emailBeforeEvent, emailAfterEvent, isListed int
	err := row.Scan(
		&e.ID, &e.Title, &e.Description, &e.Category, &e.Subcategory, &e.PosterURL,
		&e.OrganizerID, &e.OrganizerName,
		&e.DayMode, &e.DateStart, &e.DateEnd, &e.TimeRange,
		&e.AttendMode, &e.Place, &e.OnlineLink, &e.Capacity, &e.CapacityOnsite, &e.CapacityOnline,
		&e.Status, &e.CycleStage,
		&pretestEnabled, &e.PretestLink, &e.PretestPassPct, &e.PretestTimeLimitMin,
		&e.CertTemplateURL, &e.CertSignerName, &e.CertSignerTitle,
		&emailOnRegister, &emailBeforeEvent, &emailAfterEvent,
		&isListed, &e.CreatedAt, &e.UpdatedAt,
		&e.RegisteredCount,
	)
	e.PretestEnabled = pretestEnabled == 1
	e.EmailOnRegister = emailOnRegister == 1
	e.EmailBeforeEvent = emailBeforeEvent == 1
	e.EmailAfterEvent = emailAfterEvent == 1
	e.IsListed = isListed == 1
	return e, err
}

func (h *EventsHandler) List(c *gin.Context) {
	clauses := []string{"is_listed = 1"}
	var args []any

	if status := c.Query("status"); status != "" {
		clauses = append(clauses, "status = ?")
		args = append(args, status)
	}
	if category := c.Query("category"); category != "" {
		clauses = append(clauses, "category = ?")
		args = append(args, category)
	}
	if q := c.Query("q"); q != "" {
		clauses = append(clauses, "title LIKE ?")
		args = append(args, "%"+q+"%")
	}

	query := fmt.Sprintf(`SELECT %s FROM events WHERE %s ORDER BY date_start ASC`, eventFields, strings.Join(clauses, " AND "))
	rows, err := h.DB.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	events := []models.Event{}
	for rows.Next() {
		e, err := scanEvent(rows)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		events = append(events, e)
	}
	c.JSON(http.StatusOK, gin.H{"events": events})
}

func (h *EventsHandler) GetOne(c *gin.Context) {
	row := h.DB.QueryRow(`SELECT `+eventFields+` FROM events WHERE id = ?`, c.Param("id"))
	event, err := scanEvent(row)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบกิจกรรม"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	if !event.IsListed {
		claims, ok := middleware.CurrentUser(c)
		isManager := ok && (claims.Role == "admin" || (event.OrganizerID.Valid && claims.UserID == event.OrganizerID.Int64))
		if !isManager {
			c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบกิจกรรม"})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"event": event})
}

type eventBody struct {
	Title               string  `json:"title"`
	Description         *string `json:"description"`
	Category            string  `json:"category"`
	Subcategory         *string `json:"subcategory"`
	PosterURL           *string `json:"poster_url"`
	OrganizerID         *int64  `json:"organizer_id"`
	OrganizerName       *string `json:"organizer_name"`
	DayMode             string  `json:"day_mode"`
	DateStart           string  `json:"date_start"`
	DateEnd             *string `json:"date_end"`
	TimeRange           *string `json:"time_range"`
	AttendMode          string  `json:"attend_mode"`
	Place               *string `json:"place"`
	OnlineLink          *string `json:"online_link"`
	Capacity            *int    `json:"capacity"`
	CapacityOnsite      *int    `json:"capacity_onsite"`
	CapacityOnline      *int    `json:"capacity_online"`
	Status              *string `json:"status"`
	CycleStage          *int    `json:"cycle_stage"`
	PretestEnabled      *bool   `json:"pretest_enabled"`
	PretestLink         *string `json:"pretest_link"`
	PretestPassPct      *int    `json:"pretest_pass_pct"`
	PretestTimeLimitMin *int    `json:"pretest_time_limit_min"`
	CertTemplateURL     *string `json:"cert_template_url"`
	CertSignerName      *string `json:"cert_signer_name"`
	CertSignerTitle     *string `json:"cert_signer_title"`
	EmailOnRegister     *bool   `json:"email_on_register"`
	EmailBeforeEvent    *bool   `json:"email_before_event"`
	EmailAfterEvent     *bool   `json:"email_after_event"`
}

func validateEventBody(b eventBody) string {
	if strings.TrimSpace(b.Title) == "" {
		return "ระบุชื่อกิจกรรม"
	}
	if strings.TrimSpace(b.Category) == "" {
		return "ระบุประเภทกิจกรรม"
	}
	if b.DateStart == "" {
		return "ระบุวันที่จัดกิจกรรม"
	}
	if b.DayMode != "single" && b.DayMode != "multi" {
		return "day_mode ไม่ถูกต้อง"
	}
	if b.AttendMode != "onsite" && b.AttendMode != "online" && b.AttendMode != "hybrid" {
		return "attend_mode ไม่ถูกต้อง"
	}
	if b.AttendMode == "hybrid" && (b.CapacityOnsite == nil || b.CapacityOnline == nil) {
		return "กิจกรรมแบบ hybrid ต้องระบุจำนวนรับ onsite และ online"
	}
	return ""
}

func (h *EventsHandler) Create(c *gin.Context) {
	var b eventBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	if msg := validateEventBody(b); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	organizerID := claims.UserID
	if claims.Role == "admin" && b.OrganizerID != nil {
		organizerID = *b.OrganizerID
	}

	status := "soon"
	if b.Status != nil {
		status = *b.Status
	}
	capacity := 0
	if b.Capacity != nil {
		capacity = *b.Capacity
	}
	cycleStage := 0
	if b.CycleStage != nil {
		cycleStage = *b.CycleStage
	}
	emailOnRegister, emailBeforeEvent := true, true
	if b.EmailOnRegister != nil {
		emailOnRegister = *b.EmailOnRegister
	}
	if b.EmailBeforeEvent != nil {
		emailBeforeEvent = *b.EmailBeforeEvent
	}
	emailAfterEvent := false
	if b.EmailAfterEvent != nil {
		emailAfterEvent = *b.EmailAfterEvent
	}
	pretestEnabled := b.PretestEnabled != nil && *b.PretestEnabled

	res, err := h.DB.Exec(`INSERT INTO events (
		title, description, category, subcategory, poster_url,
		organizer_id, organizer_name,
		day_mode, date_start, date_end, time_range,
		attend_mode, place, online_link, capacity, capacity_onsite, capacity_online,
		status, cycle_stage,
		pretest_enabled, pretest_link, pretest_pass_pct, pretest_time_limit_min,
		cert_template_url, cert_signer_name, cert_signer_title,
		email_on_register, email_before_event, email_after_event
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		strings.TrimSpace(b.Title), b.Description, strings.TrimSpace(b.Category), b.Subcategory, b.PosterURL,
		organizerID, b.OrganizerName,
		b.DayMode, b.DateStart, b.DateEnd, b.TimeRange,
		b.AttendMode, b.Place, b.OnlineLink, capacity, b.CapacityOnsite, b.CapacityOnline,
		status, cycleStage,
		pretestEnabled, b.PretestLink, b.PretestPassPct, b.PretestTimeLimitMin,
		b.CertTemplateURL, b.CertSignerName, b.CertSignerTitle,
		emailOnRegister, emailBeforeEvent, emailAfterEvent,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	id, _ := res.LastInsertId()

	row := h.DB.QueryRow(`SELECT `+eventFields+` FROM events WHERE id = ?`, id)
	event, err := scanEvent(row)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &claims.UserID, "CREATE", "สร้างกิจกรรม: "+b.Title)
	c.JSON(http.StatusCreated, gin.H{"event": event})
}

func (h *EventsHandler) loadOwned(c *gin.Context) (models.Event, bool) {
	row := h.DB.QueryRow(`SELECT `+eventFields+` FROM events WHERE id = ?`, c.Param("id"))
	event, err := scanEvent(row)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบกิจกรรม"})
		return event, false
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return event, false
	}
	claims, _ := middleware.CurrentUser(c)
	if claims.Role != "admin" && !(event.OrganizerID.Valid && event.OrganizerID.Int64 == claims.UserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์แก้ไขกิจกรรมนี้"})
		return event, false
	}
	return event, true
}

func (h *EventsHandler) Update(c *gin.Context) {
	existing, ok := h.loadOwned(c)
	if !ok {
		return
	}

	var raw map[string]any
	if err := c.ShouldBindJSON(&raw); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	updatable := map[string]bool{
		"title": true, "description": true, "category": true, "subcategory": true, "poster_url": true,
		"organizer_name": true, "day_mode": true, "date_start": true, "date_end": true, "time_range": true,
		"attend_mode": true, "place": true, "online_link": true, "capacity": true, "capacity_onsite": true, "capacity_online": true,
		"status": true, "cycle_stage": true,
		"pretest_enabled": true, "pretest_link": true, "pretest_pass_pct": true, "pretest_time_limit_min": true,
		"cert_template_url": true, "cert_signer_name": true, "cert_signer_title": true,
		"email_on_register": true, "email_before_event": true, "email_after_event": true,
	}

	var sets []string
	var args []any
	for field, val := range raw {
		if !updatable[field] {
			continue
		}
		sets = append(sets, field+" = ?")
		args = append(args, val)
	}
	if len(sets) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่มีข้อมูลที่จะแก้ไข"})
		return
	}

	args = append(args, c.Param("id"))
	_, err := h.DB.Exec(fmt.Sprintf(`UPDATE events SET %s WHERE id = ?`, strings.Join(sets, ", ")), args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	row := h.DB.QueryRow(`SELECT `+eventFields+` FROM events WHERE id = ?`, c.Param("id"))
	event, err := scanEvent(row)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	activitylog.Log(h.DB, &claims.UserID, "UPDATE", "แก้ไขกิจกรรม: "+existing.Title)
	c.JSON(http.StatusOK, gin.H{"event": event})
}

// Remove is a soft delete only, matching the frontend's deleteEvent -> listed=false behavior.
func (h *EventsHandler) Remove(c *gin.Context) {
	existing, ok := h.loadOwned(c)
	if !ok {
		return
	}

	if _, err := h.DB.Exec(`UPDATE events SET is_listed = 0 WHERE id = ?`, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	activitylog.Log(h.DB, &claims.UserID, "DELETE", "ลบกิจกรรม: "+existing.Title)
	c.Status(http.StatusNoContent)
}
