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

// SendToStudents notifies every active student account (e.g. a new event opened).
func SendToStudents(db execer, icon, tone, title, message string, link ...string) {
	_, err := db.Exec(
		`INSERT INTO notifications (user_id, icon, tone, title, message, link)
		 SELECT id, ?, ?, ?, ?, ? FROM users WHERE role = 'student' AND active = 1`,
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
