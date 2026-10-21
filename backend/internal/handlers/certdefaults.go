package handlers

import (
	"database/sql"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
)

// CertDefaultsHandler serves the department-wide certificate defaults: the
// main template (with how text is fitted to it) and the usual signer. Every
// event without its own template is printed on this one, and new events start
// with this signer — only an admin may change them.
type CertDefaultsHandler struct {
	DB *sql.DB
}

func NewCertDefaultsHandler(db *sql.DB) *CertDefaultsHandler {
	return &CertDefaultsHandler{DB: db}
}

type certDefaults struct {
	TemplateID   *int64            `json:"template_id"`  // current main template version; null = the template built into the site
	TemplateURL  models.NullString `json:"template_url"` // that version's image
	Layout       models.NullString `json:"layout"`
	SignerName   models.NullString `json:"signer_name"`
	SignerTitle  models.NullString `json:"signer_title"`
	SignatureURL models.NullString `json:"signature_url"`
	UpdatedAt    models.NullString `json:"updated_at"`
	UpdatedBy    models.NullString `json:"updated_by"` // admin's name
}

// maxTemplateLen fits a 5 MB JPG/PNG once base64-encoded.
const maxTemplateLen = 7_000_000

func (h *CertDefaultsHandler) Get(c *gin.Context) {
	var d certDefaults
	var templateID sql.NullInt64
	var updated sql.NullInt64
	err := h.DB.QueryRow(
		`SELECT d.template_id, t.template_url, t.layout, d.signer_name, d.signer_title, d.signature_url,
		        UNIX_TIMESTAMP(d.updated_at), u.name
		 FROM cert_defaults d
		 LEFT JOIN cert_templates t ON t.id = d.template_id
		 LEFT JOIN users u ON u.id = d.updated_by WHERE d.id = 1`,
	).Scan(&templateID, &d.TemplateURL, &d.Layout, &d.SignerName, &d.SignerTitle, &d.SignatureURL, &updated, &d.UpdatedBy)
	if err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if err == sql.ErrNoRows {
		// Never saved yet: start from the signer the latest event with a
		// signature uses, so the page shows the signature already in use
		// instead of an empty box (saving makes it the real default).
		_ = h.DB.QueryRow(
			`SELECT cert_signer_name, cert_signer_title, cert_signature_url FROM events
			 WHERE COALESCE(cert_signature_url, '') <> '' ORDER BY updated_at DESC, id DESC LIMIT 1`,
		).Scan(&d.SignerName, &d.SignerTitle, &d.SignatureURL)
	}
	if templateID.Valid {
		d.TemplateID = &templateID.Int64
	}
	if updated.Valid {
		d.UpdatedAt = models.NullString{NullString: sql.NullString{String: time.Unix(updated.Int64, 0).UTC().Format(time.RFC3339), Valid: true}}
	}
	c.JSON(http.StatusOK, gin.H{"defaults": d}) // never saved yet: template null, signer from the latest event
}

// Template returns one saved version of the main template — what a
// certificate issued while it was current is drawn on.
func (h *CertDefaultsHandler) Template(c *gin.Context) {
	var url string
	var layout models.NullString
	err := h.DB.QueryRow(`SELECT template_url, layout FROM cert_templates WHERE id = ?`, c.Param("id")).Scan(&url, &layout)
	if err == sql.ErrNoRows {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบแม่แบบเกียรติบัตร"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.Header("Cache-Control", "private, max-age=86400") // a version never changes
	c.JSON(http.StatusOK, gin.H{"template_url": url, "layout": layout})
}

// Update replaces the defaults (admin only). A new image or layout is saved as
// a new version, so certificates already issued keep the one they were issued
// with; "" for the template goes back to the one built into the site.
func (h *CertDefaultsHandler) Update(c *gin.Context) {
	var b struct {
		TemplateURL  string `json:"template_url"`
		Layout       string `json:"layout"`
		SignerName   string `json:"signer_name"`
		SignerTitle  string `json:"signer_title"`
		SignatureURL string `json:"signature_url"`
	}
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	if b.TemplateURL != "" && (len(b.TemplateURL) > maxTemplateLen ||
		!(strings.HasPrefix(b.TemplateURL, "data:image/png;base64,") || strings.HasPrefix(b.TemplateURL, "data:image/jpeg;base64,"))) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "template ต้องเป็นไฟล์ JPG หรือ PNG ขนาดไม่เกิน 5 MB"})
		return
	}
	if !validCertLayout(b.Layout) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "การจัดวางข้อความบนเกียรติบัตรไม่ถูกต้อง"})
		return
	}
	if !validSignature(b.SignatureURL) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปลายเซ็นต้องเป็นไฟล์ PNG หรือ JPG ขนาดไม่เกิน 1 MB"})
		return
	}
	name, title := strings.TrimSpace(b.SignerName), strings.TrimSpace(b.SignerTitle)
	if name == "" || title == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกชื่อผู้ลงนามและตำแหน่งให้ครบ"})
		return
	}
	if len([]rune(name)) > 190 || len([]rune(title)) > 190 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ชื่อหรือตำแหน่งผู้ลงนามยาวเกินไป"})
		return
	}

	claims, _ := middleware.CurrentUser(c)
	tx, err := h.DB.Begin()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer tx.Rollback()

	// Keep the current version when neither the image nor the layout changed.
	var curID sql.NullInt64
	var curURL, curLayout sql.NullString
	if err := tx.QueryRow(
		`SELECT d.template_id, t.template_url, t.layout FROM cert_defaults d
		 LEFT JOIN cert_templates t ON t.id = d.template_id WHERE d.id = 1 FOR UPDATE`,
	).Scan(&curID, &curURL, &curLayout); err != nil && err != sql.ErrNoRows {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	var templateID any // NULL = built-in
	switch {
	case b.TemplateURL == "":
	case curID.Valid && curURL.String == b.TemplateURL && curLayout.String == b.Layout:
		templateID = curID.Int64
	default:
		res, err := tx.Exec(`INSERT INTO cert_templates (template_url, layout, created_by) VALUES (?, ?, ?)`,
			b.TemplateURL, nullIfEmpty(b.Layout), claims.UserID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		id, _ := res.LastInsertId()
		templateID = id
	}

	if _, err := tx.Exec(
		`INSERT INTO cert_defaults (id, template_id, signer_name, signer_title, signature_url, updated_by)
		 VALUES (1, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE template_id = VALUES(template_id), signer_name = VALUES(signer_name),
		   signer_title = VALUES(signer_title), signature_url = VALUES(signature_url), updated_by = VALUES(updated_by)`,
		templateID, name, title, nullIfEmpty(b.SignatureURL), claims.UserID,
	); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if err := tx.Commit(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	activitylog.Log(h.DB, &claims.UserID, "UPDATE", "แก้ไขค่าเริ่มต้นเกียรติบัตร (แม่แบบหลักและผู้ลงนาม)")
	h.Get(c)
}

// currentTemplateSQL is the main template version at this moment, recorded on
// each certificate as it is issued (NULL = the built-in one).
const currentTemplateSQL = `(SELECT template_id FROM cert_defaults WHERE id = 1)`
