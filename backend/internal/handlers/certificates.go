package handlers

import (
	"database/sql"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
)

type CertificatesHandler struct {
	DB *sql.DB
}

func NewCertificatesHandler(db *sql.DB) *CertificatesHandler {
	return &CertificatesHandler{DB: db}
}

// queryRower is satisfied by both *sql.DB and *sql.Tx, so nextCertCode can
// participate in a caller's transaction (see EvaluationsHandler.Submit) or run
// standalone (see CertificatesHandler.Issue).
type queryRower interface {
	QueryRow(query string, args ...any) *sql.Row
}

func nextCertCode(db queryRower) (string, error) {
	year := time.Now().Year() + 543 // Buddhist calendar, matches existing seed data (e.g. SU-CS-2568-018)
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM certificates WHERE cert_code LIKE ?`, fmt.Sprintf("SU-CS-%d-%%", year)).Scan(&count); err != nil {
		return "", err
	}
	for seq := count + 1; ; seq++ {
		code := fmt.Sprintf("SU-CS-%d-%03d", year, seq)
		var exists int
		if err := db.QueryRow(`SELECT COUNT(*) FROM certificates WHERE cert_code = ?`, code).Scan(&exists); err != nil {
			return "", err
		}
		if exists == 0 {
			return code, nil
		}
	}
}

// Issue creates a certificate for a registration (organizer of the event or admin
// only) and bumps the registration's status to 'certified'. The registration must
// have been checked in (attended) first.
func (h *CertificatesHandler) Issue(c *gin.Context) {
	regID := c.Param("id")

	var (
		organizerID sql.NullInt64
		status      string
	)
	err := h.DB.QueryRow(
		`SELECT e.organizer_id, r.status FROM registrations r JOIN events e ON e.id = r.event_id WHERE r.id = ?`,
		regID,
	).Scan(&organizerID, &status)
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
		c.JSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์ออกเกียรติบัตร"})
		return
	}
	if status != "attended" && status != "certified" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ต้องเช็คอินก่อนจึงจะออกเกียรติบัตรได้"})
		return
	}

	var existingCode sql.NullString
	if err := h.DB.QueryRow(`SELECT cert_code FROM certificates WHERE registration_id = ?`, regID).Scan(&existingCode); err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if existingCode.Valid {
		c.JSON(http.StatusOK, gin.H{"cert_code": existingCode.String})
		return
	}

	code, err := nextCertCode(h.DB)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	if _, err := h.DB.Exec(`INSERT INTO certificates (registration_id, cert_code) VALUES (?, ?)`, regID, code); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if _, err := h.DB.Exec(`UPDATE registrations SET status = 'certified' WHERE id = ?`, regID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &claims.UserID, "ISSUE", "ออกเกียรติบัตร: "+code)
	c.JSON(http.StatusCreated, gin.H{"cert_code": code})
}

type myCertificateRow struct {
	CertCode  string `json:"cert_code"`
	IssuedAt  string `json:"issued_at"`
	EventID   int64  `json:"event_id"`
	Title     string `json:"title"`
	Category  string `json:"category"`
	DateStart string `json:"date_start"`
}

func (h *CertificatesHandler) MyCertificates(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	rows, err := h.DB.Query(
		`SELECT cert.cert_code, cert.issued_at, e.id, e.title, e.category, e.date_start
		 FROM certificates cert
		 JOIN registrations r ON r.id = cert.registration_id
		 JOIN events e ON e.id = r.event_id
		 WHERE r.user_id = ? ORDER BY cert.issued_at DESC`, claims.UserID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []myCertificateRow{}
	for rows.Next() {
		var r myCertificateRow
		if err := rows.Scan(&r.CertCode, &r.IssuedAt, &r.EventID, &r.Title, &r.Category, &r.DateStart); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, r)
	}
	c.JSON(http.StatusOK, gin.H{"certificates": list})
}

// Verify is a public lookup by certificate code (the "รหัสตรวจสอบ" printed on the certificate).
func (h *CertificatesHandler) Verify(c *gin.Context) {
	var (
		issuedAt, holderName, eventTitle, dateStart string
	)
	err := h.DB.QueryRow(
		`SELECT cert.issued_at, u.name, e.title, e.date_start
		 FROM certificates cert
		 JOIN registrations r ON r.id = cert.registration_id
		 JOIN users u ON u.id = r.user_id
		 JOIN events e ON e.id = r.event_id
		 WHERE cert.cert_code = ?`, c.Param("code"),
	).Scan(&issuedAt, &holderName, &eventTitle, &dateStart)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบเกียรติบัตรนี้ในระบบ"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"cert_code": c.Param("code"), "issued_at": issuedAt,
		"holder_name": holderName, "event_title": eventTitle, "event_date": dateStart,
	})
}
