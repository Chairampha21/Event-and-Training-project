// Package reminders holds everything in the system that happens because of
// the calendar rather than because somebody pressed a button: reminders
// before and after an event, the "registration has closed" summary, marking
// no-shows as absent, and the three-absences blacklist rule.
//
// Run is called on a timer (see Start). Every rule is written so that running
// it again is harmless: a reminder is recorded in reminder_log before it is
// sent, and that table's unique key stops it being sent twice.
package reminders

import (
	"database/sql"
	"fmt"
	"log"
	"strings"
	"time"

	"cpsu-etms-backend/internal/notify"
)

const (
	// AbsenceLimit is how many no-shows in one fiscal year put a student on
	// the blacklist automatically.
	AbsenceLimit = 3

	// A follow-up reminder for unfinished work is sent once more, this many
	// days after the first — never daily.
	repeatAfterDays = 7

	// An event nobody closed is treated as final after this many days, so its
	// no-shows are counted even if the organizer never opens certificates.
	absenceGraceDays = 7

	interval = 15 * time.Minute
)

// todayTH is "today" on the Thai calendar whatever the DB server's timezone is.
const todayTH = `DATE(UTC_TIMESTAMP() + INTERVAL 7 HOUR)`

// lastDay is the final day of an event.
const lastDay = `COALESCE(e.date_end, e.date_start)`

// fiscalYear is the Thai fiscal year (Oct–Sep, Buddhist era) of a date expression.
func fiscalYear(expr string) string {
	return "(YEAR(" + expr + ") + (MONTH(" + expr + ") >= 10) + 543)"
}

// Start runs the rules now and then on a timer for as long as the server lives.
func Start(db *sql.DB) {
	go func() {
		time.Sleep(5 * time.Second) // let the server finish starting
		for {
			Run(db)
			time.Sleep(interval)
		}
	}()
}

// Run applies every time-based rule once. Safe to call at any time.
func Run(db *sql.DB) {
	for _, rule := range []struct {
		name string
		fn   func(*sql.DB) error
	}{
		{"absences", markAbsences},
		{"event tomorrow", eventTomorrow},
		{"event today", eventToday},
		{"organizer: event tomorrow", organizerEventTomorrow},
		{"registration opened", registrationOpened},
		{"registration closed", registrationClosed},
		{"evaluation pending", evaluationPending},
		{"slip pending", slipPending},
		{"post-event tasks", postEventTasks},
		{"actual budget", actualBudget},
		{"recap poster", recapPoster},
	} {
		if err := rule.fn(db); err != nil {
			log.Printf("reminders: %s: %v", rule.name, err)
		}
	}
}

// claim records that a reminder is about to be sent and reports whether this
// call is the one that gets to send it. (kind, ref, user, step) is unique.
func claim(db *sql.DB, kind string, refID, userID int64, step int) bool {
	res, err := db.Exec(`INSERT IGNORE INTO reminder_log (kind, ref_id, user_id, step) VALUES (?, ?, ?, ?)`, kind, refID, userID, step)
	if err != nil {
		log.Printf("reminders: claim %s: %v", kind, err)
		return false
	}
	n, _ := res.RowsAffected()
	return n == 1
}

// due decides which reminder of a two-step rule to send now, and claims it:
// 1 for the first, 2 for the single follow-up, 0 for nothing. The follow-up
// is only due once the first has been out for repeatAfterDays — measured from
// when it was really sent, so an item that was already old when first noticed
// doesn't get both reminders back to back.
func due(db *sql.DB, kind string, refID, userID int64) int {
	if claim(db, kind, refID, userID, 1) {
		return 1
	}
	var old bool
	err := db.QueryRow(
		`SELECT sent_at <= NOW() - INTERVAL ? DAY FROM reminder_log WHERE kind = ? AND ref_id = ? AND user_id = ? AND step = 1`,
		repeatAfterDays, kind, refID, userID,
	).Scan(&old)
	if err != nil || !old {
		return 0
	}
	if claim(db, kind, refID, userID, 2) {
		return 2
	}
	return 0
}

func thaiDate(iso string) string {
	t, err := time.Parse("2006-01-02", iso)
	if err != nil {
		return iso
	}
	months := []string{"มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน", "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"}
	return fmt.Sprintf("%d %s %d", t.Day(), months[t.Month()-1], t.Year()+543)
}

// ---------------------------------------------------------------- students

// eventTomorrow reminds everyone registered for an event that starts tomorrow.
func eventTomorrow(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT r.id, r.user_id, e.id, e.title, COALESCE(e.time_range, ''), e.attend_mode, COALESCE(e.place, ''), COALESCE(e.attendee_note, ''), r.wants_laptop
		FROM registrations r JOIN events e ON e.id = r.event_id
		WHERE e.is_listed = 1 AND e.status <> 'done' AND r.status = 'registered'
		  AND e.date_start = ` + todayTH + ` + INTERVAL 1 DAY`)
	if err != nil {
		return err
	}
	type item struct {
		regID, userID, eventID        int64
		title, timeRange, mode, place string
		note                          string
		laptop                        bool
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.regID, &it.userID, &it.eventID, &it.title, &it.timeRange, &it.mode, &it.place, &it.note, &it.laptop); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, it := range items {
		if !claim(db, "event_tomorrow", it.regID, it.userID, 1) {
			continue
		}
		parts := []string{it.title}
		if it.timeRange != "" && it.timeRange != "-" {
			parts = append(parts, it.timeRange)
		}
		if it.mode == "online" {
			parts = append(parts, "ออนไลน์ · ดูลิงก์ในรายละเอียดกิจกรรม")
		} else if it.place != "" {
			parts = append(parts, it.place)
		}
		if it.laptop {
			parts = append(parts, "คุณจองโน้ตบุ๊กให้ยืมไว้ 1 เครื่อง")
		}
		if it.note != "" {
			parts = append(parts, "ผู้จัดแจ้ง: "+it.note)
		}
		notify.Send(db, it.userID, "ti-calendar-time", notify.ToneAccent, "พรุ่งนี้มีกิจกรรมที่คุณลงทะเบียนไว้", strings.Join(parts, " · "), fmt.Sprintf("/home?event=%d", it.eventID))
	}
	return nil
}

// isEventDay is true when the Thai "today" is one of the event's days: one of
// the hand-picked days when it has them, otherwise any day from start to end.
const isEventDay = `(CASE WHEN e.event_dates IS NOT NULL AND e.event_dates <> ''
	THEN FIND_IN_SET(DATE_FORMAT(` + todayTH + `, '%Y-%m-%d'), e.event_dates) > 0
	ELSE ` + todayTH + ` BETWEEN e.date_start AND ` + lastDay + ` END)`

// eventToday reminds registrants on each day of the event itself — the
// reminder that matters most for an online event, where the link to join and
// to check in is what the person needs that day. Not sent to someone already
// checked in for the day.
func eventToday(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT r.id, r.user_id, e.id, e.title, COALESCE(e.time_range, ''), r.attend_via, COALESCE(e.place, ''),
		       DATEDIFF(` + todayTH + `, e.date_start) + 1, DATEDIFF(` + lastDay + `, e.date_start) + 1
		FROM registrations r JOIN events e ON e.id = r.event_id
		WHERE e.is_listed = 1 AND r.status = 'registered' AND ` + isEventDay + `
		  AND NOT EXISTS (SELECT 1 FROM registration_checkins c WHERE c.registration_id = r.id AND c.event_date = ` + todayTH + `)`)
	if err != nil {
		return err
	}
	type item struct {
		regID, userID, eventID       int64
		title, timeRange, via, place string
		dayNo, span                  int
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.regID, &it.userID, &it.eventID, &it.title, &it.timeRange, &it.via, &it.place, &it.dayNo, &it.span); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, it := range items {
		if it.dayNo < 1 || it.dayNo > 250 || !claim(db, "event_today", it.regID, it.userID, it.dayNo) {
			continue
		}
		parts := []string{it.title}
		if it.span > 1 {
			parts = append(parts, fmt.Sprintf("วันที่ %d ของกิจกรรม", it.dayNo))
		}
		if it.timeRange != "" && it.timeRange != "-" {
			parts = append(parts, it.timeRange)
		}
		if it.via == "online" {
			parts = append(parts, "ออนไลน์ · ลิงก์เข้าร่วมอยู่ในรายละเอียดกิจกรรม · เช็คชื่อด้วยลิงก์ที่ผู้จัดแจ้ง")
		} else if it.place != "" {
			parts = append(parts, it.place)
		}
		notify.Send(db, it.userID, "ti-calendar-star", notify.ToneAccent, "วันนี้มีกิจกรรมที่คุณลงทะเบียนไว้", strings.Join(parts, " · "), fmt.Sprintf("/home?event=%d", it.eventID))
	}
	return nil
}

// organizerEventTomorrow gives the organizer the numbers to prepare with, the
// day before their event starts.
func organizerEventTomorrow(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT e.id, e.organizer_id, e.title, COALESCE(e.time_range, ''), e.attend_mode,
		       COUNT(r.id), COALESCE(SUM(r.attend_via = 'online'), 0), COALESCE(SUM(r.wants_laptop), 0),
		       COALESCE(SUM(r.food_allergy IS NOT NULL), 0), COALESCE(SUM(r.payment_status IN ('pending', 'submitted', 'rejected')), 0)
		FROM events e LEFT JOIN registrations r ON r.event_id = e.id AND r.status = 'registered'
		WHERE e.is_listed = 1 AND e.status <> 'done' AND e.organizer_id IS NOT NULL
		  AND e.date_start = ` + todayTH + ` + INTERVAL 1 DAY
		GROUP BY e.id`)
	if err != nil {
		return err
	}
	type item struct {
		id, organizer                     int64
		title, timeRange, mode            string
		regs, online, laptops, diet, owed int
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.organizer, &it.title, &it.timeRange, &it.mode, &it.regs, &it.online, &it.laptops, &it.diet, &it.owed); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, it := range items {
		if !claim(db, "org_event_tomorrow", it.id, it.organizer, 1) {
			continue
		}
		parts := []string{it.title}
		if it.timeRange != "" && it.timeRange != "-" {
			parts = append(parts, it.timeRange)
		}
		if it.mode == "hybrid" {
			parts = append(parts, fmt.Sprintf("ผู้สมัคร %d คน (Onsite %d · Online %d)", it.regs, it.regs-it.online, it.online))
		} else {
			parts = append(parts, fmt.Sprintf("ผู้สมัคร %d คน", it.regs))
		}
		if it.laptops > 0 {
			parts = append(parts, fmt.Sprintf("เตรียมโน้ตบุ๊กให้ยืม %d เครื่อง", it.laptops))
		}
		if it.diet > 0 {
			parts = append(parts, fmt.Sprintf("แจ้งแพ้อาหาร %d คน", it.diet))
		}
		if it.owed > 0 {
			parts = append(parts, fmt.Sprintf("ยังไม่ยืนยันการชำระเงิน %d คน", it.owed))
		}
		notify.Send(db, it.organizer, "ti-calendar-time", notify.ToneAccent, "พรุ่งนี้มีกิจกรรมที่คุณจัด", strings.Join(parts, " · "), fmt.Sprintf("/events?applicants=%d", it.id))
	}
	return nil
}

// registrationOpened tells students when an event announced earlier starts
// taking registrations today (events open from the moment they were created
// already announced themselves then).
func registrationOpened(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT e.id, e.title FROM events e
		WHERE e.is_listed = 1 AND e.status = 'open' AND e.reg_start = ` + todayTH + `
		  AND DATE(e.created_at + INTERVAL 7 HOUR) < e.reg_start`)
	if err != nil {
		return err
	}
	type item struct {
		id    int64
		title string
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.title); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, it := range items {
		if claim(db, "reg_opened", it.id, 0, 1) {
			notify.SendToStudents(db, "ti-sparkles", notify.ToneDark, "เปิดรับสมัครแล้ววันนี้", it.title+" · ลงทะเบียนได้แล้ว", fmt.Sprintf("/home?event=%d", it.id))
		}
	}
	return nil
}

// stepped runs a query returning (ref id, user id, title, link) for everything
// that is still outstanding, and sends `send` once when an item first shows up
// and once more repeatAfterDays later if it is still there. link is where the
// notification takes the user: the place the outstanding thing gets done.
func stepped(db *sql.DB, kind, query string, send func(userID int64, title, link string, step int)) error {
	rows, err := db.Query(query)
	if err != nil {
		return err
	}
	type item struct {
		ref, user   int64
		title, link string
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.ref, &it.user, &it.title, &it.link); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, it := range items {
		if step := due(db, kind, it.ref, it.user); step > 0 {
			send(it.user, it.title, it.link, step)
		}
	}
	return nil
}

func again(step int) string {
	if step > 1 {
		return " (เตือนอีกครั้ง)"
	}
	return ""
}

// evaluationPending: checked in, certificates are open, but the evaluation
// that unlocks the certificate still isn't done two days on.
func evaluationPending(db *sql.DB) error {
	return stepped(db, "evaluation_pending", `
		SELECT r.id, r.user_id, e.title, CONCAT('/evaluate/', e.id)
		FROM registrations r JOIN events e ON e.id = r.event_id
		LEFT JOIN evaluations ev ON ev.registration_id = r.id
		WHERE e.is_listed = 1 AND e.status = 'done' AND r.status = 'attended' AND ev.id IS NULL
		  AND DATEDIFF(`+todayTH+`, DATE(e.updated_at + INTERVAL 7 HOUR)) >= 2`,
		func(userID int64, title, link string, step int) {
			notify.Send(db, userID, "ti-clipboard-check", notify.ToneWarn, "ยังไม่ได้ทำแบบประเมิน"+again(step), title+" · ทำแบบประเมินให้เสร็จเพื่อรับเกียรติบัตร", link)
		})
}

// slipPending: registered for a paid event but no acceptable slip two days on.
func slipPending(db *sql.DB) error {
	return stepped(db, "slip_pending", `
		SELECT r.id, r.user_id, e.title, '/my-registrations'
		FROM registrations r JOIN events e ON e.id = r.event_id
		WHERE e.is_listed = 1 AND e.status <> 'done' AND r.payment_status IN ('pending', 'rejected')
		  AND DATEDIFF(`+todayTH+`, DATE(r.registered_at + INTERVAL 7 HOUR)) >= 2`,
		func(userID int64, title, link string, step int) {
			notify.Send(db, userID, "ti-receipt", notify.ToneWarn, "ยังไม่ได้ส่งหลักฐานการชำระเงิน"+again(step), title+" · แนบสลิปในรายละเอียดกิจกรรมเพื่อให้ผู้จัดตรวจสอบ", link)
		})
}

// --------------------------------------------------------------- organizers

// registrationClosed sends the organizer a summary the day after the
// registration window ends: who signed up and what they asked for.
func registrationClosed(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT e.id, e.organizer_id, e.title, e.reg_end,
		       IF(e.attend_mode = 'hybrid', COALESCE(e.capacity_onsite, 0) + COALESCE(e.capacity_online, 0), e.capacity),
		       COUNT(r.id), COALESCE(SUM(r.wants_laptop), 0), COALESCE(SUM(r.food_allergy IS NOT NULL), 0),
		       COALESCE(SUM(r.payment_status IN ('pending', 'submitted', 'rejected')), 0)
		FROM events e LEFT JOIN registrations r ON r.event_id = e.id
		WHERE e.is_listed = 1 AND e.organizer_id IS NOT NULL AND e.reg_end IS NOT NULL AND e.reg_end < ` + todayTH + `
		  AND e.reg_end >= ` + todayTH + ` - INTERVAL 14 DAY
		GROUP BY e.id`)
	if err != nil {
		return err
	}
	type item struct {
		id, organizer                       int64
		title, regEnd                       string
		capacity, regs, laptops, diet, owed int
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.organizer, &it.title, &it.regEnd, &it.capacity, &it.regs, &it.laptops, &it.diet, &it.owed); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, it := range items {
		if !claim(db, "reg_closed", it.id, it.organizer, 1) {
			continue
		}
		parts := []string{it.title, fmt.Sprintf("ปิดรับสมัครเมื่อ %s", thaiDate(it.regEnd))}
		if it.capacity > 0 {
			parts = append(parts, fmt.Sprintf("ผู้สมัคร %d จาก %d ที่นั่ง", it.regs, it.capacity))
		} else {
			parts = append(parts, fmt.Sprintf("ผู้สมัคร %d คน", it.regs))
		}
		if it.laptops > 0 {
			parts = append(parts, fmt.Sprintf("ขอยืมโน้ตบุ๊ก %d เครื่อง", it.laptops))
		}
		if it.diet > 0 {
			parts = append(parts, fmt.Sprintf("แจ้งแพ้อาหาร %d คน", it.diet))
		}
		if it.owed > 0 {
			parts = append(parts, fmt.Sprintf("ยังไม่ยืนยันการชำระเงิน %d คน", it.owed))
		}
		notify.Send(db, it.organizer, "ti-clipboard-list", notify.ToneDark, "สรุปผู้สมัคร: ปิดรับสมัครแล้ว", strings.Join(parts, " · "), fmt.Sprintf("/events?applicants=%d", it.id))
	}
	return nil
}

// postEventTasks: the event is over but attendance hasn't been confirmed and
// certificates haven't been opened.
func postEventTasks(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT e.id, e.organizer_id, e.title, COUNT(r.id), COALESCE(SUM(r.checked_in), 0)
		FROM events e LEFT JOIN registrations r ON r.event_id = e.id
		WHERE e.is_listed = 1 AND e.organizer_id IS NOT NULL AND e.status <> 'done'
		  AND ` + lastDay + ` < ` + todayTH + ` AND ` + lastDay + ` >= ` + todayTH + ` - INTERVAL 60 DAY
		GROUP BY e.id`)
	if err != nil {
		return err
	}
	type item struct {
		id, organizer, regs, in int64
		title                   string
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.id, &it.organizer, &it.title, &it.regs, &it.in); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, it := range items {
		step := due(db, "post_event", it.id, it.organizer)
		if step == 0 {
			continue
		}
		msg := fmt.Sprintf("%s · เช็คอินแล้ว %d จาก %d คน · ตรวจรายชื่อผู้เข้าร่วมให้ครบ แล้วเปิดสิทธิ์เกียรติบัตรเพื่อปิดงาน", it.title, it.in, it.regs)
		if it.regs == 0 {
			msg = it.title + " · ไม่มีผู้ลงทะเบียน · เปิดสิทธิ์เกียรติบัตรเพื่อปิดงาน"
		}
		notify.Send(db, it.organizer, "ti-checklist", notify.ToneWarn, "งานค้างหลังจบกิจกรรม"+again(step), msg, fmt.Sprintf("/events?applicants=%d", it.id))
	}
	return nil
}

// actualBudget: a budget was set, the event is over, the amount spent is missing.
func actualBudget(db *sql.DB) error {
	return stepped(db, "actual_budget", `
		SELECT e.id, e.organizer_id, e.title, CONCAT('/events?budget=', e.id)
		FROM events e
		WHERE e.is_listed = 1 AND e.organizer_id IS NOT NULL AND e.budget_actual IS NULL
		  AND (e.budget_planned IS NOT NULL OR e.budget_other IS NOT NULL)
		  AND `+lastDay+` < `+todayTH+` AND `+lastDay+` >= `+todayTH+` - INTERVAL 60 DAY`,
		func(userID int64, title, link string, step int) {
			notify.Send(db, userID, "ti-coin", notify.ToneWarn, "ยังไม่ได้กรอกงบประมาณที่ใช้จริง"+again(step), title+" · บันทึกงบประมาณที่ใช้จริงเพื่อให้แดชบอร์ดงบประมาณครบถ้วน", link)
		})
}

// recapPoster: three days after the event, the news-recap poster isn't uploaded.
func recapPoster(db *sql.DB) error {
	return stepped(db, "recap_poster", `
		SELECT e.id, e.organizer_id, e.title, '/admin/sar'
		FROM events e LEFT JOIN sar_reports s ON s.event_id = e.id AND COALESCE(s.recap_poster_url, '') <> ''
		WHERE e.is_listed = 1 AND e.organizer_id IS NOT NULL AND s.id IS NULL
		  AND DATEDIFF(`+todayTH+`, `+lastDay+`) >= 3 AND `+lastDay+` >= `+todayTH+` - INTERVAL 60 DAY`,
		func(userID int64, title, link string, step int) {
			notify.Send(db, userID, "ti-photo-up", notify.ToneDark, "ยังไม่ได้อัปโหลดโปสเตอร์สรุปข่าว"+again(step), title+" · อัปโหลดได้ที่หน้าคลังโปสเตอร์กิจกรรม", link)
		})
}

// ------------------------------------------------------- absences / blacklist

// markAbsences turns "registered but never checked in" into 'absent' once an
// event's attendance is final: when the organizer has opened certificates
// (status 'done'), or absenceGraceDays after the last day if they never did.
// Each new absence is then counted against the student.
func markAbsences(db *sql.DB) error {
	rows, err := db.Query(`
		SELECT r.id, r.user_id, e.title
		FROM registrations r JOIN events e ON e.id = r.event_id
		WHERE e.is_listed = 1 AND r.status = 'registered' AND r.checked_in = 0
		  AND NOT EXISTS (SELECT 1 FROM registration_checkins c WHERE c.registration_id = r.id)
		  AND `+lastDay+` < `+todayTH+`
		  AND (e.status = 'done' OR DATEDIFF(`+todayTH+`, `+lastDay+`) >= ?)`, absenceGraceDays)
	if err != nil {
		return err
	}
	type item struct {
		regID, userID int64
		title         string
	}
	var items []item
	for rows.Next() {
		var it item
		if err := rows.Scan(&it.regID, &it.userID, &it.title); err != nil {
			rows.Close()
			return err
		}
		items = append(items, it)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}
	for _, it := range items {
		res, err := db.Exec(`UPDATE registrations SET status = 'absent' WHERE id = ? AND status = 'registered' AND checked_in = 0`, it.regID)
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 1 {
			applyAbsenceRule(db, it.userID, it.regID, it.title)
		}
	}
	return nil
}

// absencesInYearOf lists the events a student missed in the same fiscal year
// as the event of registration regID (also returned), not counting anything
// from before their last blacklist was lifted — a lifted suspension is a
// clean slate. The year is the missed event's, not today's: an absence from
// late September is finalised in October, after the fiscal year has turned,
// and must still be counted with the year it happened in.
func absencesInYearOf(db *sql.DB, userID, regID int64) (titles []string, year int, err error) {
	if err = db.QueryRow(
		`SELECT `+fiscalYear("e.date_start")+` FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`, regID,
	).Scan(&year); err != nil {
		return nil, 0, err
	}
	rows, err := db.Query(`
		SELECT e.title
		FROM registrations r JOIN events e ON e.id = r.event_id
		WHERE r.user_id = ? AND r.status = 'absent' AND e.is_listed = 1
		  AND `+fiscalYear("e.date_start")+` = ?
		  AND `+lastDay+` > COALESCE((SELECT DATE(MAX(b.restored_at) + INTERVAL 7 HOUR) FROM blacklist_entries b WHERE b.user_id = ? AND b.restored_at IS NOT NULL), '1000-01-01')
		ORDER BY e.date_start`, userID, year, userID)
	if err != nil {
		return nil, year, err
	}
	defer rows.Close()
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, year, err
		}
		titles = append(titles, t)
	}
	return titles, year, rows.Err()
}

// applyAbsenceRule warns the student after each no-show and, at AbsenceLimit,
// adds them to the blacklist automatically (created_by NULL = by the system).
func applyAbsenceRule(db *sql.DB, userID, regID int64, missedTitle string) {
	titles, year, err := absencesInYearOf(db, userID, regID)
	if err != nil {
		log.Printf("reminders: absence count: %v", err)
		return
	}
	n := len(titles)
	if n < AbsenceLimit {
		left := AbsenceLimit - n
		notify.Send(db, userID, "ti-alert-triangle", notify.ToneWarn,
			fmt.Sprintf("ขาดกิจกรรม %d จาก %d ครั้ง", n, AbsenceLimit),
			fmt.Sprintf("ไม่ได้เข้าร่วม %s · หากขาดอีก %d ครั้งในปีงบประมาณ พ.ศ. %d ระบบจะระงับสิทธิ์การลงทะเบียน (Blacklist) อัตโนมัติ · หากเข้าร่วมแล้วกรุณาแจ้งผู้จัดให้เช็คอิน", missedTitle, left, year), "/my-registrations")
		return
	}

	var active int
	if err := db.QueryRow(`SELECT COUNT(*) FROM blacklist_entries WHERE user_id = ? AND restored_at IS NULL`, userID).Scan(&active); err != nil || active > 0 {
		return // already suspended (or can't tell) — nothing to add
	}
	var name, email string
	var studentID sql.NullString
	if err := db.QueryRow(`SELECT name, email, student_id FROM users WHERE id = ?`, userID).Scan(&name, &email, &studentID); err != nil {
		return
	}
	reason := fmt.Sprintf("ขาดกิจกรรมครบ %d ครั้งในปีงบประมาณ พ.ศ. %d (ระบบเพิ่มอัตโนมัติ): %s", AbsenceLimit, year, strings.Join(titles, ", "))
	if _, err := db.Exec(
		`INSERT INTO blacklist_entries (user_id, name, email, student_id, reason, created_by) VALUES (?, ?, ?, ?, ?, NULL)`,
		userID, name, email, studentID, reason,
	); err != nil {
		log.Printf("reminders: auto blacklist: %v", err)
		return
	}
	if _, err := db.Exec(`INSERT INTO activity_logs (user_id, action, detail) VALUES (NULL, 'BLACKLIST', ?)`, "ระบบเพิ่มรายชื่อ Blacklist อัตโนมัติ: "+name); err != nil {
		log.Printf("reminders: activity log: %v", err)
	}
	notify.Send(db, userID, "ti-ban", notify.ToneWarn, "บัญชีถูกระงับสิทธิ์การลงทะเบียน",
		fmt.Sprintf("ขาดกิจกรรมครบ %d ครั้งในปีงบประมาณ พ.ศ. %d · ติดต่อผู้จัดกิจกรรมหรือผู้ดูแลระบบหากข้อมูลไม่ถูกต้อง", AbsenceLimit, year), "/my-registrations")
	notify.SendToAdmins(db, 0, "ti-user-off", notify.ToneWarn, "ระบบเพิ่มรายชื่อ Blacklist อัตโนมัติ",
		fmt.Sprintf("%s · ขาดกิจกรรมครบ %d ครั้ง: %s", name, AbsenceLimit, strings.Join(titles, ", ")), "/admin/blacklist")
}

// Reconsider is called after the absence recorded on registration regID is
// corrected (the organizer checks the student in after all). If that takes
// them back under the limit for that fiscal year, a suspension the system
// itself added is lifted again; one added by a person is left alone.
func Reconsider(db *sql.DB, userID, regID int64) {
	titles, _, err := absencesInYearOf(db, userID, regID)
	if err != nil || len(titles) >= AbsenceLimit {
		return
	}
	res, err := db.Exec(`UPDATE blacklist_entries SET restored_at = NOW() WHERE user_id = ? AND restored_at IS NULL AND created_by IS NULL`, userID)
	if err != nil {
		log.Printf("reminders: reconsider: %v", err)
		return
	}
	if n, _ := res.RowsAffected(); n > 0 {
		notify.Send(db, userID, "ti-shield-check", notify.ToneAccent, "คืนสิทธิ์การลงทะเบียนแล้ว", "มีการแก้ไขข้อมูลการเข้าร่วม จำนวนครั้งที่ขาดจึงไม่ถึงเกณฑ์ · คุณลงทะเบียนกิจกรรมได้ตามปกติ", "/home")
	}
}

// ------------------------------------------------------------------- admins

// AdminDigest gives an admin one summary of what is waiting across the whole
// system — at most once a day, and only when there is something to report —
// so they don't have to go looking through the activity log.
func AdminDigest(db *sql.DB, adminID int64) {
	var openEnded, noActual, slips int
	err := db.QueryRow(`
		SELECT
		  (SELECT COUNT(*) FROM events e WHERE e.is_listed = 1 AND e.status <> 'done' AND `+lastDay+` < `+todayTH+`),
		  (SELECT COUNT(*) FROM events e WHERE e.is_listed = 1 AND e.budget_actual IS NULL AND (e.budget_planned IS NOT NULL OR e.budget_other IS NOT NULL) AND `+lastDay+` < `+todayTH+`),
		  (SELECT COUNT(*) FROM registrations r JOIN events e ON e.id = r.event_id WHERE e.is_listed = 1 AND r.payment_status = 'submitted')`,
	).Scan(&openEnded, &noActual, &slips)
	if err != nil {
		log.Printf("reminders: admin digest: %v", err)
		return
	}
	var parts []string
	if openEnded > 0 {
		parts = append(parts, fmt.Sprintf("กิจกรรมที่จบแล้วแต่ยังไม่ปิดงาน %d กิจกรรม", openEnded))
	}
	if noActual > 0 {
		parts = append(parts, fmt.Sprintf("ยังไม่กรอกงบประมาณที่ใช้จริง %d กิจกรรม", noActual))
	}
	if slips > 0 {
		parts = append(parts, fmt.Sprintf("สลิปรอตรวจ %d รายการ", slips))
	}
	if len(parts) == 0 {
		return
	}
	var day int64
	if err := db.QueryRow(`SELECT DATE_FORMAT(` + todayTH + `, '%Y%m%d')`).Scan(&day); err != nil {
		return
	}
	if claim(db, "admin_digest", day, adminID, 1) {
		notify.Send(db, adminID, "ti-list-check", notify.ToneDark, fmt.Sprintf("สรุปเรื่องค้าง %d เรื่อง", openEnded+noActual+slips), strings.Join(parts, " · "), "/events")
	}
}
