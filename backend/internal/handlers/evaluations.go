package handlers

import (
	"database/sql"
	"net/http"

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

type submitEvaluationBody struct {
	Answers []struct {
		QuestionID int `json:"question_id"`
		Score      int `json:"score"`
	} `json:"answers"`
}

// Submit records a student's post-event evaluation for their own registration.
// One evaluation per registration (uq_eval_registration in the schema).
func (h *EvaluationsHandler) Submit(c *gin.Context) {
	regID := c.Param("id")

	var body submitEvaluationBody
	if err := c.ShouldBindJSON(&body); err != nil || len(body.Answers) == 0 {
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
	if err := h.DB.QueryRow(`SELECT user_id, status FROM registrations WHERE id = ?`, regID).Scan(&userID, &regStatus); err == sql.ErrNoRows {
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

	// The event filter must narrow the answers *before* they're joined back to
	// evaluation_questions — filtering in the last LEFT JOIN's ON clause (as an
	// earlier version of this query did) doesn't exclude other events' answers,
	// it only nulls out the registrations columns, so counts/averages leaked
	// across every event that shared a question.
	rows, err := h.DB.Query(
		`SELECT q.q_key, q.label, ROUND(AVG(ea.score), 2) AS avg_score, COUNT(ea.score) AS response_count
		 FROM evaluation_questions q
		 LEFT JOIN (
		   evaluation_answers ea
		   JOIN evaluations ev ON ev.id = ea.evaluation_id
		   JOIN registrations r ON r.id = ev.registration_id AND r.event_id = ?
		 ) ON ea.question_id = q.id
		 GROUP BY q.id, q.q_key, q.label, q.sort_order
		 ORDER BY q.sort_order ASC`, c.Param("id"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []evalResultRow{}
	for rows.Next() {
		var r evalResultRow
		var avg sql.NullFloat64
		if err := rows.Scan(&r.QKey, &r.Label, &avg, &r.ResponseCnt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		r.AvgScore = avg.Float64
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"results": list})
}
