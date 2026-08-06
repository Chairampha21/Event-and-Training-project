package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
)

type EvaluationsHandler struct {
	DB *sql.DB
}

func NewEvaluationsHandler(db *sql.DB) *EvaluationsHandler {
	return &EvaluationsHandler{DB: db}
}

type evalQuestion struct {
	ID        int    `json:"id"`
	QKey      string `json:"q_key"`
	Label     string `json:"label"`
	SortOrder int    `json:"sort_order"`
}

func (h *EvaluationsHandler) Questions(c *gin.Context) {
	rows, err := h.DB.Query(`SELECT id, q_key, label, sort_order FROM evaluation_questions ORDER BY sort_order ASC`)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []evalQuestion{}
	for rows.Next() {
		var q evalQuestion
		if err := rows.Scan(&q.ID, &q.QKey, &q.Label, &q.SortOrder); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, q)
	}
	c.JSON(http.StatusOK, gin.H{"questions": list})
}

type eventEvalQuestion struct {
	ID        int      `json:"id"`
	EventID   int      `json:"event_id"`
	Label     string   `json:"label"`
	SortOrder int      `json:"sort_order"`
	Type      string   `json:"type"`
	Required  bool     `json:"required"`
	Options   []string `json:"options,omitempty"`
}

// EventQuestions returns the extra, event-specific questions an organizer has
// added on top of the fixed standard survey (empty array if none were set).
func (h *EvaluationsHandler) EventQuestions(c *gin.Context) {
	rows, err := h.DB.Query(`SELECT id, event_id, label, sort_order, question_type, options, required FROM event_evaluation_questions WHERE event_id = ? ORDER BY sort_order ASC`, c.Param("id"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []eventEvalQuestion{}
	for rows.Next() {
		var q eventEvalQuestion
		var required int
		var options sql.NullString
		if err := rows.Scan(&q.ID, &q.EventID, &q.Label, &q.SortOrder, &q.Type, &options, &required); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		q.Required = required != 0
		if options.Valid && options.String != "" {
			_ = json.Unmarshal([]byte(options.String), &q.Options)
		}
		list = append(list, q)
	}
	c.JSON(http.StatusOK, gin.H{"questions": list})
}

type setEventQuestionsBody struct {
	Questions []struct {
		Label    string   `json:"label"`
		Type     string   `json:"type"`
		Required bool     `json:"required"`
		Options  []string `json:"options"`
	} `json:"questions"`
}

// SetEventQuestions replaces the full set of extra questions for an event
// (organizer who owns the event, or admin) — simplest way to support both
// "set them up now" and "add more later" from the same form.
func (h *EvaluationsHandler) SetEventQuestions(c *gin.Context) {
	eventID := c.Param("id")

	var organizerID sql.NullInt64
	err := h.DB.QueryRow(`SELECT organizer_id FROM events WHERE id = ?`, eventID).Scan(&organizerID)
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
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์แก้ไขแบบประเมินของกิจกรรมนี้"})
		return
	}

	var body setEventQuestionsBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`DELETE FROM event_evaluation_questions WHERE event_id = ?`, eventID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	sortOrder := 0
	for _, q := range body.Questions {
		label := strings.TrimSpace(q.Label)
		if label == "" {
			continue
		}
		qType := q.Type
		if qType != "choice" {
			qType = "scale"
		}
		var optionsJSON sql.NullString
		if qType == "choice" {
			opts := make([]string, 0, len(q.Options))
			for _, o := range q.Options {
				o = strings.TrimSpace(o)
				if o != "" {
					opts = append(opts, o)
				}
			}
			if len(opts) < 2 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "คำถามแบบเลือกตอบต้องมีอย่างน้อย 2 ตัวเลือก: " + label})
				return
			}
			encoded, _ := json.Marshal(opts)
			optionsJSON = sql.NullString{String: string(encoded), Valid: true}
		}
		if _, err := tx.Exec(
			`INSERT INTO event_evaluation_questions (event_id, label, sort_order, question_type, options, required) VALUES (?, ?, ?, ?, ?, ?)`,
			eventID, label, sortOrder, qType, optionsJSON, q.Required,
		); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		sortOrder++
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	h.EventQuestions(c)
}

type submitEvaluationBody struct {
	Answers []struct {
		QuestionID int `json:"question_id"`
		Score      int `json:"score"`
	} `json:"answers"`
	CustomAnswers []struct {
		QuestionID int     `json:"question_id"`
		Score      *int    `json:"score"`
		AnswerText *string `json:"answer_text"`
	} `json:"custom_answers"`
}

// Submit records a student's post-event evaluation for their own registration.
// One evaluation per registration (uq_eval_registration in the schema).
func (h *EvaluationsHandler) Submit(c *gin.Context) {
	regID := c.Param("id")

	var body submitEvaluationBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาตอบแบบประเมินให้ครบ"})
		return
	}
	for _, a := range body.Answers {
		if a.Score < 1 || a.Score > 5 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "คะแนนต้องอยู่ระหว่าง 1-5"})
			return
		}
	}

	var userID int64
	var regStatus string
	var eventID int64
	if err := h.DB.QueryRow(`SELECT user_id, status, event_id FROM registrations WHERE id = ?`, regID).Scan(&userID, &regStatus, &eventID); err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบรายการลงทะเบียน"})
		return
	} else if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	if userID != claims.UserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์ทำแบบประเมินนี้"})
		return
	}

	// Look up the event's own extra questions to validate each custom answer
	// against its declared type/options and to enforce required questions —
	// the client can't be trusted to send well-formed custom_answers.
	type customQDef struct {
		QType    string
		Options  map[string]bool
		Required bool
	}
	customQs := map[int]customQDef{}
	qRows, err := h.DB.Query(`SELECT id, question_type, options, required FROM event_evaluation_questions WHERE event_id = ?`, eventID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	for qRows.Next() {
		var id int
		var qType string
		var required int
		var options sql.NullString
		if err := qRows.Scan(&id, &qType, &options, &required); err != nil {
			qRows.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		def := customQDef{QType: qType, Required: required != 0}
		if options.Valid && options.String != "" {
			var opts []string
			_ = json.Unmarshal([]byte(options.String), &opts)
			def.Options = make(map[string]bool, len(opts))
			for _, o := range opts {
				def.Options[o] = true
			}
		}
		customQs[id] = def
	}
	qRows.Close()

	answered := map[int]bool{}
	for _, a := range body.CustomAnswers {
		def, ok := customQs[a.QuestionID]
		if !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "คำถามไม่ถูกต้อง"})
			return
		}
		if def.QType == "choice" {
			if a.AnswerText == nil || strings.TrimSpace(*a.AnswerText) == "" || !def.Options[*a.AnswerText] {
				c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาเลือกคำตอบที่ถูกต้อง"})
				return
			}
			a.Score = nil
		} else {
			if a.Score == nil || *a.Score < 1 || *a.Score > 5 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "คะแนนต้องอยู่ระหว่าง 1-5"})
				return
			}
			a.AnswerText = nil
		}
		answered[a.QuestionID] = true
	}
	for id, def := range customQs {
		if def.Required && !answered[id] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาตอบแบบประเมินให้ครบ"})
			return
		}
	}

	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`INSERT INTO evaluations (registration_id) VALUES (?)`, regID)
	if err != nil {
		if isDuplicateErr(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "คุณทำแบบประเมินนี้ไปแล้ว"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	evalID, _ := res.LastInsertId()

	for _, a := range body.Answers {
		if _, err := tx.Exec(`INSERT INTO evaluation_answers (evaluation_id, question_id, score) VALUES (?, ?, ?)`, evalID, a.QuestionID, a.Score); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
	}
	for _, a := range body.CustomAnswers {
		if _, err := tx.Exec(`INSERT INTO event_evaluation_answers (evaluation_id, question_id, score, answer_text) VALUES (?, ?, ?, ?)`, evalID, a.QuestionID, a.Score, a.AnswerText); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
	}

	// Submitting the evaluation is what the UI promises will "unlock" the
	// certificate — so issue it here in the same transaction, rather than
	// requiring a separate organizer-only call the student has no access to.
	// Only fires once (attended -> certified); re-submits can't happen anyway
	// since evaluations are unique per registration.
	var certCode string
	if regStatus == "attended" {
		certCode, err = nextCertCode(tx)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		if _, err := tx.Exec(`INSERT INTO certificates (registration_id, cert_code) VALUES (?, ?)`, regID, certCode); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		if _, err := tx.Exec(`UPDATE registrations SET status = 'certified' WHERE id = ?`, regID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
	}

	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if certCode != "" {
		activitylog.Log(h.DB, &claims.UserID, "ISSUE", "ออกเกียรติบัตร: "+certCode)
	}
	c.JSON(http.StatusCreated, gin.H{"cert_code": certCode})
}

type evalResultRow struct {
	QKey        string  `json:"q_key"`
	Label       string  `json:"label"`
	AvgScore    float64 `json:"avg_score"`
	ResponseCnt int     `json:"response_count"`
}

// Results returns the per-question average score for one event (organizer/admin).
func (h *EvaluationsHandler) Results(c *gin.Context) {
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
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์เข้าถึงผลประเมิน"})
		return
	}

	// Results are now built solely from each event's own custom questions —
	// the fixed standard 4 were dropped from the student-facing form, so they
	// never get answered and would only show up here as a constant 0.0.
	// Only scale-type custom questions are averaged here — choice-type ones
	// (e.g. เพศ, สาขาวิชา) don't have a meaningful average and are left out
	// of this endpoint; a future report can tally their answer_text instead.
	list := []evalResultRow{}
	customRows, err := h.DB.Query(
		`SELECT q.id, q.label, ROUND(AVG(ea.score), 2) AS avg_score, COUNT(ea.score) AS response_count
		 FROM event_evaluation_questions q
		 LEFT JOIN (
		   event_evaluation_answers ea
		   JOIN evaluations ev ON ev.id = ea.evaluation_id
		   JOIN registrations r ON r.id = ev.registration_id AND r.event_id = ?
		 ) ON ea.question_id = q.id
		 WHERE q.event_id = ? AND q.question_type = 'scale'
		 GROUP BY q.id, q.label, q.sort_order
		 ORDER BY q.sort_order ASC`, c.Param("id"), c.Param("id"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer customRows.Close()

	for customRows.Next() {
		var r evalResultRow
		var qID int
		var avg sql.NullFloat64
		if err := customRows.Scan(&qID, &r.Label, &avg, &r.ResponseCnt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		r.QKey = fmt.Sprintf("custom_%d", qID)
		r.AvgScore = avg.Float64
		list = append(list, r)
	}

	c.JSON(http.StatusOK, gin.H{"results": list})
}
