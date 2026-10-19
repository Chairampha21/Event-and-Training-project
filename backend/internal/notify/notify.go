package notify

import (
	"database/sql"
	"log"
)

// Tabler icon class + tone pairs the navbar bell already knows how to render.
const (
	ToneAccent = "accent"
	ToneDark   = "dark"
	ToneWarn   = "warn"
)

// execer is satisfied by both *sql.DB and *sql.Tx.
type execer interface {
	Exec(query string, args ...any) (sql.Result, error)
}

// link0 returns the optional link argument as a nullable value. A link is the
// in-app path the bell takes the user to when they press the notification —
// the place where the thing it talks about can be seen or finished.
func link0(link []string) any {
	if len(link) == 0 || link[0] == "" {
		return nil
	}
	return link[0]
}

// Send writes a best-effort bell notification for one user — like
// activitylog.Log, a failure here must never break the request that triggered it.
// The optional last argument is where pressing the notification should lead.
func Send(db execer, userID int64, icon, tone, title, message string, link ...string) {
	_, err := db.Exec(
		`INSERT INTO notifications (user_id, icon, tone, title, message, link) VALUES (?, ?, ?, ?, ?, ?)`,
		userID, icon, tone, title, truncate(message), link0(link),
	)
	if err != nil {
		log.Printf("notification write failed: %v", err)
	}
}

// querier is satisfied by both *sql.DB and *sql.Tx.
type querier interface {
	execer
	QueryRow(query string, args ...any) *sql.Row
}

// SendGrouped is Send for things that pile up per event (slips to check,
// cancellations, ...): while the user still has an unread notification with
// the same title and link, that one is rewritten with the new message and
// moved to the top instead of adding another, so a hundred registrants make
// one line in the bell, not a hundred. Once it has been read, the next one
// starts a new notification.
func SendGrouped(db querier, userID int64, icon, tone, title, message, link string) {
	var id int64
	err := db.QueryRow(
		`SELECT id FROM notifications WHERE user_id = ? AND title = ? AND link <=> ? AND is_read = 0 ORDER BY id DESC LIMIT 1`,
		userID, title, link0([]string{link}),
	).Scan(&id)
	if err == sql.ErrNoRows {
		Send(db, userID, icon, tone, title, message, link)
		return
	}
	if err == nil {
		_, err = db.Exec(`UPDATE notifications SET icon = ?, tone = ?, message = ?, created_at = NOW() WHERE id = ?`,
			icon, tone, truncate(message), id)
	}
	if err != nil {
		log.Printf("notification write failed: %v", err)
	}
}

// SendToStudents notifies every active participant account (students and teachers) (e.g. a new event opened).
func SendToStudents(db execer, icon, tone, title, message string, link ...string) {
	_, err := db.Exec(
		`INSERT INTO notifications (user_id, icon, tone, title, message, link)
		 SELECT id, ?, ?, ?, ?, ? FROM users WHERE role IN ('student', 'teacher') AND active = 1`,
		icon, tone, title, truncate(message), link0(link),
	)
	if err != nil {
		log.Printf("notification write failed: %v", err)
	}
}

// SendToAdmins notifies every active admin, optionally leaving one out (the
// admin whose own action caused it — they already know).
func SendToAdmins(db execer, exceptUserID int64, icon, tone, title, message string, link ...string) {
	_, err := db.Exec(
		`INSERT INTO notifications (user_id, icon, tone, title, message, link)
		 SELECT id, ?, ?, ?, ?, ? FROM users WHERE role = 'admin' AND active = 1 AND id <> ?`,
		icon, tone, title, truncate(message), link0(link), exceptUserID,
	)
	if err != nil {
		log.Printf("notification write failed: %v", err)
	}
}

// SendToRegistrants notifies everyone registered for an event. Pass statuses
// to limit it to registrations in those states (e.g. "attended"); none = all.
// link is where pressing the notification leads ("" for nowhere).
func SendToRegistrants(db execer, eventID any, icon, tone, title, message, link string, statuses ...string) {
	query := `INSERT INTO notifications (user_id, icon, tone, title, message, link)
		 SELECT user_id, ?, ?, ?, ?, ? FROM registrations WHERE event_id = ?`
	args := []any{icon, tone, title, truncate(message), link0([]string{link}), eventID}
	if len(statuses) > 0 {
		query += ` AND status IN (?` + repeat(", ?", len(statuses)-1) + `)`
		for _, s := range statuses {
			args = append(args, s)
		}
	}
	if _, err := db.Exec(query, args...); err != nil {
		log.Printf("notification write failed: %v", err)
	}
}

// payerSQL matches registrations whose money the organizer holds: a slip was
// sent or the payment confirmed, and it has not been given back yet.
const payerSQL = `payment_status IN ('submitted', 'paid')`

// SendToPayers notifies everyone whose money for the event is still held (see payerSQL).
func SendToPayers(db execer, eventID any, icon, tone, title, message, link string) {
	if _, err := db.Exec(`INSERT INTO notifications (user_id, icon, tone, title, message, link)
		 SELECT user_id, ?, ?, ?, ?, ? FROM registrations WHERE event_id = ? AND `+payerSQL,
		icon, tone, title, truncate(message), link0([]string{link}), eventID); err != nil {
		log.Printf("notification write failed: %v", err)
	}
}

// SendToNonPayers notifies the event's registrants (status 'registered') who
// have no money held — the counterpart of SendToPayers.
func SendToNonPayers(db execer, eventID any, icon, tone, title, message, link string) {
	if _, err := db.Exec(`INSERT INTO notifications (user_id, icon, tone, title, message, link)
		 SELECT user_id, ?, ?, ?, ?, ? FROM registrations WHERE event_id = ? AND status = 'registered' AND NOT `+payerSQL,
		icon, tone, title, truncate(message), link0([]string{link}), eventID); err != nil {
		log.Printf("notification write failed: %v", err)
	}
}

// truncate keeps message within the notifications.message VARCHAR(500) column.
func truncate(s string) string {
	r := []rune(s)
	if len(r) > 500 {
		return string(r[:499]) + "…"
	}
	return s
}

func repeat(s string, n int) string {
	out := ""
	for i := 0; i < n; i++ {
		out += s
	}
	return out
}
