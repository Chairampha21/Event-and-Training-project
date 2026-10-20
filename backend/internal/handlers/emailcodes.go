package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"math/big"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/mailer"
	"cpsu-etms-backend/internal/models"
)

// One-time codes mailed to a user: 'verify' confirms the @silpakorn.edu
// address after signing up (no log-in until then), 'reset' sets a new
// password. Codes are 6 digits, kept only as a hash, last codeTTL and allow
// codeTries wrong guesses; a new one can be asked for every codeCooldown, at
// most codesPerHour times an hour.
const (
	codeTTL      = 15 * time.Minute
	codeTries    = 5
	codeCooldown = 60 * time.Second
	codesPerHour = 5
)

func (h *AuthHandler) codeHash(userID int64, purpose, code string) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s|%s|%d|%s", h.JWTSecret, purpose, userID, code)))
	return hex.EncodeToString(sum[:])
}

// issueCode makes and mails a new code. It returns how long to wait when one
// was sent too recently (nothing is sent then).
func (h *AuthHandler) issueCode(userID int64, email, name, purpose string) (wait time.Duration, err error) {
	// Seconds since the last code (NULL when none) and how many in the last hour.
	// (The driver runs without parseTime, so times are compared in SQL.)
	var sinceLast sql.NullInt64
	var lastHour int
	if err := h.DB.QueryRow(
		`SELECT TIMESTAMPDIFF(SECOND, MAX(created_at), UTC_TIMESTAMP()),
		        COUNT(CASE WHEN created_at > UTC_TIMESTAMP() - INTERVAL 1 HOUR THEN 1 END)
		 FROM email_codes WHERE user_id = ? AND purpose = ?`,
		userID, purpose,
	).Scan(&sinceLast, &lastHour); err != nil {
		return 0, err
	}
	if sinceLast.Valid {
		if since := time.Duration(sinceLast.Int64) * time.Second; since < codeCooldown {
			return codeCooldown - since, nil
		}
	}
	if lastHour >= codesPerHour {
		return time.Hour, nil
	}
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return 0, err
	}
	code := fmt.Sprintf("%06d", n.Int64())
	// A new code replaces any earlier one of the same kind.
	if _, err := h.DB.Exec(`UPDATE email_codes SET used_at = UTC_TIMESTAMP() WHERE user_id = ? AND purpose = ? AND used_at IS NULL`, userID, purpose); err != nil {
		return 0, err
	}
	if _, err := h.DB.Exec(
		`INSERT INTO email_codes (user_id, purpose, code_hash, expires_at, created_at)
		 VALUES (?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? SECOND, UTC_TIMESTAMP())`,
		userID, purpose, h.codeHash(userID, purpose, code), int(codeTTL.Seconds()),
	); err != nil {
		return 0, err
	}
	mailer.Code(email, name, code, purpose)
	return 0, nil
}

// checkCode uses up the user's current code when it matches. On failure it
// returns the message to show (wrong code with tries left, expired, ...).
func (h *AuthHandler) checkCode(userID int64, purpose, code string) (bool, string) {
	var id int64
	var hash string
	var attempts int
	var expired bool
	err := h.DB.QueryRow(
		`SELECT id, code_hash, attempts, expires_at < UTC_TIMESTAMP() FROM email_codes
		 WHERE user_id = ? AND purpose = ? AND used_at IS NULL ORDER BY id DESC LIMIT 1`,
		userID, purpose,
	).Scan(&id, &hash, &attempts, &expired)
	if err == sql.ErrNoRows {
		return false, "ไม่มีรหัสที่ใช้ได้ · กด \"ส่งรหัสใหม่\""
	}
	if err != nil {
		return false, "เกิดข้อผิดพลาดในระบบ"
	}
	if expired {
		return false, "รหัสหมดอายุแล้ว · กด \"ส่งรหัสใหม่\""
	}
	if attempts >= codeTries {
		return false, "ใส่รหัสผิดเกินกำหนด · กด \"ส่งรหัสใหม่\""
	}
	if h.codeHash(userID, purpose, strings.TrimSpace(code)) != hash {
		_, _ = h.DB.Exec(`UPDATE email_codes SET attempts = attempts + 1 WHERE id = ?`, id)
		if left := codeTries - attempts - 1; left > 0 {
			return false, fmt.Sprintf("รหัสไม่ถูกต้อง · ลองได้อีก %d ครั้ง", left)
		}
		return false, "ใส่รหัสผิดเกินกำหนด · กด \"ส่งรหัสใหม่\""
	}
	_, _ = h.DB.Exec(`UPDATE email_codes SET used_at = UTC_TIMESTAMP() WHERE id = ?`, id)
	return true, ""
}

type accountRow struct {
	user     models.User
	verified bool
}

func (h *AuthHandler) accountByEmail(email string) (accountRow, error) {
	var a accountRow
	var active int
	err := h.DB.QueryRow(`SELECT `+userPublicFields+`, email_verified_at IS NOT NULL FROM users WHERE email = ?`, email).Scan(
		&a.user.ID, &a.user.Name, &a.user.TitleTH, &a.user.NameEN, &a.user.TitleEN, &a.user.Email, &a.user.Role, &a.user.StudentID, &a.user.Dept, &active, &a.user.CreatedAt, &a.verified)
	a.user.Active = active == 1
	return a, err
}

func waitMessage(wait time.Duration) string {
	if wait >= time.Hour {
		return "ขอรหัสบ่อยเกินไป กรุณาลองใหม่ในอีก 1 ชั่วโมง"
	}
	return fmt.Sprintf("ส่งรหัสใหม่ได้ในอีก %d วินาที", int(wait.Seconds())+1)
}

func normEmail(s string) string { return strings.ToLower(strings.TrimSpace(s)) }

// VerifyEmail confirms a self sign-up's address with the code mailed to it
// and signs the person in.
func (h *AuthHandler) VerifyEmail(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	a, err := h.accountByEmail(normEmail(body.Email))
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสไม่ถูกต้อง"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if !a.verified {
		if ok, msg := h.checkCode(a.user.ID, "verify", body.Code); !ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": msg})
			return
		}
		if _, err := h.DB.Exec(`UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ?`, a.user.ID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		activitylog.Log(h.DB, &a.user.ID, "UPDATE", "ยืนยันอีเมลสำเร็จ: "+a.user.Email)
	}
	if !a.user.Active {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้ถูกระงับการใช้งาน"})
		return
	}
	token, err := h.signToken(a.user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": a.user, "token": token})
}

// ResendCode mails a fresh code ('verify' or 'reset'). The answer does not
// reveal whether the address has an account.
func (h *AuthHandler) ResendCode(c *gin.Context) {
	var body struct {
		Email   string `json:"email"`
		Purpose string `json:"purpose"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || (body.Purpose != "verify" && body.Purpose != "reset") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	a, err := h.accountByEmail(normEmail(body.Email))
	if err == nil && a.user.Active && (body.Purpose == "reset" || !a.verified) {
		wait, err := h.issueCode(a.user.ID, a.user.Email, a.user.Name, body.Purpose)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		if wait > 0 {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": waitMessage(wait), "retry_after": int(wait.Seconds()) + 1})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"sent": true, "retry_after": int(codeCooldown.Seconds())})
}

// ForgotPassword mails a 'reset' code when the address has an active account.
// It answers the same either way, so it can't be used to find accounts.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var body struct {
		Email string `json:"email"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	email := normEmail(body.Email)
	if !strings.HasSuffix(email, "@silpakorn.edu") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ใช้อีเมลของมหาวิทยาลัย @silpakorn.edu"})
		return
	}
	if a, err := h.accountByEmail(email); err == nil && a.user.Active {
		if wait, err := h.issueCode(a.user.ID, a.user.Email, a.user.Name, "reset"); err == nil && wait > 0 {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": waitMessage(wait), "retry_after": int(wait.Seconds()) + 1})
			return
		}
	}
	c.JSON(http.StatusOK, gin.H{"sent": true, "retry_after": int(codeCooldown.Seconds())})
}

// ResetPassword sets a new password with a 'reset' code and signs in. Having
// the code also proves the address, so an unconfirmed sign-up is confirmed too.
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var body struct {
		Email    string `json:"email"`
		Code     string `json:"code"`
		Password string `json:"password"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	if len(body.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"})
		return
	}
	a, err := h.accountByEmail(normEmail(body.Email))
	if err == sql.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสไม่ถูกต้อง"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if ok, msg := h.checkCode(a.user.ID, "reset", body.Code); !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if _, err := h.DB.Exec(`UPDATE users SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, UTC_TIMESTAMP()) WHERE id = ?`, string(hash), a.user.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	activitylog.Log(h.DB, &a.user.ID, "UPDATE", "ตั้งรหัสผ่านใหม่ด้วยรหัสทางอีเมล")
	if !a.user.Active {
		c.JSON(http.StatusForbidden, gin.H{"error": "ตั้งรหัสผ่านใหม่แล้ว แต่บัญชีนี้ถูกระงับการใช้งาน"})
		return
	}
	token, err := h.signToken(a.user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": a.user, "token": token})
}
