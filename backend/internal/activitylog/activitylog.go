package activitylog

import (
	"database/sql"
	"log"
)

// Log writes a best-effort audit trail row (activity_logs) — a failure here
// must never break the request that triggered it.
func Log(db *sql.DB, userID *int64, action, detail string) {
	_, err := db.Exec(
		"INSERT INTO activity_logs (user_id, action, detail) VALUES (?, ?, ?)",
		userID, action, detail,
	)
	if err != nil {
		log.Printf("activity log write failed: %v", err)
	}
}
