package handlers

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
)

type RegistrationsHandler struct {
	DB *sql.DB
}

func NewRegistrationsHandler(db *sql.DB) *RegistrationsHandler {
	return &RegistrationsHandler{DB: db}
}

// RegisterForEvent enrolls the logged-in student, enforcing: event must be open,
// the student must not be blacklisted, must not already be registered, and the
// event must not be full.
func (h *RegistrationsHandler) RegisterForEvent(c *gin.Context) {
	eventID := c.Param("id")
	claims, _ := middleware.CurrentUser(c)

	var (
		title                          string
		status, attendMode             string
		capacity                       int
		capacityOnsite, capacityOnline sql.NullInt64
	)
	err := h.DB.QueryRow(
		`SELECT title, status, attend_mode, capacity, capacity_onsite, capacity_online
		 FROM events WHERE id = ? AND is_listed = 1`, eventID,
	).Scan(&title, &status, &attendMode, &capacity, &capacityOnsite, &capacityOnline)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบกิจกรรม"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if status != "open" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กิจกรรมนี้ไม่ได้เปิดรับสมัครอยู่"})
		return
	}

	var studentID sql.NullString
	if err := h.DB.QueryRow(`SELECT student_id FROM users WHERE id = ?`, claims.UserID).Scan(&studentID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	var blacklistCount int
	err = h.DB.QueryRow(
		`SELECT COUNT(*) FROM blacklist_entries
		 WHERE restored_at IS NULL AND (user_id = ? OR email = ? OR (student_id IS NOT NULL AND student_id = ?))`,
		claims.UserID, claims.Email, studentID,
	).Scan(&blacklistCount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if blacklistCount > 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้ถูกระงับสิทธิ์การลงทะเบียนกิจกรรม"})
		return
	}

	cap := capacity
	if attendMode == "hybrid" {
		cap = int(capacityOnsite.Int64) + int(capacityOnline.Int64)
	}
	var regCount int
	if err := h.DB.QueryRow(`SELECT COUNT(*) FROM registrations WHERE event_id = ?`, eventID).Scan(&regCount); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if cap > 0 && regCount >= cap {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กิจกรรมนี้เต็มแล้ว"})
		return
	}

	res, err := h.DB.Exec(`INSERT INTO registrations (event_id, user_id) VALUES (?, ?)`, eventID, claims.UserID)
	if err != nil {
		if isDuplicateErr(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "คุณลงทะเบียนกิจกรรมนี้ไว้แล้ว"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	id, _ := res.LastInsertId()

	// This registration just took the last open seat — flip the event to 'full'
	// automatically so it stops accepting new signups and reflects reality in
	// the listing, matching the capacity check above.
	if cap > 0 && regCount+1 >= cap {
		if _, err := h.DB.Exec(`UPDATE events SET status = 'full' WHERE id = ? AND status = 'open'`, eventID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
	}

	reg, err := scanRegistration(h.DB.QueryRow(`SELECT id, event_id, user_id, status, checked_in, checked_in_at, registered_at, updated_at FROM registrations WHERE id = ?`, id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &claims.UserID, "REGISTER", "ลงทะเบียนกิจกรรม: "+title)
	c.JSON(http.StatusCreated, gin.H{"registration": reg})
}

// CheckIn marks a registration as checked in on-site — the roster's "ตรวจสอบแล้ว"
// toggle. Organizer of the event or an admin only. Toggling off (checked_in=false)
// reverts status back to 'registered' if it was 'attended'.
func (h *RegistrationsHandler) CheckIn(c *gin.Context) {
	var body struct {
		CheckedIn bool `json:"checked_in"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	var organizerID sql.NullInt64
	var status string
	err := h.DB.QueryRow(
		`SELECT e.organizer_id, r.status FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`,
		c.Param("id"),
	).Scan(&organizerID, &status)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบรายการลงทะเบียน"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	if claims.Role != "admin" && !(organizerID.Valid && organizerID.Int64 == claims.UserID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์เข้าถึงรายชื่อผู้สมัคร"})
		return
	}

	newStatus := status
	if body.CheckedIn {
		if status == "registered" {
			newStatus = "attended"
		}
		_, err = h.DB.Exec(`UPDATE registrations SET checked_in = 1, checked_in_at = NOW(), status = ? WHERE id = ?`, newStatus, c.Param("id"))
	} else {
		if status == "attended" {
			newStatus = "registered"
		}
		_, err = h.DB.Exec(`UPDATE registrations SET checked_in = 0, checked_in_at = NULL, status = ? WHERE id = ?`, newStatus, c.Param("id"))
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	reg, err := scanRegistration(h.DB.QueryRow(`SELECT id, event_id, user_id, status, checked_in, checked_in_at, registered_at, updated_at FROM registrations WHERE id = ?`, c.Param("id")))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"registration": reg})
}

func (h *RegistrationsHandler) CancelRegistration(c *gin.Context) {
	var (
		reg         models.Registration
		organizerID sql.NullInt64
		title       string
	)
	err := h.DB.QueryRow(
		`SELECT r.id, r.event_id, r.user_id, r.status, r.checked_in, r.checked_in_at, r.registered_at, r.updated_at,
		        e.organizer_id, e.title
		 FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`, c.Param("id"),
	).Scan(&reg.ID, &reg.EventID, &reg.UserID, &reg.Status, &reg.CheckedIn, &reg.CheckedInAt, &reg.RegisteredAt, &reg.UpdatedAt, &organizerID, &title)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบรายการลงทะเบียน"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	isOwner := reg.UserID == claims.UserID
	isManager := claims.Role == "admin" || (organizerID.Valid && organizerID.Int64 == claims.UserID)
	if !isOwner && !isManager {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์ยกเลิกรายการนี้"})
		return
	}

	if _, err := h.DB.Exec(`DELETE FROM registrations WHERE id = ?`, c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	// Cancelling frees a seat — if the event had auto-closed as full, reopen it.
	if _, err := h.DB.Exec(`UPDATE events SET status = 'open' WHERE id = ? AND status = 'full'`, reg.EventID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &claims.UserID, "DELETE", "ยกเลิกลงทะเบียน: "+title)
	c.Status(http.StatusNoContent)
}

type myRegistrationRow struct {
	ID            int64             `json:"id"`
	Status        string            `json:"status"`
	CheckedIn     bool              `json:"checked_in"`
	CheckedInAt   models.NullString `json:"checked_in_at"`
	RegisteredAt  string            `json:"registered_at"`
	EventID       int64             `json:"event_id"`
	Title         string            `json:"title"`
	Category      string            `json:"category"`
	DateStart     string            `json:"date_start"`
	DateEnd       models.NullString `json:"date_end"`
	TimeRange     models.NullString `json:"time_range"`
	EventStatus   string            `json:"event_status"`
	Place         models.NullString `json:"place"`
	OrganizerName models.NullString `json:"organizer_name"`
}

func (h *RegistrationsHandler) MyRegistrations(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	rows, err := h.DB.Query(
		`SELECT r.id, r.status, r.checked_in, r.checked_in_at, r.registered_at,
		        e.id, e.title, e.category, e.date_start, e.date_end, e.time_range, e.status, e.place, e.organizer_name
		 FROM registrations r JOIN events e ON e.id = r.event_id
		 WHERE r.user_id = ? ORDER BY r.registered_at DESC`, claims.UserID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []myRegistrationRow{}
	for rows.Next() {
		var r myRegistrationRow
		var checkedIn int
		if err := rows.Scan(&r.ID, &r.Status, &checkedIn, &r.CheckedInAt, &r.RegisteredAt,
			&r.EventID, &r.Title, &r.Category, &r.DateStart, &r.DateEnd, &r.TimeRange, &r.EventStatus, &r.Place, &r.OrganizerName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		r.CheckedIn = checkedIn == 1
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"registrations": list})
}

type rosterRow struct {
	ID           int64             `json:"id"`
	Status       string            `json:"status"`
	CheckedIn    bool              `json:"checked_in"`
	CheckedInAt  models.NullString `json:"checked_in_at"`
	RegisteredAt string            `json:"registered_at"`
	UserID       int64             `json:"user_id"`
	Name         string            `json:"name"`
	Email        string            `json:"email"`
	StudentID    models.NullString `json:"student_id"`
}

// EventRoster is the organizer/admin roster view for one event — the check-in modal's data source.
func (h *RegistrationsHandler) EventRoster(c *gin.Context) {
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
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์เข้าถึงรายชื่อผู้สมัคร"})
		return
	}

	rows, err := h.DB.Query(
		`SELECT r.id, r.status, r.checked_in, r.checked_in_at, r.registered_at,
		        u.id, u.name, u.email, u.student_id
		 FROM registrations r JOIN users u ON u.id = r.user_id
		 WHERE r.event_id = ? ORDER BY u.name ASC`, c.Param("id"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []rosterRow{}
	for rows.Next() {
		var r rosterRow
		var checkedIn int
		if err := rows.Scan(&r.ID, &r.Status, &checkedIn, &r.CheckedInAt, &r.RegisteredAt,
			&r.UserID, &r.Name, &r.Email, &r.StudentID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		r.CheckedIn = checkedIn == 1
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"registrations": list})
}

func scanRegistration(row interface{ Scan(dest ...any) error }) (models.Registration, error) {
	var r models.Registration
	var checkedIn int
	err := row.Scan(&r.ID, &r.EventID, &r.UserID, &r.Status, &checkedIn, &r.CheckedInAt, &r.RegisteredAt, &r.UpdatedAt)
	r.CheckedIn = checkedIn == 1
	return r, err
}
