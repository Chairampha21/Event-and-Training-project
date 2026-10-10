package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
	"cpsu-etms-backend/internal/notify"
	"cpsu-etms-backend/internal/reminders"
)

type RegistrationsHandler struct {
	DB *sql.DB
}

// checkinSecret signs the self check-in links given to online attendees.
var checkinSecret string

// SetCheckinSecret is called once at start-up with the server's secret.
func SetCheckinSecret(secret string) { checkinSecret = secret }

// checkinKey is the key in an event day's self check-in link. It is derived,
// not stored: the same event and day always give the same key, and a key for
// one day does not work on another.
func checkinKey(eventID any, day string) string {
	mac := hmac.New(sha256.New, []byte(checkinSecret))
	fmt.Fprintf(mac, "checkin|%v|%s", eventID, day)
	return hex.EncodeToString(mac.Sum(nil))[:16]
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
		organizerID                    sql.NullInt64
		regStart, regEnd               sql.NullString
		beforeWindow, afterWindow      bool
		attendeeNote                   sql.NullString
		loanQty                        sql.NullInt64
		hasOnlineLink                  bool
		askDietary                     bool
		fee                            sql.NullFloat64
	)
	// Optional body: the student may ask to borrow one of the event's notebooks.
	var body struct {
		BorrowLaptop bool   `json:"borrow_laptop"`
		FoodAllergy  string `json:"food_allergy"`
		DietaryPref  string `json:"dietary_pref"`
		AttendVia    string `json:"attend_via"` // 'onsite' | 'online' — asked only when the event offers both
	}
	_ = c.ShouldBindJSON(&body) // no body at all is fine
	err := h.DB.QueryRow(
		`SELECT title, status, attend_mode, capacity, capacity_onsite, capacity_online, organizer_id,
		        reg_start, reg_end,
		        COALESCE(`+todayTH+` < reg_start, 0), COALESCE(`+todayTH+` > reg_end, 0),
		        attendee_note, loan_laptop_qty, COALESCE(online_link, '') <> '', ask_dietary, fee
		 FROM events WHERE id = ? AND is_listed = 1`, eventID,
	).Scan(&title, &status, &attendMode, &capacity, &capacityOnsite, &capacityOnline, &organizerID,
		&regStart, &regEnd, &beforeWindow, &afterWindow, &attendeeNote, &loanQty, &hasOnlineLink, &askDietary, &fee)
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
	if beforeWindow {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ยังไม่ถึงช่วงเวลารับสมัคร · เปิดรับสมัคร " + thaiDate(regStart.String)})
		return
	}
	if afterWindow {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ปิดรับสมัครแล้วเมื่อ " + thaiDate(regEnd.String)})
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

	// How this person will attend. An event held one way leaves no choice; one
	// held both ways has a separate number of seats for each, so they must pick.
	attendVia := attendMode
	if attendMode == "hybrid" {
		attendVia = body.AttendVia
		if attendVia != "onsite" && attendVia != "online" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาเลือกรูปแบบการเข้าร่วม (ที่สถานที่จัด หรือ ออนไลน์)"})
			return
		}
	}
	if attendVia == "online" {
		// Nothing to hand over or serve to someone who is not in the room.
		if body.BorrowLaptop {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ยืมโน้ตบุ๊กได้เฉพาะผู้เข้าร่วมที่สถานที่จัด"})
			return
		}
		askDietary = false
	}

	// Dietary answers are kept only when the organizer asked for them, and
	// trimmed to what the columns hold.
	foodAllergy, dietaryPref := "", ""
	if askDietary {
		foodAllergy = truncateRunes(strings.TrimSpace(body.FoodAllergy), 300)
		dietaryPref = truncateRunes(strings.TrimSpace(body.DietaryPref), 100)
	}
	if body.BorrowLaptop && (!loanQty.Valid || loanQty.Int64 == 0) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กิจกรรมนี้ไม่มีโน้ตบุ๊กให้ยืม"})
		return
	}

	// Seats and loan notebooks are both limited, so counting and inserting have
	// to be one step: lock the event row for the length of the transaction.
	// Two students who press "register" at the same moment then go one after
	// the other, and the second sees the first's seat/notebook already taken —
	// the last notebook can never be promised twice.
	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer tx.Rollback()
	var lockedID int64
	if err := tx.QueryRow(`SELECT id FROM events WHERE id = ? FOR UPDATE`, eventID).Scan(&lockedID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	var regCount, viaCount int
	var laptopsTaken int64
	if err := tx.QueryRow(
		`SELECT COUNT(*), COALESCE(SUM(wants_laptop), 0), COALESCE(SUM(attend_via = ?), 0) FROM registrations WHERE event_id = ?`, attendVia, eventID,
	).Scan(&regCount, &laptopsTaken, &viaCount); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if cap > 0 && regCount >= cap {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กิจกรรมนี้เต็มแล้ว"})
		return
	}
	if attendMode == "hybrid" {
		viaCap, viaLabel, other := capacityOnsite.Int64, "ที่สถานที่จัด", "ออนไลน์"
		if attendVia == "online" {
			viaCap, viaLabel, other = capacityOnline.Int64, "ออนไลน์", "ที่สถานที่จัด"
		}
		if int64(viaCount) >= viaCap {
			c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("ที่นั่งแบบ%sเต็มแล้ว (%d ที่) · ยังสมัครแบบ%sได้", viaLabel, viaCap, other)})
			return
		}
	}
	// Refuse (rather than silently drop) a loan request when none are left, so
	// the student can decide to bring their own and register again.
	if body.BorrowLaptop && laptopsTaken >= loanQty.Int64 {
		c.JSON(http.StatusConflict, gin.H{"error": fmt.Sprintf("โน้ตบุ๊กให้ยืมทั้ง %d เครื่องถูกขอครบแล้ว กรุณานำโน้ตบุ๊กส่วนตัวมาเอง แล้วลงทะเบียนอีกครั้งโดยไม่เลือกยืม", loanQty.Int64)})
		return
	}

	// A paid event starts each registration as 'pending' until the organizer
	// confirms the payment; a free event has nothing to pay ('none').
	paymentStatus := "none"
	if fee.Valid && fee.Float64 > 0 {
		paymentStatus = "pending"
	}
	res, err := tx.Exec(
		`INSERT INTO registrations (event_id, user_id, attend_via, wants_laptop, food_allergy, dietary_pref, payment_status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		eventID, claims.UserID, attendVia, body.BorrowLaptop, nullIfEmpty(foodAllergy), nullIfEmpty(dietaryPref), paymentStatus,
	)
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
	becameFull := cap > 0 && regCount+1 >= cap
	if becameFull {
		if _, err := tx.Exec(`UPDATE events SET status = 'full' WHERE id = ? AND status = 'open'`, eventID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	reg, err := scanRegistration(h.DB.QueryRow(`SELECT id, event_id, user_id, status, checked_in, checked_in_at, registered_at, updated_at FROM registrations WHERE id = ?`, id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &claims.UserID, "REGISTER", "ลงทะเบียนกิจกรรม: "+title)
	confirm := title + " · รอการเปิดเช็คอินวันจัดกิจกรรม"
	if attendMode == "hybrid" {
		if attendVia == "online" {
			confirm = title + " · เข้าร่วมแบบออนไลน์ · เช็คชื่อด้วยลิงก์ที่ผู้จัดแจ้งในวันจัดกิจกรรม"
		} else {
			confirm = title + " · เข้าร่วมที่สถานที่จัด · ลงชื่อหน้างานในวันจัดกิจกรรม"
		}
	}
	if body.BorrowLaptop {
		confirm += fmt.Sprintf(" · จองโน้ตบุ๊กให้ยืมไว้ให้แล้ว 1 เครื่อง (เหลืออีก %d เครื่อง)", loanQty.Int64-laptopsTaken-1)
	}
	if foodAllergy != "" || dietaryPref != "" {
		confirm += " · บันทึกข้อมูลอาหารของคุณแล้ว"
	}
	if paymentStatus == "pending" {
		confirm += fmt.Sprintf(" · ค่าลงทะเบียน %s บาท รอชำระเงิน ดูวิธีชำระในรายละเอียดกิจกรรม", formatAmount(fee.Float64))
	}
	if hasOnlineLink && attendMode != "onsite" {
		confirm += " · ดูลิงก์เข้าร่วมออนไลน์ได้ในรายละเอียดกิจกรรม"
	}
	if attendeeNote.Valid && attendeeNote.String != "" {
		confirm += " · ผู้จัดแจ้ง: " + attendeeNote.String
	}
	notify.Send(h.DB, claims.UserID, "ti-user-check", notify.ToneAccent, "ลงทะเบียนสำเร็จ", confirm, "/home?event="+eventID)
	if organizerID.Valid {
		// The organizer is not told about every single registration — the list
		// shows those — only about one that brings something to prepare: a
		// notebook to lend, or food to keep apart.
		var needs []string
		if body.BorrowLaptop {
			needs = append(needs, "ขอยืมโน้ตบุ๊ก")
		}
		if foodAllergy != "" {
			needs = append(needs, "แพ้อาหาร: "+foodAllergy)
		}
		if dietaryPref != "" {
			needs = append(needs, "ข้อจำกัดด้านอาหาร: "+dietaryPref)
		}
		if len(needs) > 0 {
			notify.Send(h.DB, organizerID.Int64, "ti-clipboard-list", notify.ToneDark, "ผู้สมัครมีเรื่องที่ต้องเตรียม",
				claims.Name+" · "+strings.Join(needs, " · ")+" · "+title, "/events?applicants="+eventID)
		}
		if becameFull {
			notify.Send(h.DB, organizerID.Int64, "ti-users", notify.ToneWarn, "กิจกรรมเต็มแล้ว", title+" · มีผู้ลงทะเบียนครบจำนวนที่รับ ระบบปิดรับสมัครอัตโนมัติ", "/events?applicants="+eventID)
		}
	}
	c.JSON(http.StatusCreated, gin.H{"registration": reg})
}

// eventDays lists the days an event runs on (YYYY-MM-DD, in order): the days
// picked for it, or every day from its first to its last, or its single day.
func eventDays(dateStart string, dateEnd, eventDates sql.NullString) []string {
	if eventDates.Valid && strings.TrimSpace(eventDates.String) != "" {
		var days []string
		for _, d := range strings.Split(eventDates.String, ",") {
			if d = strings.TrimSpace(d); d != "" {
				days = append(days, d)
			}
		}
		return days
	}
	days := []string{dateStart}
	first, err1 := time.Parse("2006-01-02", dateStart)
	last, err2 := time.Parse("2006-01-02", dateEnd.String)
	if !dateEnd.Valid || err1 != nil || err2 != nil {
		return days
	}
	for d := first.AddDate(0, 0, 1); !d.After(last) && len(days) < 60; d = d.AddDate(0, 0, 1) {
		days = append(days, d.Format("2006-01-02"))
	}
	return days
}

// CheckIn records (or takes back) a registrant's attendance for one day of the
// event. An event that runs over several days is checked day by day, and the
// registration only counts as attended — which is what opens the evaluation
// and the certificate — once every day has been checked. `date` may be left
// out for a one-day event.
func (h *RegistrationsHandler) CheckIn(c *gin.Context) {
	var body struct {
		CheckedIn bool   `json:"checked_in"`
		Date      string `json:"date"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	var organizerID sql.NullInt64
	var status, title, dateStart string
	var dateEnd, eventDates sql.NullString
	var studentUserID int64
	err := h.DB.QueryRow(
		`SELECT e.organizer_id, r.status, e.title, r.user_id,
		        DATE_FORMAT(e.date_start, '%Y-%m-%d'), DATE_FORMAT(e.date_end, '%Y-%m-%d'), e.event_dates
		 FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`,
		c.Param("id"),
	).Scan(&organizerID, &status, &title, &studentUserID, &dateStart, &dateEnd, &eventDates)
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

	days := eventDays(dateStart, dateEnd, eventDates)
	day := body.Date
	if day == "" && len(days) == 1 {
		day = days[0]
	}
	dayNo := 0
	for i, d := range days {
		if d == day {
			dayNo = i + 1
		}
	}
	if dayNo == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุวันที่เช็คอินให้ตรงกับวันจัดกิจกรรม"})
		return
	}

	reg, checked, err := h.recordCheckin(c.Param("id"), day, dayNo, days, body.CheckedIn, status, title, studentUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"registration": reg, "checkin_dates": checked})
}

// recordCheckin writes (or takes back) one day's check-in for a registration
// and brings the registration's own status in line — used both when the
// organizer ticks someone off and when an online attendee checks in by link.
func (h *RegistrationsHandler) recordCheckin(regID, day string, dayNo int, days []string, on bool, status, title string, studentUserID int64) (reg models.Registration, dates []string, err error) {
	var res sql.Result
	if on {
		res, err = h.DB.Exec(`INSERT IGNORE INTO registration_checkins (registration_id, event_date, checked_in_at) VALUES (?, ?, NOW())`, regID, day)
	} else {
		res, err = h.DB.Exec(`DELETE FROM registration_checkins WHERE registration_id = ? AND event_date = ?`, regID, day)
	}
	if err != nil {
		return reg, nil, err
	}
	changed, _ := res.RowsAffected()

	checked, err := checkinDates(h.DB, `c.registration_id = ?`, regID)
	if err != nil {
		return reg, nil, err
	}
	attendedDays := len(checked[regKey(regID)])
	full := attendedDays >= len(days)

	// registered: not every day checked yet · attended: every day checked ·
	// absent: the event is over and no day was checked (set by the reminders job).
	newStatus := status
	switch {
	case full && (status == "registered" || status == "absent"):
		newStatus = "attended"
	case !full && status == "attended":
		newStatus = "registered"
	case !full && status == "absent" && attendedDays > 0:
		newStatus = "registered" // came on some of the days after all — not a no-show
	}
	if full {
		_, err = h.DB.Exec(`UPDATE registrations SET checked_in = 1, checked_in_at = COALESCE(checked_in_at, NOW()), status = ? WHERE id = ?`, newStatus, regID)
	} else {
		_, err = h.DB.Exec(`UPDATE registrations SET checked_in = 0, checked_in_at = NULL, status = ? WHERE id = ?`, newStatus, regID)
	}
	if err != nil {
		return reg, nil, err
	}

	reg, err = scanRegistration(h.DB.QueryRow(`SELECT id, event_id, user_id, status, checked_in, checked_in_at, registered_at, updated_at FROM registrations WHERE id = ?`, regID))
	if err != nil {
		return reg, nil, err
	}
	if status == "absent" && newStatus != "absent" {
		if regID, err := strconv.ParseInt(regID, 10, 64); err == nil {
			reminders.Reconsider(h.DB, studentUserID, regID) // may lift a suspension the system added
		}
	}
	// Only on the off -> on transition, so re-saving the roster doesn't spam the bell.
	if on && changed == 1 {
		msg := title + " · ยืนยันการเข้าร่วมกิจกรรมแล้ว"
		if len(days) > 1 {
			msg = fmt.Sprintf("%s · ยืนยันการเข้าร่วมวันที่ %d (%s) แล้ว · เข้าร่วม %d จาก %d วัน", title, dayNo, thaiDate(day), attendedDays, len(days))
		}
		notify.Send(h.DB, studentUserID, "ti-circle-check", notify.ToneAccent, "เช็คอินสำเร็จ", msg, "/my-registrations")
	}
	return reg, checked[regKey(regID)], nil
}

// SelfCheckIn lets a registrant who attends online mark themselves present for
// today by opening the link the organizer shows in the online room. The link
// carries a key for that event and day; on top of it the person must be signed
// in, registered as attending online, and the day must be today — a link
// passed around afterwards, or to someone not registered, does nothing.
func (h *RegistrationsHandler) SelfCheckIn(c *gin.Context) {
	var body struct {
		Date string `json:"date"`
		Key  string `json:"key"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ลิงก์เช็คชื่อไม่ถูกต้อง"})
		return
	}
	eventID := c.Param("id")
	claims, _ := middleware.CurrentUser(c)

	var title, dateStart, today string
	var dateEnd, eventDates sql.NullString
	err := h.DB.QueryRow(
		`SELECT title, DATE_FORMAT(date_start, '%Y-%m-%d'), DATE_FORMAT(date_end, '%Y-%m-%d'), event_dates, DATE_FORMAT(`+todayTH+`, '%Y-%m-%d')
		 FROM events WHERE id = ? AND is_listed = 1`, eventID,
	).Scan(&title, &dateStart, &dateEnd, &eventDates, &today)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบกิจกรรม"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	days := eventDays(dateStart, dateEnd, eventDates)
	dayNo := 0
	for i, d := range days {
		if d == body.Date {
			dayNo = i + 1
		}
	}
	if dayNo == 0 || !hmac.Equal([]byte(body.Key), []byte(checkinKey(eventID, body.Date))) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ลิงก์เช็คชื่อไม่ถูกต้อง"})
		return
	}
	if body.Date != today {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ลิงก์นี้ใช้เช็คชื่อได้เฉพาะวันที่ " + thaiDate(body.Date), "title": title})
		return
	}

	var regID int64
	var status, via string
	err = h.DB.QueryRow(`SELECT id, status, attend_via FROM registrations WHERE event_id = ? AND user_id = ?`, eventID, claims.UserID).Scan(&regID, &status, &via)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusForbidden, gin.H{"error": "คุณไม่ได้ลงทะเบียนกิจกรรมนี้", "title": title})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if via != "online" {
		c.JSON(http.StatusForbidden, gin.H{"error": "ลิงก์นี้สำหรับผู้เข้าร่วมแบบออนไลน์ · ผู้เข้าร่วมที่สถานที่จัดลงชื่อกับผู้จัดหน้างาน", "title": title})
		return
	}
	_, dates, err := h.recordCheckin(strconv.FormatInt(regID, 10), body.Date, dayNo, days, true, status, title, claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"title": title, "date": body.Date, "day_no": dayNo, "days_total": len(days), "checkin_dates": dates})
}

// attendVia returns, per registration, whether the person attends 'onsite' or
// 'online'. where is a condition on registrations.
func attendVia(db *sql.DB, where string, args ...any) (map[int64]string, error) {
	rows, err := db.Query(`SELECT id, attend_via FROM registrations WHERE `+where, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64]string{}
	for rows.Next() {
		var id int64
		var via string
		if err := rows.Scan(&id, &via); err != nil {
			return nil, err
		}
		out[id] = via
	}
	return out, rows.Err()
}

func regKey(id string) int64 {
	n, _ := strconv.ParseInt(id, 10, 64)
	return n
}

// checkinDates returns, per registration, the event days it was checked in on.
// where is a condition on registration_checkins c / registrations r.
func checkinDates(db *sql.DB, where string, args ...any) (map[int64][]string, error) {
	rows, err := db.Query(
		`SELECT c.registration_id, DATE_FORMAT(c.event_date, '%Y-%m-%d')
		 FROM registration_checkins c JOIN registrations r ON r.id = c.registration_id
		 WHERE `+where+` ORDER BY c.event_date`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[int64][]string{}
	for rows.Next() {
		var id int64
		var d string
		if err := rows.Scan(&id, &d); err != nil {
			return nil, err
		}
		out[id] = append(out[id], d)
	}
	return out, rows.Err()
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
	if isOwner {
		notify.Send(h.DB, reg.UserID, "ti-user-x", notify.ToneWarn, "ยกเลิกการลงทะเบียนแล้ว", title, "/home")
		if organizerID.Valid && organizerID.Int64 != claims.UserID {
			notify.Send(h.DB, organizerID.Int64, "ti-user-minus", notify.ToneWarn, "มีผู้ยกเลิกการลงทะเบียน", claims.Name+" ยกเลิกการลงทะเบียน "+title, fmt.Sprintf("/events?applicants=%d", reg.EventID))
		}
	} else {
		notify.Send(h.DB, reg.UserID, "ti-user-x", notify.ToneWarn, "การลงทะเบียนของคุณถูกยกเลิก", title+" · ผู้จัดกิจกรรมยกเลิกการลงทะเบียนของคุณ", "/home")
	}
	c.Status(http.StatusNoContent)
}

type myRegistrationRow struct {
	ID                int64             `json:"id"`
	Status            string            `json:"status"`
	CheckedIn         bool              `json:"checked_in"`
	CheckedInAt       models.NullString `json:"checked_in_at"`
	RegisteredAt      string            `json:"registered_at"`
	EventID           int64             `json:"event_id"`
	Title             string            `json:"title"`
	Category          string            `json:"category"`
	DateStart         string            `json:"date_start"`
	DateEnd           models.NullString `json:"date_end"`
	EventDates        []string          `json:"event_dates"`
	CheckinDates      []string          `json:"checkin_dates"` // event days attended so far
	AttendVia         string            `json:"attend_via"`    // 'onsite' | 'online'
	DaysTotal         int               `json:"days_total"`    // days the event runs on
	WantsLaptop       bool              `json:"wants_laptop"`
	FoodAllergy       models.NullString `json:"food_allergy"`
	DietaryPref       models.NullString `json:"dietary_pref"`
	PaymentStatus     string            `json:"payment_status"`
	SlipTransferredAt models.NullString `json:"slip_transferred_at"`
	SlipAmount        models.NullFloat  `json:"slip_amount"`
	RejectReason      models.NullString `json:"payment_reject_reason"`
	Fee               models.NullFloat  `json:"fee"`
	PaymentInfo       models.NullString `json:"payment_info"`
	AttendeeNote      models.NullString `json:"attendee_note"`
	AttendMode        string            `json:"attend_mode"`
	OnlineLink        models.NullString `json:"online_link"`
	TimeRange         models.NullString `json:"time_range"`
	EventStatus       string            `json:"event_status"`
	Place             models.NullString `json:"place"`
	OrganizerName     models.NullString `json:"organizer_name"`
}

func (h *RegistrationsHandler) MyRegistrations(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	rows, err := h.DB.Query(
		`SELECT r.id, r.status, r.checked_in, r.checked_in_at, r.registered_at, r.wants_laptop, r.food_allergy, r.dietary_pref, r.payment_status, r.slip_transferred_at, r.slip_amount, r.payment_reject_reason, e.fee, e.payment_info, e.attendee_note, e.attend_mode, e.online_link,
		        e.id, e.title, e.category, e.date_start, e.date_end, e.event_dates, e.time_range, e.status, e.place, e.organizer_name
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
		var eventDates sql.NullString
		if err := rows.Scan(&r.ID, &r.Status, &checkedIn, &r.CheckedInAt, &r.RegisteredAt, &r.WantsLaptop, &r.FoodAllergy, &r.DietaryPref, &r.PaymentStatus, &r.SlipTransferredAt, &r.SlipAmount, &r.RejectReason, &r.Fee, &r.PaymentInfo, &r.AttendeeNote, &r.AttendMode, &r.OnlineLink,
			&r.EventID, &r.Title, &r.Category, &r.DateStart, &r.DateEnd, &eventDates, &r.TimeRange, &r.EventStatus, &r.Place, &r.OrganizerName); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		r.CheckedIn = checkedIn == 1
		r.EventDates = splitEventDates(eventDates.String)
		r.CheckinDates = []string{}
		r.DaysTotal = len(eventDays(r.DateStart, sql.NullString{String: r.DateEnd.String, Valid: r.DateEnd.Valid}, eventDates))
		list = append(list, r)
	}
	checked, err := checkinDates(h.DB, `r.user_id = ?`, claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	via, err := attendVia(h.DB, `user_id = ?`, claims.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	for i := range list {
		if d := checked[list[i].ID]; d != nil {
			list[i].CheckinDates = d
		}
		list[i].AttendVia = via[list[i].ID]
	}
	c.JSON(http.StatusOK, gin.H{"registrations": list})
}

type rosterRow struct {
	ID                int64             `json:"id"`
	Status            string            `json:"status"`
	CheckedIn         bool              `json:"checked_in"`    // every day of the event checked
	CheckinDates      []string          `json:"checkin_dates"` // the days checked so far
	AttendVia         string            `json:"attend_via"`    // 'onsite' | 'online'
	CheckedInAt       models.NullString `json:"checked_in_at"`
	RegisteredAt      string            `json:"registered_at"`
	UserID            int64             `json:"user_id"`
	Name              string            `json:"name"`
	Email             string            `json:"email"`
	WantsLaptop       bool              `json:"wants_laptop"`
	FoodAllergy       models.NullString `json:"food_allergy"`
	DietaryPref       models.NullString `json:"dietary_pref"`
	PaymentStatus     string            `json:"payment_status"`
	HasSlip           bool              `json:"has_slip"`
	SlipTransferredAt models.NullString `json:"slip_transferred_at"`
	SlipAmount        models.NullFloat  `json:"slip_amount"`
	SlipSubmittedAt   models.NullString `json:"slip_submitted_at"`
	RejectReason      models.NullString `json:"payment_reject_reason"`
	StudentID         models.NullString `json:"student_id"`
}

// EventRoster is the organizer/admin roster view for one event — the check-in modal's data source.
func (h *RegistrationsHandler) EventRoster(c *gin.Context) {
	var organizerID sql.NullInt64
	var dateStart string
	var dateEnd, eventDates sql.NullString
	err := h.DB.QueryRow(
		`SELECT organizer_id, DATE_FORMAT(date_start, '%Y-%m-%d'), DATE_FORMAT(date_end, '%Y-%m-%d'), event_dates FROM events WHERE id = ?`, c.Param("id"),
	).Scan(&organizerID, &dateStart, &dateEnd, &eventDates)
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
		`SELECT r.id, r.status, r.checked_in, r.checked_in_at, r.registered_at, r.wants_laptop, r.food_allergy, r.dietary_pref, r.payment_status,
		        r.slip_url IS NOT NULL, r.slip_transferred_at, r.slip_amount, r.slip_submitted_at, r.payment_reject_reason,
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
		if err := rows.Scan(&r.ID, &r.Status, &checkedIn, &r.CheckedInAt, &r.RegisteredAt, &r.WantsLaptop, &r.FoodAllergy, &r.DietaryPref, &r.PaymentStatus,
			&r.HasSlip, &r.SlipTransferredAt, &r.SlipAmount, &r.SlipSubmittedAt, &r.RejectReason,
			&r.UserID, &r.Name, &r.Email, &r.StudentID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		r.CheckedIn = checkedIn == 1
		r.CheckinDates = []string{}
		list = append(list, r)
	}
	checked, err := checkinDates(h.DB, `r.event_id = ?`, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	via, err := attendVia(h.DB, `event_id = ?`, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	for i := range list {
		if d := checked[list[i].ID]; d != nil {
			list[i].CheckinDates = d
		}
		list[i].AttendVia = via[list[i].ID]
	}
	// One self check-in key per day, for the link online attendees open.
	days := eventDays(dateStart, dateEnd, eventDates)
	keys := map[string]string{}
	for _, d := range days {
		keys[d] = checkinKey(c.Param("id"), d)
	}
	// checked_in on a row means every one of `days` was checked.
	c.JSON(http.StatusOK, gin.H{"registrations": list, "days": days, "checkin_keys": keys})
}

// formatAmount prints baht without a pointless ".00" (200, 149.50).
func formatAmount(v float64) string {
	if v == float64(int64(v)) {
		return fmt.Sprintf("%d", int64(v))
	}
	return fmt.Sprintf("%.2f", v)
}

const maxSlipLen = 3_000_000 // ~2 MB image once base64-encoded

// SubmitSlip is the payer's proof of payment for a paid event: the slip image
// plus when and how much they transferred. It moves the registration to
// 'submitted' so the organizer knows there is something to check. A slip can
// be sent again while it is still unconfirmed (e.g. after a rejection).
func (h *RegistrationsHandler) SubmitSlip(c *gin.Context) {
	var body struct {
		Slip          string  `json:"slip"`
		TransferredAt string  `json:"transferred_at"` // "2006-01-02T15:04", Thai local time
		Amount        float64 `json:"amount"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	if !(strings.HasPrefix(body.Slip, "data:image/png;base64,") || strings.HasPrefix(body.Slip, "data:image/jpeg;base64,")) || len(body.Slip) > maxSlipLen {
		c.JSON(http.StatusBadRequest, gin.H{"error": "สลิปต้องเป็นรูป JPG หรือ PNG ขนาดไม่เกิน 2 MB"})
		return
	}
	when, err := time.Parse("2006-01-02T15:04", body.TransferredAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุวันที่และเวลาที่โอนให้ครบ"})
		return
	}
	// The payer enters Thai local time; a transfer cannot be in the future
	// (a few minutes' slack for clocks that disagree).
	nowTH := time.Now().UTC().Add(7 * time.Hour)
	if when.After(time.Date(nowTH.Year(), nowTH.Month(), nowTH.Day(), nowTH.Hour(), nowTH.Minute(), 0, 0, time.UTC).Add(10 * time.Minute)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "วันและเวลาที่โอนต้องไม่เป็นเวลาในอนาคต"})
		return
	}
	if body.Amount <= 0 || body.Amount > maxFee {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุจำนวนเงินที่โอน"})
		return
	}

	var (
		ownerID     int64
		status      string
		title       string
		organizerID sql.NullInt64
		slipEventID int64
	)
	err = h.DB.QueryRow(
		`SELECT r.user_id, r.payment_status, e.title, e.organizer_id, e.id
		 FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`, c.Param("id"),
	).Scan(&ownerID, &status, &title, &organizerID, &slipEventID)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบรายการลงทะเบียน"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	claims, _ := middleware.CurrentUser(c)
	if ownerID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "แจ้งชำระเงินได้เฉพาะรายการลงทะเบียนของตนเอง"})
		return
	}
	switch status {
	case "none":
		c.JSON(http.StatusBadRequest, gin.H{"error": "กิจกรรมนี้ไม่มีค่าลงทะเบียนที่ต้องชำระ"})
		return
	case "paid":
		c.JSON(http.StatusBadRequest, gin.H{"error": "ผู้จัดยืนยันการชำระเงินของคุณแล้ว"})
		return
	}

	if _, err := h.DB.Exec(
		`UPDATE registrations SET payment_status = 'submitted', slip_url = ?, slip_transferred_at = ?, slip_amount = ?,
		        slip_submitted_at = NOW(), payment_reject_reason = NULL WHERE id = ?`,
		body.Slip, when.Format("2006-01-02 15:04:05"), body.Amount, c.Param("id"),
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	activitylog.Log(h.DB, &claims.UserID, "UPDATE", "แจ้งชำระเงิน: "+title)
	if organizerID.Valid {
		notify.Send(h.DB, organizerID.Int64, "ti-receipt", notify.ToneDark, "มีการแจ้งชำระเงินรอตรวจสอบ",
			fmt.Sprintf("%s ส่งสลิป %s บาท · %s", claims.Name, formatAmount(body.Amount), title), fmt.Sprintf("/events?applicants=%d", slipEventID))
	}
	c.JSON(http.StatusOK, gin.H{"payment_status": "submitted"})
}

// GetSlip returns one registration's slip with what the payer declared. Slips
// show account details, so only the payer, the event's organizer and admins
// may read one — and they are never included in list responses.
func (h *RegistrationsHandler) GetSlip(c *gin.Context) {
	var (
		ownerID       int64
		organizerID   sql.NullInt64
		slip          sql.NullString
		transferredAt sql.NullString
		amount        sql.NullFloat64
		submittedAt   sql.NullInt64
		fee           sql.NullFloat64
	)
	err := h.DB.QueryRow(
		`SELECT r.user_id, e.organizer_id, r.slip_url, r.slip_transferred_at, r.slip_amount, UNIX_TIMESTAMP(r.slip_submitted_at), e.fee
		 FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`, c.Param("id"),
	).Scan(&ownerID, &organizerID, &slip, &transferredAt, &amount, &submittedAt, &fee)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบรายการลงทะเบียน"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	claims, _ := middleware.CurrentUser(c)
	allowed := claims.Role == "admin" || ownerID == claims.UserID ||
		(claims.Role == "organizer" && organizerID.Valid && organizerID.Int64 == claims.UserID)
	if !allowed {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์ดูสลิปนี้"})
		return
	}
	if !slip.Valid {
		c.JSON(http.StatusNotFound, gin.H{"error": "ยังไม่มีการส่งสลิป"})
		return
	}
	resp := gin.H{"slip": slip.String, "transferred_at": transferredAt.String, "amount": amount.Float64, "fee": fee.Float64}
	if submittedAt.Valid {
		resp["submitted_at"] = time.Unix(submittedAt.Int64, 0).UTC().Format(time.RFC3339)
	}
	c.JSON(http.StatusOK, resp)
}

// SetPayment is the organizer's (or an admin's) verdict on a registrant's
// payment. Payment happens outside the system (bank transfer / PromptPay), so
// this records that the organizer checked it:
//
//	confirm — payment accepted (with or without a slip, e.g. paid in cash)
//	reject  — the slip cannot be accepted; a reason is required and shown to the payer
//	reset   — undo a confirmation or rejection
func (h *RegistrationsHandler) SetPayment(c *gin.Context) {
	var body struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	reason := truncateRunes(strings.TrimSpace(body.Reason), 200)
	if body.Action != "confirm" && body.Action != "reject" && body.Action != "reset" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	if body.Action == "reject" && reason == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเหตุผลที่ไม่ผ่าน เพื่อให้ผู้สมัครแก้ไขได้"})
		return
	}

	var (
		organizerID sql.NullInt64
		current     string
		title       string
		studentID   int64
		hasSlip     bool
	)
	err := h.DB.QueryRow(
		`SELECT e.organizer_id, r.payment_status, e.title, r.user_id, r.slip_url IS NOT NULL
		 FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`, c.Param("id"),
	).Scan(&organizerID, &current, &title, &studentID, &hasSlip)
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
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์ยืนยันการชำระเงินของกิจกรรมนี้"})
		return
	}
	if current == "none" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รายการนี้ไม่มีค่าลงทะเบียนที่ต้องชำระ"})
		return
	}

	var next string
	switch body.Action {
	case "confirm":
		next = "paid"
	case "reject":
		next = "rejected"
	default: // reset: back to waiting — for a check if a slip is on file, else for the payer
		next = "pending"
		if hasSlip {
			next = "submitted"
		}
	}
	var rejectReason any
	if next == "rejected" {
		rejectReason = reason
	}
	if _, err := h.DB.Exec(
		`UPDATE registrations SET payment_status = ?, paid_at = IF(? = 'paid', NOW(), NULL), payment_reject_reason = ? WHERE id = ?`,
		next, next, rejectReason, c.Param("id"),
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if next != current {
		switch next {
		case "paid":
			activitylog.Log(h.DB, &claims.UserID, "UPDATE", "ยืนยันการชำระเงิน: "+title)
			notify.Send(h.DB, studentID, "ti-receipt-2", notify.ToneAccent, "ยืนยันการชำระเงินแล้ว", title+" · ผู้จัดตรวจสอบการชำระค่าลงทะเบียนของคุณเรียบร้อย", "/my-registrations")
		case "rejected":
			activitylog.Log(h.DB, &claims.UserID, "UPDATE", "ไม่ผ่านการตรวจสลิป: "+title)
			notify.Send(h.DB, studentID, "ti-receipt-off", notify.ToneWarn, "หลักฐานการชำระเงินไม่ผ่าน", title+" · "+reason+" · กรุณาส่งสลิปใหม่", "/my-registrations")
		default:
			activitylog.Log(h.DB, &claims.UserID, "UPDATE", "ยกเลิกผลการตรวจการชำระเงิน: "+title)
			notify.Send(h.DB, studentID, "ti-receipt", notify.ToneWarn, "สถานะการชำระเงินกลับเป็นรอตรวจสอบ", title+" · กรุณาติดต่อผู้จัดกิจกรรมหากมีข้อสงสัย", "/my-registrations")
		}
	}
	c.JSON(http.StatusOK, gin.H{"payment_status": next})
}

// truncateRunes cuts s to at most n characters (not bytes — Thai text is multi-byte).
func truncateRunes(s string, n int) string {
	r := []rune(s)
	if len(r) > n {
		return string(r[:n])
	}
	return s
}

func scanRegistration(row interface{ Scan(dest ...any) error }) (models.Registration, error) {
	var r models.Registration
	var checkedIn int
	err := row.Scan(&r.ID, &r.EventID, &r.UserID, &r.Status, &checkedIn, &r.CheckedInAt, &r.RegisteredAt, &r.UpdatedAt)
	r.CheckedIn = checkedIn == 1
	return r, err
}
