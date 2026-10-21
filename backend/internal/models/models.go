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

// NullFloat marshals to a JSON number or null (see NullString).
type NullFloat struct {
	sql.NullFloat64
}

func (n NullFloat) MarshalJSON() ([]byte, error) {
	if !n.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(n.Float64)
}

type User struct {
	ID        int64      `json:"id"`
	Name      string     `json:"name"`     // Thai first and last name, without the title
	TitleTH   NullString `json:"title_th"` // นาย, นางสาว, ผศ.ดร. ...
	NameEN    NullString `json:"name_en"`
	TitleEN   NullString `json:"title_en"` // Mr., Miss, Asst. Prof. Dr. ...
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
	CoordinatorID       NullInt    `json:"coordinator_id"` // the teacher account organizer_name names, if it has one
	DayMode             string     `json:"day_mode"`
	DateStart           string     `json:"date_start"`
	DateEnd             NullString `json:"date_end"`
	EventDates          []string   `json:"event_dates"` // multi-day events: each day picked, in order; [] otherwise
	EventTimes          []string   `json:"event_times"` // "HH:MM-HH:MM" per entry of EventDates (same order); [] if not set
	TimeRange           NullString `json:"time_range"`
	RegStart            NullString `json:"reg_start"`
	RegEnd              NullString `json:"reg_end"`
	AttendMode          string     `json:"attend_mode"`
	Place               NullString `json:"place"`
	OnlineLink          NullString `json:"online_link"`     // only sent to people allowed to join: registrants, the organizer, admins
	HasOnlineLink       bool       `json:"has_online_link"` // true when a link exists, even if it is withheld from this viewer
	Capacity            int        `json:"capacity"`
	CapacityOnsite      NullInt    `json:"capacity_onsite"`
	CapacityOnline      NullInt    `json:"capacity_online"`
	BudgetPlanned       NullFloat  `json:"budget_planned"`    // baht from department income (เงินรายได้); null = not set
	BudgetOther         NullFloat  `json:"budget_other"`      // baht from other sources (แหล่งอื่น); null = not set
	BudgetTotal         NullFloat  `json:"budget_total"`      // the two sources added up; null when neither is set
	BudgetActual        NullFloat  `json:"budget_actual"`     // baht actually spent; null = not recorded yet
	AttendeeNote        NullString `json:"attendee_note"`     // organizer's message to people registering
	LoanLaptopQty       NullInt    `json:"loan_laptop_qty"`   // notebooks available to borrow; null = none
	LoanLaptopTaken     int        `json:"loan_laptop_taken"` // how many registrants asked to borrow one
	RegisteredOnline    int        `json:"registered_online"` // registrants attending online (the rest attend on site)
	AskDietary          bool       `json:"ask_dietary"`       // registrants are asked about food allergies / dietary needs
	IssueCertificate    bool       `json:"issue_certificate"` // the event gives certificates (off = one signature box per day)
	Fee                 NullFloat  `json:"fee"`               // registration fee in baht; null or 0 = free
	PaymentInfo         NullString `json:"payment_info"`      // how to pay, shown to people registering
	RefundMethod        string     `json:"refund_method"`     // none | department | transfer — how paid money is given back
	RefundNote          NullString `json:"refund_note"`       // when / where, in the organizer's words
	PayerCount          int        `json:"payer_count"`       // registrations whose money is held (slip sent or confirmed) and not yet refunded
	Status              string     `json:"status"`
	CycleStage          int        `json:"cycle_stage"`
	PretestEnabled      bool       `json:"pretest_enabled"`
	PretestLink         NullString `json:"pretest_link"`
	PretestPassPct      NullInt    `json:"pretest_pass_pct"`
	PretestTimeLimitMin NullInt    `json:"pretest_time_limit_min"`
	CertTemplateURL     NullString `json:"cert_template_url"`
	CertSignerName      NullString `json:"cert_signer_name"`
	CertSignerTitle     NullString `json:"cert_signer_title"`
	CertSignatureURL    NullString `json:"cert_signature_url"`
	CertLayout          NullString `json:"cert_layout"` // JSON text; null = default layout
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
