package models

import (
	"database/sql"
	"encoding/json"
)

// NullString marshals to JSON null instead of {"String":"","Valid":false},
// since sql.NullString isn't JSON-friendly out of the box.
type NullString struct {
	sql.NullString
}

func (n NullString) MarshalJSON() ([]byte, error) {
	if !n.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(n.String)
}

type NullInt struct {
	sql.NullInt64
}

func (n NullInt) MarshalJSON() ([]byte, error) {
	if !n.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(n.Int64)
}

type User struct {
	ID        int64      `json:"id"`
	Name      string     `json:"name"`
	Email     string     `json:"email"`
	Role      string     `json:"role"`
	StudentID NullString `json:"student_id"`
	Dept      NullString `json:"dept"`
	Active    bool       `json:"active"`
	CreatedAt string     `json:"created_at"`
}

type Event struct {
	ID                  int64      `json:"id"`
	Title               string     `json:"title"`
	Description         NullString `json:"description"`
	Category            string     `json:"category"`
	Subcategory         NullString `json:"subcategory"`
	PosterURL           NullString `json:"poster_url"`
	OrganizerID         NullInt    `json:"organizer_id"`
	OrganizerName       NullString `json:"organizer_name"`
	DayMode             string     `json:"day_mode"`
	DateStart           string     `json:"date_start"`
	DateEnd             NullString `json:"date_end"`
	TimeRange           NullString `json:"time_range"`
	AttendMode          string     `json:"attend_mode"`
	Place               NullString `json:"place"`
	OnlineLink          NullString `json:"online_link"`
	Capacity            int        `json:"capacity"`
	CapacityOnsite      NullInt    `json:"capacity_onsite"`
	CapacityOnline      NullInt    `json:"capacity_online"`
	Status              string     `json:"status"`
	CycleStage          int        `json:"cycle_stage"`
	PretestEnabled      bool       `json:"pretest_enabled"`
	PretestLink         NullString `json:"pretest_link"`
	PretestPassPct      NullInt    `json:"pretest_pass_pct"`
	PretestTimeLimitMin NullInt    `json:"pretest_time_limit_min"`
	CertTemplateURL     NullString `json:"cert_template_url"`
	CertSignerName      NullString `json:"cert_signer_name"`
	CertSignerTitle     NullString `json:"cert_signer_title"`
	EmailOnRegister     bool       `json:"email_on_register"`
	EmailBeforeEvent    bool       `json:"email_before_event"`
	EmailAfterEvent     bool       `json:"email_after_event"`
	IsListed            bool       `json:"is_listed"`
	CreatedAt           string     `json:"created_at"`
	UpdatedAt           string     `json:"updated_at"`
	RegisteredCount     int        `json:"registered_count"`
}

type Registration struct {
	ID           int64      `json:"id"`
	EventID      int64      `json:"event_id"`
	UserID       int64      `json:"user_id"`
	Status       string     `json:"status"`
	CheckedIn    bool       `json:"checked_in"`
	CheckedInAt  NullString `json:"checked_in_at"`
	RegisteredAt string     `json:"registered_at"`
	UpdatedAt    string     `json:"updated_at"`
}
