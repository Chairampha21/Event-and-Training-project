package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
	"cpsu-etms-backend/internal/notify"
)

type EventsHandler struct {
	DB *sql.DB
}

func NewEventsHandler(db *sql.DB) *EventsHandler {
	return &EventsHandler{DB: db}
}

// todayTH is "today" on the Thai calendar regardless of the DB server's own
// timezone — registration windows are entered as Thai local dates.
const todayTH = `DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR)`

// effectiveStatusSQL is the status everyone outside this package should see:
// the stored status, narrowed by the registration window. An 'open' event
// whose window hasn't started reads as 'soon', and one whose window has passed
// reads as 'closed' — so it flips on the right day without a scheduled job.
const effectiveStatusSQL = `CASE
    WHEN status = 'open' AND reg_start IS NOT NULL AND ` + todayTH + ` < reg_start THEN 'soon'
    WHEN status IN ('open', 'full') AND reg_end IS NOT NULL AND ` + todayTH + ` > reg_end THEN 'closed'
    ELSE status END`

const eventFields = `
  id, title, description, category, subcategory, poster_url,
  organizer_id, organizer_name,
  day_mode, date_start, date_end, event_dates, event_times, time_range, reg_start, reg_end,
  attend_mode, place, online_link, capacity, capacity_onsite, capacity_online,
  budget_planned, budget_other, budget_actual,
  attendee_note, loan_laptop_qty, ask_dietary, issue_certificate, fee, payment_info, refund_method, refund_note,
  ` + effectiveStatusSQL + ` AS status, cycle_stage,
  pretest_enabled, pretest_link, pretest_pass_pct, pretest_time_limit_min,
  cert_template_url, cert_signer_name, cert_signer_title, cert_signature_url, cert_layout,
  email_on_register, email_before_event, email_after_event,
  is_listed, created_at, updated_at,
  (SELECT COUNT(*) FROM registrations reg WHERE reg.event_id = events.id) AS registered_count,
  (SELECT COUNT(*) FROM registrations reg WHERE reg.event_id = events.id AND reg.wants_laptop = 1) AS loan_laptop_taken,
  (SELECT COUNT(*) FROM registrations reg WHERE reg.event_id = events.id AND reg.attend_via = 'online') AS registered_online,
  (SELECT COUNT(*) FROM registrations reg WHERE reg.event_id = events.id AND reg.` + payerSQL + `) AS payer_count
`

// payerSQL matches a registration whose money the organizer holds (slip sent
// or payment confirmed) and has not given back yet.
const payerSQL = `payment_status IN ('submitted', 'paid')`

var refundMethodLabel = map[string]string{
	"none":       "ไม่คืนเงิน",
	"department": "รับเงินคืนที่ภาควิชา",
	"transfer":   "โอนคืนทางพร้อมเพย์",
}

const maxRefundNote = 300

// refundText is the refund arrangement as one line for notifications.
func refundText(method, note string) string {
	s := refundMethodLabel[method]
	if note != "" {
		s += " · " + note
	}
	return s
}

func scanEvent(row interface{ Scan(dest ...any) error }) (models.Event, error) {
	var e models.Event
	var pretestEnabled, emailOnRegister, emailBeforeEvent, emailAfterEvent, isListed int
	var eventDates, eventTimes sql.NullString
	err := row.Scan(
		&e.ID, &e.Title, &e.Description, &e.Category, &e.Subcategory, &e.PosterURL,
		&e.OrganizerID, &e.OrganizerName,
		&e.DayMode, &e.DateStart, &e.DateEnd, &eventDates, &eventTimes, &e.TimeRange, &e.RegStart, &e.RegEnd,
		&e.AttendMode, &e.Place, &e.OnlineLink, &e.Capacity, &e.CapacityOnsite, &e.CapacityOnline,
		&e.BudgetPlanned, &e.BudgetOther, &e.BudgetActual,
		&e.AttendeeNote, &e.LoanLaptopQty, &e.AskDietary, &e.IssueCertificate, &e.Fee, &e.PaymentInfo, &e.RefundMethod, &e.RefundNote,
		&e.Status, &e.CycleStage,
		&pretestEnabled, &e.PretestLink, &e.PretestPassPct, &e.PretestTimeLimitMin,
		&e.CertTemplateURL, &e.CertSignerName, &e.CertSignerTitle, &e.CertSignatureURL, &e.CertLayout,
		&emailOnRegister, &emailBeforeEvent, &emailAfterEvent,
		&isListed, &e.CreatedAt, &e.UpdatedAt,
		&e.RegisteredCount, &e.LoanLaptopTaken, &e.RegisteredOnline, &e.PayerCount,
	)
	e.BudgetTotal = budgetTotal(e.BudgetPlanned, e.BudgetOther)
	e.EventDates = splitEventDates(eventDates.String)
	e.EventTimes = splitEventDates(eventTimes.String)
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
	// A deleted event whose payers are not all refunded yet stays visible to
	// the people who manage it, so the refunds can be ticked off.
	if claims, ok := middleware.CurrentUser(c); ok && (claims.Role == "admin" || claims.Role == "organizer") {
		owing := "(is_listed = 0 AND EXISTS (SELECT 1 FROM registrations rr WHERE rr.event_id = events.id AND rr." + payerSQL + ")"
		if claims.Role == "organizer" {
			owing += " AND organizer_id = ?"
			args = append(args, claims.UserID)
		}
		clauses[0] = "(is_listed = 1 OR " + owing + "))"
	}

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
	if err := h.hideOnlineLinks(c, events); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"events": events})
}

// hideOnlineLinks blanks the online join link on every event the caller is not
// entitled to join: the link goes only to students registered for that event,
// to the organizer who owns it, and to admins. It has to happen here on the
// server — hiding it in the page alone would still hand the link to anyone
// who reads the API response. has_online_link stays set so the page can say
// "shown after you register" instead of pretending there is no link.
func (h *EventsHandler) hideOnlineLinks(c *gin.Context, events []models.Event) error {
	claims, signedIn := middleware.CurrentUser(c)
	registered := map[int64]bool{}
	if signedIn && isParticipant(claims.Role) {
		rows, err := h.DB.Query(`SELECT event_id FROM registrations WHERE user_id = ?`, claims.UserID)
		if err != nil {
			return err
		}
		defer rows.Close()
		for rows.Next() {
			var id int64
			if err := rows.Scan(&id); err != nil {
				return err
			}
			registered[id] = true
		}
		if err := rows.Err(); err != nil {
			return err
		}
	}
	for i := range events {
		e := &events[i]
		e.HasOnlineLink = e.OnlineLink.Valid && e.OnlineLink.String != ""
		allowed := signedIn && (claims.Role == "admin" ||
			(claims.Role == "organizer" && e.OrganizerID.Valid && e.OrganizerID.Int64 == claims.UserID) ||
			(isParticipant(claims.Role) && registered[e.ID]))
		if !allowed {
			e.OnlineLink = models.NullString{}
		}
	}
	return nil
}

type eventBody struct {
	Title               string   `json:"title"`
	Description         *string  `json:"description"`
	Category            string   `json:"category"`
	Subcategory         *string  `json:"subcategory"`
	PosterURL           *string  `json:"poster_url"`
	OrganizerID         *int64   `json:"organizer_id"`
	OrganizerName       *string  `json:"organizer_name"`
	DayMode             string   `json:"day_mode"`
	DateStart           string   `json:"date_start"`
	DateEnd             *string  `json:"date_end"`
	EventDates          []string `json:"event_dates"`
	EventTimes          []string `json:"event_times"`
	TimeRange           *string  `json:"time_range"`
	RegStart            *string  `json:"reg_start"`
	RegEnd              *string  `json:"reg_end"`
	AttendMode          string   `json:"attend_mode"`
	Place               *string  `json:"place"`
	OnlineLink          *string  `json:"online_link"`
	Capacity            *int     `json:"capacity"`
	CapacityOnsite      *int     `json:"capacity_onsite"`
	CapacityOnline      *int     `json:"capacity_online"`
	BudgetPlanned       *float64 `json:"budget_planned"`
	BudgetOther         *float64 `json:"budget_other"`
	AttendeeNote        *string  `json:"attendee_note"`
	LoanLaptopQty       *int     `json:"loan_laptop_qty"`
	AskDietary          *bool    `json:"ask_dietary"`
	IssueCertificate    *bool    `json:"issue_certificate"`
	Fee                 *float64 `json:"fee"`
	PaymentInfo         *string  `json:"payment_info"`
	RefundMethod        *string  `json:"refund_method"`
	RefundNote          *string  `json:"refund_note"`
	Status              *string  `json:"status"`
	CycleStage          *int     `json:"cycle_stage"`
	PretestEnabled      *bool    `json:"pretest_enabled"`
	PretestLink         *string  `json:"pretest_link"`
	PretestPassPct      *int     `json:"pretest_pass_pct"`
	PretestTimeLimitMin *int     `json:"pretest_time_limit_min"`
	CertTemplateURL     *string  `json:"cert_template_url"`
	CertSignerName      *string  `json:"cert_signer_name"`
	CertSignerTitle     *string  `json:"cert_signer_title"`
	CertSignatureURL    *string  `json:"cert_signature_url"`
	CertLayout          *string  `json:"cert_layout"`
	EmailOnRegister     *bool    `json:"email_on_register"`
	EmailBeforeEvent    *bool    `json:"email_before_event"`
	EmailAfterEvent     *bool    `json:"email_after_event"`
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
	if b.Status != nil && !validStatuses[*b.Status] {
		return "สถานะกิจกรรมไม่ถูกต้อง"
	}
	for _, n := range []*int{b.Capacity, b.CapacityOnsite, b.CapacityOnline} {
		if n != nil && (*n < 0 || *n > maxCapacity) {
			return "จำนวนที่รับไม่ถูกต้อง"
		}
	}
	if b.AttendMode == "hybrid" {
		if *b.CapacityOnsite < minCapacity || *b.CapacityOnline < minCapacity {
			return capacityTooSmall
		}
	} else if b.Capacity == nil || *b.Capacity < minCapacity {
		return capacityTooSmall
	}
	return ""
}

// minCapacity: an event takes at least 2 people (0 or 1 seat is a typo, not an event).
// A hybrid event needs it on each side, onsite and online.
const minCapacity = 2

var capacityTooSmall = fmt.Sprintf("จำนวนที่รับต้องมีอย่างน้อย %d คน", minCapacity)

var validStatuses = map[string]bool{"open": true, "closed": true, "soon": true, "full": true, "done": true}

// maxCapacity is a sanity cap on seats; it also keeps the value inside INT.
const maxCapacity = 100000

// wholeNumber reads a JSON number that must be a whole number in [min, max].
func wholeNumber(v any, min, max int) (int, bool) {
	n, ok := v.(float64)
	if !ok || n != float64(int(n)) || int(n) < min || int(n) > max {
		return 0, false
	}
	return int(n), true
}

// validateEventEdit checks the fields an edit may send that Create checks in
// validateEventBody, against the event as it will be after the edit — so a
// partial update can't leave it without a title, with a mode or status the
// database rejects, or with fewer seats than people already registered.
func validateEventEdit(raw map[string]any, existing models.Event) string {
	for _, f := range []string{"title", "category"} {
		v, present := raw[f]
		if !present {
			continue
		}
		s, _ := v.(string)
		if strings.TrimSpace(s) == "" {
			if f == "title" {
				return "ระบุชื่อกิจกรรม"
			}
			return "ระบุประเภทกิจกรรม"
		}
		raw[f] = strings.TrimSpace(s)
	}
	if v, present := raw["day_mode"]; present {
		if s, _ := v.(string); s != "single" && s != "multi" {
			return "day_mode ไม่ถูกต้อง"
		}
	}
	attendMode := existing.AttendMode
	if v, present := raw["attend_mode"]; present {
		s, _ := v.(string)
		if s != "onsite" && s != "online" && s != "hybrid" {
			return "attend_mode ไม่ถูกต้อง"
		}
		attendMode = s
	}
	if v, present := raw["status"]; present {
		if s, _ := v.(string); !validStatuses[s] {
			return "สถานะกิจกรรมไม่ถูกต้อง"
		}
	}
	if v, present := raw["cycle_stage"]; present {
		if _, ok := wholeNumber(v, 0, 4); !ok {
			return "ขั้นตอนของกิจกรรมไม่ถูกต้อง"
		}
	}
	if v, present := raw["date_start"]; present {
		if s, _ := v.(string); !isoDateRe.MatchString(s) {
			return "วันที่จัดกิจกรรมไม่ถูกต้อง"
		}
	}
	if v, present := raw["date_end"]; present && v != nil {
		s, _ := v.(string)
		if s == "" {
			raw["date_end"] = nil
		} else if !isoDateRe.MatchString(s) {
			return "วันที่จัดกิจกรรมไม่ถูกต้อง"
		}
	}

	// Seats: whole numbers, never below the people already registered.
	capacity := existing.Capacity
	onsite, online := existing.CapacityOnsite, existing.CapacityOnline
	for _, f := range []string{"capacity", "capacity_onsite", "capacity_online"} {
		v, present := raw[f]
		if !present {
			continue
		}
		if v == nil && f != "capacity" {
			if f == "capacity_onsite" {
				onsite.Valid = false
			} else {
				online.Valid = false
			}
			continue
		}
		n, ok := wholeNumber(v, 0, maxCapacity)
		if !ok {
			return "จำนวนที่รับไม่ถูกต้อง"
		}
		switch f {
		case "capacity":
			capacity = n
		case "capacity_onsite":
			onsite.Valid, onsite.Int64 = true, int64(n)
		default:
			online.Valid, online.Int64 = true, int64(n)
		}
	}
	regOnline := existing.RegisteredOnline
	regOnsite := existing.RegisteredCount - regOnline
	if attendMode == "hybrid" {
		if !onsite.Valid || !online.Valid {
			return "กิจกรรมแบบ hybrid ต้องระบุจำนวนรับ onsite และ online"
		}
		_, touchOn := raw["capacity_onsite"]
		_, touchOl := raw["capacity_online"]
		if (touchOn || touchOl) && (onsite.Int64 < minCapacity || online.Int64 < minCapacity) {
			return capacityTooSmall
		}
		if int(onsite.Int64) < regOnsite {
			return fmt.Sprintf("มีผู้สมัครแบบ Onsite แล้ว %d คน จึงลดจำนวนที่รับต่ำกว่านี้ไม่ได้", regOnsite)
		}
		if int(online.Int64) < regOnline {
			return fmt.Sprintf("มีผู้สมัครแบบ Online แล้ว %d คน จึงลดจำนวนที่รับต่ำกว่านี้ไม่ได้", regOnline)
		}
	} else if _, present := raw["capacity"]; present && capacity < minCapacity {
		return capacityTooSmall
	} else if present && capacity < existing.RegisteredCount {
		return fmt.Sprintf("มีผู้สมัครแล้ว %d คน จึงลดจำนวนที่รับต่ำกว่านี้ไม่ได้", existing.RegisteredCount)
	}
	return ""
}

// splitEventDates turns the stored comma-separated list into a slice (never nil,
// so it serialises as [] rather than null).
func splitEventDates(s string) []string {
	if s == "" {
		return []string{}
	}
	return strings.Split(s, ",")
}

var dayTimeRe = regexp.MustCompile(`^([01]\d|2[0-3]):[0-5]\d-([01]\d|2[0-3]):[0-5]\d$`)

// normalizeEventDays validates the individually-picked days of a multi-day
// event and returns them sorted and de-duplicated. times is optional: when
// given it must line up one-to-one with dates ("HH:MM-HH:MM" each — every day
// can have its own hours) and comes back reordered to match; when empty the
// event has no per-day times and nil is returned for it.
func normalizeEventDays(dates, times []string) ([]string, []string, string) {
	if len(times) > 0 && len(times) != len(dates) {
		return nil, nil, "เวลาของแต่ละวันไม่ครบตามจำนวนวันที่เลือก"
	}
	timeOf := map[string]string{}
	out := []string{}
	for i, d := range dates {
		d = strings.TrimSpace(d)
		if _, err := time.Parse("2006-01-02", d); err != nil || !isoDateRe.MatchString(d) {
			return nil, nil, "วันที่จัดกิจกรรมไม่ถูกต้อง"
		}
		if _, dup := timeOf[d]; dup {
			continue
		}
		t := ""
		if len(times) > 0 {
			t = strings.TrimSpace(times[i])
			if !dayTimeRe.MatchString(t) {
				return nil, nil, "กรุณาระบุเวลาเริ่มและเวลาสิ้นสุดของ " + thaiDate(d)
			}
			if t[6:] <= t[:5] {
				return nil, nil, "เวลาสิ้นสุดของ " + thaiDate(d) + " ต้องหลังเวลาเริ่ม"
			}
		}
		timeOf[d] = t
		out = append(out, d)
	}
	if len(out) < 2 {
		return nil, nil, "กิจกรรมแบบหลายวันต้องเลือกอย่างน้อย 2 วัน"
	}
	if len(out) > 60 {
		return nil, nil, "เลือกวันจัดกิจกรรมได้ไม่เกิน 60 วัน"
	}
	sort.Strings(out)
	if len(times) == 0 {
		return out, nil, ""
	}
	outTimes := make([]string, len(out))
	for i, d := range out {
		outTimes[i] = timeOf[d]
	}
	return out, outTimes, ""
}

// anySliceToStrings converts a JSON array decoded into []any to []string
// (non-string items become "", which the validators then reject).
func anySliceToStrings(v any) []string {
	items, _ := v.([]any)
	out := make([]string, 0, len(items))
	for _, it := range items {
		s, _ := it.(string)
		out = append(out, s)
	}
	return out
}

const (
	maxFee          = 99999999.99 // DECIMAL(10,2)
	maxAttendeeNote = 500         // runes; matches events.attendee_note
	maxLoanLaptops  = 1000        // sanity cap on notebooks an event can lend
)

// maxBudget is the largest amount the DECIMAL(12,2) budget columns can hold.
const maxBudget = 9999999999.99

// budgetTotal adds the two funding sources; null only when neither is set.
func budgetTotal(income, other models.NullFloat) models.NullFloat {
	var t models.NullFloat
	if income.Valid || other.Valid {
		t.Valid = true
		t.Float64 = income.Float64 + other.Float64
	}
	return t
}

// maxSignatureLen caps the stored signature data: URL (~1 MB image once base64-encoded).
const maxSignatureLen = 1_500_000

// validCertLayout accepts an empty value or a small JSON object. The frontend
// clamps every field when it reads the layout back, so the server only has to
// make sure it is storing well-formed JSON of a sane size.
func validCertLayout(s string) bool {
	if s == "" {
		return true
	}
	var obj map[string]any
	return len(s) <= 500 && json.Unmarshal([]byte(s), &obj) == nil
}

// validSignature accepts an empty value (no signature) or a PNG/JPEG data: URL.
func validSignature(s string) bool {
	if s == "" {
		return true
	}
	return len(s) <= maxSignatureLen &&
		(strings.HasPrefix(s, "data:image/png;base64,") || strings.HasPrefix(s, "data:image/jpeg;base64,"))
}

func validBudget(v float64) bool {
	return v >= 0 && v <= maxBudget
}

var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// validateRegWindow checks the registration window against itself and against
// the event's last day. Empty strings mean "not set" on that side. ISO dates
// compare correctly as plain strings.
func validateRegWindow(regStart, regEnd, dateStart, dateEnd string) string {
	for _, d := range []string{regStart, regEnd} {
		if d == "" {
			continue
		}
		if _, err := time.Parse("2006-01-02", d); err != nil || !isoDateRe.MatchString(d) {
			return "วันที่รับสมัครไม่ถูกต้อง"
		}
	}
	if regStart != "" && regEnd != "" && regEnd < regStart {
		return "วันปิดรับสมัครต้องไม่ก่อนวันเปิดรับสมัคร"
	}
	lastDay := dateStart
	if dateEnd > lastDay {
		lastDay = dateEnd
	}
	if lastDay != "" {
		if (regEnd != "" && regEnd > lastDay) || (regStart != "" && regStart > lastDay) {
			return "ช่วงเวลารับสมัครต้องไม่เกินวันจัดกิจกรรม"
		}
	}
	return ""
}

func strOrEmpty(p *string) string {
	if p == nil {
		return ""
	}
	return strings.TrimSpace(*p)
}

func thaiDate(iso string) string {
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return iso
	}
	months := []string{"มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"}
	return fmt.Sprintf("%d %s %d", t.Day(), months[t.Month()-1], t.Year()+543)
}

func (h *EventsHandler) Create(c *gin.Context) {
	var b eventBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	// Multi-day events may send the exact days picked; the first/last of those
	// then define date_start/date_end.
	var eventDates, eventTimes any
	if b.DayMode == "multi" && len(b.EventDates) > 0 {
		dates, times, msg := normalizeEventDays(b.EventDates, b.EventTimes)
		if msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		b.DateStart = dates[0]
		last := dates[len(dates)-1]
		b.DateEnd = &last
		eventDates = strings.Join(dates, ",")
		if times != nil {
			eventTimes = strings.Join(times, ",")
		}
	}
	if msg := validateEventBody(b); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	regStart, regEnd := strOrEmpty(b.RegStart), strOrEmpty(b.RegEnd)
	if msg := validateRegWindow(regStart, regEnd, b.DateStart, strOrEmpty(b.DateEnd)); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	// A new event cannot be dated in the past (Thai time). Only checked on
	// create: an existing event keeps its dates when it is edited later.
	today := time.Now().UTC().Add(7 * time.Hour).Format("2006-01-02")
	for _, d := range append([]string{b.DateStart, regStart, regEnd}, b.EventDates...) {
		if d != "" && d < today {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ไม่สามารถเลือกวันที่ผ่านมาแล้วได้"})
			return
		}
	}
	if (b.BudgetPlanned != nil && !validBudget(*b.BudgetPlanned)) || (b.BudgetOther != nil && !validBudget(*b.BudgetOther)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "งบประมาณไม่ถูกต้อง"})
		return
	}

	if b.CertSignatureURL != nil && !validSignature(*b.CertSignatureURL) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปลายเซ็นต้องเป็นไฟล์ PNG หรือ JPG ขนาดไม่เกิน 1 MB"})
		return
	}
	if b.CertSignatureURL != nil && *b.CertSignatureURL == "" {
		b.CertSignatureURL = nil
	}
	if b.CertLayout != nil && !validCertLayout(*b.CertLayout) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "การจัดวางข้อความบนเกียรติบัตรไม่ถูกต้อง"})
		return
	}
	if b.CertLayout != nil && *b.CertLayout == "" {
		b.CertLayout = nil
	}
	// Fee: a free event stores NULL (not 0), and keeps no payment instructions
	// or refund arrangement.
	var fee any
	payInfo := ""
	refundMethod, refundNote := "none", ""
	if b.Fee != nil && *b.Fee != 0 {
		if b.RefundMethod != nil {
			if _, ok := refundMethodLabel[*b.RefundMethod]; !ok {
				c.JSON(http.StatusBadRequest, gin.H{"error": "วิธีคืนเงินไม่ถูกต้อง"})
				return
			}
			refundMethod = *b.RefundMethod
		}
		refundNote = strOrEmpty(b.RefundNote)
		if len([]rune(refundNote)) > maxRefundNote {
			c.JSON(http.StatusBadRequest, gin.H{"error": "รายละเอียดการคืนเงินยาวเกิน 300 ตัวอักษร"})
			return
		}
		if *b.Fee < 0 || *b.Fee > maxFee {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ค่าลงทะเบียนไม่ถูกต้อง"})
			return
		}
		fee = *b.Fee
		payInfo = strOrEmpty(b.PaymentInfo)
		if len([]rune(payInfo)) > maxAttendeeNote {
			c.JSON(http.StatusBadRequest, gin.H{"error": "วิธีชำระเงินยาวเกิน 500 ตัวอักษร"})
			return
		}
	}
	note := strOrEmpty(b.AttendeeNote)
	if len([]rune(note)) > maxAttendeeNote {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อความถึงผู้เข้าร่วมยาวเกิน 500 ตัวอักษร"})
		return
	}
	var loanQty any // NULL unless the organizer has notebooks to lend
	if b.LoanLaptopQty != nil && *b.LoanLaptopQty != 0 {
		if *b.LoanLaptopQty < 0 || *b.LoanLaptopQty > maxLoanLaptops {
			c.JSON(http.StatusBadRequest, gin.H{"error": "จำนวนโน้ตบุ๊กให้ยืมไม่ถูกต้อง"})
			return
		}
		loanQty = *b.LoanLaptopQty
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
		day_mode, date_start, date_end, event_dates, event_times, time_range, reg_start, reg_end,
		attend_mode, place, online_link, capacity, capacity_onsite, capacity_online,
		budget_planned, budget_other,
		attendee_note, loan_laptop_qty, ask_dietary, issue_certificate, fee, payment_info, refund_method, refund_note,
		status, cycle_stage,
		pretest_enabled, pretest_link, pretest_pass_pct, pretest_time_limit_min,
		cert_template_url, cert_signer_name, cert_signer_title, cert_signature_url, cert_layout,
		email_on_register, email_before_event, email_after_event
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		strings.TrimSpace(b.Title), b.Description, strings.TrimSpace(b.Category), b.Subcategory, b.PosterURL,
		organizerID, b.OrganizerName,
		b.DayMode, b.DateStart, b.DateEnd, eventDates, eventTimes, b.TimeRange, nullIfEmpty(regStart), nullIfEmpty(regEnd),
		b.AttendMode, b.Place, b.OnlineLink, capacity, b.CapacityOnsite, b.CapacityOnline,
		b.BudgetPlanned, b.BudgetOther,
		nullIfEmpty(note), loanQty, b.AskDietary != nil && *b.AskDietary, b.IssueCertificate == nil || *b.IssueCertificate, fee, nullIfEmpty(payInfo), refundMethod, nullIfEmpty(refundNote),
		status, cycleStage,
		pretestEnabled, b.PretestLink, b.PretestPassPct, b.PretestTimeLimitMin,
		b.CertTemplateURL, b.CertSignerName, b.CertSignerTitle, b.CertSignatureURL, b.CertLayout,
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

	event.HasOnlineLink = event.OnlineLink.Valid && event.OnlineLink.String != ""
	activitylog.Log(h.DB, &claims.UserID, "CREATE", "สร้างกิจกรรม: "+b.Title)
	// event.Status is already narrowed by the registration window.
	switch {
	case event.Status == "open":
		notify.SendToStudents(h.DB, "ti-sparkles", notify.ToneDark, "กิจกรรมใหม่", event.Title+" เปิดรับสมัครแล้ว", fmt.Sprintf("/home?event=%d", event.ID))
	case event.Status == "soon" && status == "open" && regStart != "":
		notify.SendToStudents(h.DB, "ti-sparkles", notify.ToneDark, "กิจกรรมใหม่", event.Title+" · เปิดรับสมัคร "+thaiDate(regStart), fmt.Sprintf("/home?event=%d", event.ID))
	}
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

	if msg := validateEventEdit(raw, existing); msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	updatable := map[string]bool{
		"title": true, "description": true, "category": true, "subcategory": true, "poster_url": true,
		"organizer_name": true, "day_mode": true, "date_start": true, "date_end": true, "time_range": true,
		"reg_start": true, "reg_end": true, "event_dates": true, "event_times": true,
		"attend_mode": true, "place": true, "online_link": true, "capacity": true, "capacity_onsite": true, "capacity_online": true,
		"status": true, "cycle_stage": true, "budget_planned": true, "budget_other": true, "budget_actual": true,
		"attendee_note": true, "loan_laptop_qty": true, "ask_dietary": true, "issue_certificate": true, "fee": true, "payment_info": true,
		"refund_method": true, "refund_note": true,
		"pretest_enabled": true, "pretest_link": true, "pretest_pass_pct": true, "pretest_time_limit_min": true,
		"cert_template_url": true, "cert_signer_name": true, "cert_signer_title": true, "cert_signature_url": true, "cert_layout": true,
		"email_on_register": true, "email_before_event": true, "email_after_event": true,
	}

	// Signature image: a PNG/JPEG data: URL of sane size; "" clears it.
	if v, present := raw["cert_signature_url"]; present && v != nil {
		str, ok := v.(string)
		if !ok || !validSignature(str) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "รูปลายเซ็นต้องเป็นไฟล์ PNG หรือ JPG ขนาดไม่เกิน 1 MB"})
			return
		}
		raw["cert_signature_url"] = nullIfEmpty(str)
	}

	if v, present := raw["cert_layout"]; present && v != nil {
		str, ok := v.(string)
		if !ok || !validCertLayout(str) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "การจัดวางข้อความบนเกียรติบัตรไม่ถูกต้อง"})
			return
		}
		raw["cert_layout"] = nullIfEmpty(str)
	}

	// Fee and how to pay. 0 means free and is stored as NULL.
	if v, present := raw["fee"]; present && v != nil {
		n, ok := v.(float64)
		if !ok || n < 0 || n > maxFee {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ค่าลงทะเบียนไม่ถูกต้อง"})
			return
		}
		if n == 0 {
			raw["fee"] = nil
		}
	}
	if v, present := raw["payment_info"]; present && v != nil {
		str, ok := v.(string)
		str = strings.TrimSpace(str)
		if !ok || len([]rune(str)) > maxAttendeeNote {
			c.JSON(http.StatusBadRequest, gin.H{"error": "วิธีชำระเงินยาวเกิน 500 ตัวอักษร"})
			return
		}
		raw["payment_info"] = nullIfEmpty(str)
	}
	// How paid money is given back. It can change later, but not to "no
	// refund" once someone has paid on the promise of one.
	if v, present := raw["refund_method"]; present {
		str, ok := v.(string)
		if _, known := refundMethodLabel[str]; !ok || !known {
			c.JSON(http.StatusBadRequest, gin.H{"error": "วิธีคืนเงินไม่ถูกต้อง"})
			return
		}
		if str == "none" && existing.RefundMethod != "none" && existing.PayerCount > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("มีผู้ชำระเงินแล้ว %d คนโดยแจ้งว่าจะได้เงินคืน จึงเปลี่ยนเป็นไม่คืนเงินไม่ได้", existing.PayerCount)})
			return
		}
	}
	if v, present := raw["refund_note"]; present && v != nil {
		str, ok := v.(string)
		str = strings.TrimSpace(str)
		if !ok || len([]rune(str)) > maxRefundNote {
			c.JSON(http.StatusBadRequest, gin.H{"error": "รายละเอียดการคืนเงินยาวเกิน 300 ตัวอักษร"})
			return
		}
		raw["refund_note"] = nullIfEmpty(str)
	}
	for _, f := range []string{"ask_dietary", "issue_certificate"} {
		v, present := raw[f]
		if !present {
			continue
		}
		if _, ok := v.(bool); !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
			return
		}
	}

	// Message to attendees: trimmed, capped, and "" stored as NULL.
	if v, present := raw["attendee_note"]; present && v != nil {
		str, ok := v.(string)
		str = strings.TrimSpace(str)
		if !ok || len([]rune(str)) > maxAttendeeNote {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อความถึงผู้เข้าร่วมยาวเกิน 500 ตัวอักษร"})
			return
		}
		raw["attendee_note"] = nullIfEmpty(str)
	}
	// Loan notebooks: a whole number, and never fewer than students have
	// already been promised. 0 means nothing to lend (stored as NULL).
	if v, present := raw["loan_laptop_qty"]; present && v != nil {
		n, ok := v.(float64)
		if !ok || n < 0 || n > maxLoanLaptops || n != float64(int(n)) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "จำนวนโน้ตบุ๊กให้ยืมไม่ถูกต้อง"})
			return
		}
		if int(n) < existing.LoanLaptopTaken {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("มีผู้ขอยืมโน้ตบุ๊กแล้ว %d เครื่อง จึงลดจำนวนต่ำกว่านี้ไม่ได้", existing.LoanLaptopTaken)})
			return
		}
		if n == 0 {
			raw["loan_laptop_qty"] = nil
		}
	} else if present && existing.LoanLaptopTaken > 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("มีผู้ขอยืมโน้ตบุ๊กแล้ว %d เครื่อง จึงยกเลิกการให้ยืมไม่ได้", existing.LoanLaptopTaken)})
		return
	}

	// Budget: both amounts must be sane numbers (null clears). The amount
	// actually spent can only be recorded once the event has finished.
	for _, f := range []string{"budget_planned", "budget_other", "budget_actual"} {
		v, present := raw[f]
		if !present || v == nil {
			continue
		}
		n, ok := v.(float64)
		if !ok || !validBudget(n) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "จำนวนเงินไม่ถูกต้อง"})
			return
		}
	}
	if v, present := raw["budget_actual"]; present && v != nil {
		lastDay := existing.DateStart
		if existing.DateEnd.String > lastDay {
			lastDay = existing.DateEnd.String
		}
		today := time.Now().UTC().Add(7 * time.Hour).Format("2006-01-02")
		if existing.Status != "done" && today < lastDay {
			c.JSON(http.StatusBadRequest, gin.H{"error": "บันทึกงบประมาณที่ใช้จริงได้เมื่อถึงวันสุดท้ายของกิจกรรม (" + thaiDate(lastDay) + ") หรือเมื่อปิดกิจกรรมแล้ว"})
			return
		}
	}

	// The exact days of a multi-day event: store them as the comma-separated
	// list and keep date_start/date_end in step with the first/last day. A
	// single-day event never keeps a list.
	dayMode := existing.DayMode
	if s, ok := raw["day_mode"].(string); ok {
		dayMode = s
	}
	_, modeChanged := raw["day_mode"]
	// Per-day times only make sense alongside the days they belong to, so they
	// are always written together (times sent without days are ignored).
	rawTimes := anySliceToStrings(raw["event_times"])
	delete(raw, "event_times")
	if list, present := raw["event_dates"]; present || (modeChanged && dayMode == "single") {
		strs := anySliceToStrings(list)
		if dayMode == "single" || len(strs) == 0 {
			raw["event_dates"] = nil
			raw["event_times"] = nil
		} else {
			dates, times, msg := normalizeEventDays(strs, rawTimes)
			if msg != "" {
				c.JSON(http.StatusBadRequest, gin.H{"error": msg})
				return
			}
			raw["event_dates"] = strings.Join(dates, ",")
			raw["event_times"] = nil
			if times != nil {
				raw["event_times"] = strings.Join(times, ",")
			}
			raw["date_start"] = dates[0]
			raw["date_end"] = dates[len(dates)-1]
		}
	}

	// Validate the registration window as it will be after this edit (fields
	// not in the request keep their stored value).
	merged := func(field, current string) string {
		v, present := raw[field]
		if !present {
			return current
		}
		s, _ := v.(string)
		return strings.TrimSpace(s)
	}
	for _, f := range []string{"reg_start", "reg_end"} {
		if v, present := raw[f]; present {
			if s, _ := v.(string); strings.TrimSpace(s) == "" {
				raw[f] = nil // "" isn't a valid DATE — treat as cleared
			}
		}
	}
	regStart, regEnd := merged("reg_start", existing.RegStart.String), merged("reg_end", existing.RegEnd.String)
	_, touchesWindow := raw["reg_start"]
	if _, ok := raw["reg_end"]; ok {
		touchesWindow = true
	}
	if _, ok := raw["date_start"]; ok {
		touchesWindow = true
	}
	if _, ok := raw["date_end"]; ok {
		touchesWindow = true
	}
	if touchesWindow {
		if msg := validateRegWindow(regStart, regEnd, merged("date_start", existing.DateStart), merged("date_end", existing.DateEnd.String)); msg != "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
	}
	// Re-opening by hand can't beat the window: say so instead of saving
	// 'open' and still showing the event as closed/not yet open.
	if s, _ := raw["status"].(string); s == "open" {
		today := time.Now().UTC().Add(7 * time.Hour).Format("2006-01-02")
		if regEnd != "" && today > regEnd {
			c.JSON(http.StatusBadRequest, gin.H{"error": "เลยวันปิดรับสมัครแล้ว (" + thaiDate(regEnd) + ") กรุณาแก้ไขช่วงเวลารับสมัครก่อน"})
			return
		}
		if regStart != "" && today < regStart {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ยังไม่ถึงวันเปิดรับสมัคร (" + thaiDate(regStart) + ") กรุณาแก้ไขช่วงเวลารับสมัครก่อน"})
			return
		}
	}
	// Closing the event / issuing certificates ends registration for good, so
	// it can't happen before the event's last day (as it will be after this edit).
	closing := false
	if s, _ := raw["status"].(string); s == "done" {
		closing = true
	}
	if n, ok := raw["cycle_stage"].(float64); ok && n >= 4 {
		closing = true
	}
	if closing && existing.Status != "done" {
		lastDay := merged("date_start", existing.DateStart)
		if end := merged("date_end", existing.DateEnd.String); end > lastDay {
			lastDay = end
		}
		today := time.Now().UTC().Add(7 * time.Hour).Format("2006-01-02")
		if today < lastDay {
			c.JSON(http.StatusBadRequest, gin.H{"error": "ออกเกียรติบัตรหรือปิดกิจกรรมได้เมื่อถึงวันสุดท้ายของกิจกรรม (" + thaiDate(lastDay) + ")"})
			return
		}
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
	if _, ok := raw["budget_actual"]; ok && len(raw) == 1 {
		activitylog.Log(h.DB, &claims.UserID, "UPDATE", "บันทึกงบประมาณที่ใช้จริง: "+existing.Title)
	} else {
		activitylog.Log(h.DB, &claims.UserID, "UPDATE", "แก้ไขกิจกรรม: "+existing.Title)
	}
	h.notifyEventChanges(existing, event)
	// Someone other than the organizer (an admin) changed the event: its organizer should know.
	if existing.OrganizerID.Valid && existing.OrganizerID.Int64 != claims.UserID {
		notify.Send(h.DB, existing.OrganizerID.Int64, "ti-edit", notify.ToneWarn, "ผู้ดูแลระบบแก้ไขกิจกรรมของคุณ",
			existing.Title+" · แก้ไขโดย "+claims.Name+" · ตรวจสอบรายละเอียดกิจกรรมอีกครั้ง", "/events")
	}
	event.HasOnlineLink = event.OnlineLink.Valid && event.OnlineLink.String != ""
	res := gin.H{"event": event}
	// Issuing certificates (again): tell the attendees who have not been told yet.
	if _, ok := raw["cycle_stage"]; ok && event.CycleStage >= 4 && event.IsListed {
		res["cert_notified"] = h.notifyCertOpen(event)
	}
	c.JSON(http.StatusOK, res)
}

// notifyCertOpen tells an event's attendees that the certificate is open and
// the evaluation is waiting (only the evaluation, for an event that gives no
// certificates) — each registration only once, so issuing the
// certificates a second time reaches only the people checked in since.
// Returns how many were notified this time.
func (h *EventsHandler) notifyCertOpen(ev models.Event) int {
	tx, err := h.DB.Begin()
	if err != nil {
		return 0
	}
	defer tx.Rollback()
	rows, err := tx.Query(`SELECT id, user_id FROM registrations
		 WHERE event_id = ? AND status = 'attended' AND cert_notified_at IS NULL FOR UPDATE`, ev.ID)
	if err != nil {
		return 0
	}
	type target struct{ regID, userID int64 }
	var targets []target
	for rows.Next() {
		var t target
		if err := rows.Scan(&t.regID, &t.userID); err != nil {
			rows.Close()
			return 0
		}
		targets = append(targets, t)
	}
	rows.Close()
	title, msg := "ทำแบบประเมินเพื่อรับเกียรติบัตร", ev.Title+" · กรุณาทำแบบประเมินกิจกรรมเพื่อรับเกียรติบัตร"
	if !ev.IssueCertificate {
		title, msg = "ทำแบบประเมินกิจกรรม", ev.Title+" · กรุณาทำแบบประเมินกิจกรรม"
	}
	for _, t := range targets {
		notify.Send(tx, t.userID, "ti-clipboard-check", notify.ToneAccent, title, msg,
			fmt.Sprintf("/evaluate/%d", ev.ID))
		if _, err := tx.Exec(`UPDATE registrations SET cert_notified_at = NOW() WHERE id = ?`, t.regID); err != nil {
			return 0
		}
	}
	if err := tx.Commit(); err != nil {
		return 0
	}
	return len(targets)
}

// notifyEventChanges turns the meaningful differences of an edit into bell
// notifications — only on real transitions, so re-saving the form unchanged
// stays silent.
func (h *EventsHandler) notifyEventChanges(before, after models.Event) {
	// The refund arrangement changed: the people whose money is held should
	// know — even for a cancelled event that is still paying people back.
	if before.RefundMethod != after.RefundMethod || before.RefundNote.String != after.RefundNote.String {
		notify.SendToPayers(h.DB, after.ID, "ti-receipt-refund", notify.ToneWarn, "การคืนเงินมีการเปลี่ยนแปลง",
			after.Title+" · "+refundText(after.RefundMethod, after.RefundNote.String), "/my-registrations")
	}
	if !after.IsListed {
		return
	}
	if before.Status == "soon" && after.Status == "open" {
		notify.SendToStudents(h.DB, "ti-sparkles", notify.ToneDark, "กิจกรรมใหม่", after.Title+" เปิดรับสมัครแล้ว", fmt.Sprintf("/home?event=%d", after.ID))
	}
	// A new or reworded message to attendees reaches those already registered.
	if after.AttendeeNote.Valid && after.AttendeeNote != before.AttendeeNote {
		notify.SendToRegistrants(h.DB, after.ID, "ti-message-2", notify.ToneDark,
			"ข้อความจากผู้จัดกิจกรรม", after.Title+" · "+after.AttendeeNote.String,
			fmt.Sprintf("/home?event=%d", after.ID), "registered")
	}
	if before.DateStart != after.DateStart || before.DateEnd != after.DateEnd ||
		strings.Join(before.EventDates, ",") != strings.Join(after.EventDates, ",") ||
		strings.Join(before.EventTimes, ",") != strings.Join(after.EventTimes, ",") ||
		before.TimeRange != after.TimeRange || before.Place != after.Place ||
		before.AttendMode != after.AttendMode || before.OnlineLink != after.OnlineLink {
		notify.SendToRegistrants(h.DB, after.ID, "ti-calendar-event", notify.ToneWarn,
			"กิจกรรมมีการเปลี่ยนแปลง", after.Title+" · วัน เวลา หรือสถานที่มีการแก้ไข กรุณาตรวจสอบรายละเอียดอีกครั้ง",
			fmt.Sprintf("/home?event=%d", after.ID), "registered")
	}
}

// Remove is a soft delete only, matching the frontend's deleteEvent -> listed=false behavior.
//
// Everyone who paid must get their money back when the event is cancelled, so
// if anyone has paid the request may carry the refund arrangement
// ({"refund_method", "refund_note"}); an event set to "no refund" must be given
// one. Payers are told how they will be refunded, and the event stays visible to
// whoever manages it until every one of them is marked refunded.
func (h *EventsHandler) Remove(c *gin.Context) {
	existing, ok := h.loadOwned(c)
	if !ok {
		return
	}

	var body struct {
		RefundMethod *string `json:"refund_method"`
		RefundNote   *string `json:"refund_note"`
	}
	_ = c.ShouldBindJSON(&body) // the body is optional
	method, note := existing.RefundMethod, existing.RefundNote.String
	if body.RefundMethod != nil {
		if _, known := refundMethodLabel[*body.RefundMethod]; !known {
			c.JSON(http.StatusBadRequest, gin.H{"error": "วิธีคืนเงินไม่ถูกต้อง"})
			return
		}
		method = *body.RefundMethod
	}
	if body.RefundNote != nil {
		note = strings.TrimSpace(*body.RefundNote)
		if len([]rune(note)) > maxRefundNote {
			c.JSON(http.StatusBadRequest, gin.H{"error": "รายละเอียดการคืนเงินยาวเกิน 300 ตัวอักษร"})
			return
		}
	}
	if existing.PayerCount > 0 && method == "none" {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("มีผู้ชำระเงินแล้ว %d คน กรุณาเลือกวิธีคืนเงินก่อนลบกิจกรรม", existing.PayerCount)})
		return
	}

	if _, err := h.DB.Exec(`UPDATE events SET is_listed = 0, refund_method = ?, refund_note = ? WHERE id = ?`,
		method, nullIfEmpty(note), c.Param("id")); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	activitylog.Log(h.DB, &claims.UserID, "DELETE", "ลบกิจกรรม: "+existing.Title)
	if existing.IsListed {
		notify.SendToNonPayers(h.DB, existing.ID, "ti-calendar-off", notify.ToneWarn,
			"กิจกรรมถูกยกเลิก", existing.Title+" · ผู้จัดได้ยกเลิกกิจกรรมนี้แล้ว", "/my-registrations")
		if existing.PayerCount > 0 {
			notify.SendToPayers(h.DB, existing.ID, "ti-receipt-refund", notify.ToneWarn,
				"กิจกรรมถูกยกเลิก · คุณจะได้รับเงินคืน", existing.Title+" · "+refundText(method, note), "/my-registrations")
		}
		// Deleting an event is rare and affects other people — tell the admins
		// right away instead of leaving it for them to find in the log. People
		// who already paid need a refund, so they are called out.
		msg := fmt.Sprintf("%s · ลบโดย %s · มีผู้ลงทะเบียน %d คน", existing.Title, claims.Name, existing.RegisteredCount)
		if existing.PayerCount > 0 {
			msg += fmt.Sprintf(" · ชำระเงินแล้ว %d คน (คืนเงิน: %s)", existing.PayerCount, refundMethodLabel[method])
		}
		notify.SendToAdmins(h.DB, claims.UserID, "ti-trash", notify.ToneWarn, "เหตุผิดปกติ: กิจกรรมถูกลบ", msg, "/admin/activity-log")
		// Deleted by someone other than its organizer (an admin): the organizer should know.
		if existing.OrganizerID.Valid && existing.OrganizerID.Int64 != claims.UserID {
			notify.Send(h.DB, existing.OrganizerID.Int64, "ti-trash", notify.ToneWarn, "ผู้ดูแลระบบลบกิจกรรมของคุณ",
				existing.Title+" · ลบโดย "+claims.Name+" · ผู้สมัครได้รับแจ้งว่ากิจกรรมถูกยกเลิกแล้ว", "/events")
		}
	}
	c.Status(http.StatusNoContent)
}
