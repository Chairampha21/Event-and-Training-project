package handlers

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"cpsu-etms-backend/internal/activitylog"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/models"
	"cpsu-etms-backend/internal/reminders"
)

type AuthHandler struct {
	DB              *sql.DB
	JWTSecret       string
	JWTExpiresHours int
	GoogleClientID  string
}

func NewAuthHandler(db *sql.DB, jwtSecret string, jwtExpiresHours int, googleClientID string) *AuthHandler {
	return &AuthHandler{DB: db, JWTSecret: jwtSecret, JWTExpiresHours: jwtExpiresHours, GoogleClientID: googleClientID}
}

func (h *AuthHandler) signToken(u models.User) (string, error) {
	claims := middleware.Claims{
		UserID: u.ID,
		Role:   u.Role,
		Name:   u.Name,
		Email:  u.Email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(h.JWTExpiresHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.JWTSecret))
}

const userPublicFields = `id, name, title_th, name_en, title_en, email, role, student_id, dept, active, created_at`

func scanUser(row interface{ Scan(dest ...any) error }) (models.User, error) {
	var u models.User
	var active int
	err := row.Scan(&u.ID, &u.Name, &u.TitleTH, &u.NameEN, &u.TitleEN, &u.Email, &u.Role, &u.StudentID, &u.Dept, &active, &u.CreatedAt)
	u.Active = active == 1
	return u, err
}

type registerBody struct {
	Name      string `json:"name"`
	TitleTH   string `json:"title_th"`
	NameEN    string `json:"name_en"`
	TitleEN   string `json:"title_en"`
	Email     string `json:"email"`
	Password  string `json:"password"`
	StudentID string `json:"student_id"`
	Dept      string `json:"dept"`
}

// Register always creates a 'student' account — admin/organizer accounts are
// provisioned separately (see database/schema.sql seed comment).
func (h *AuthHandler) Register(c *gin.Context) {
	var body registerBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	name := strings.TrimSpace(body.Name)
	email := strings.ToLower(strings.TrimSpace(body.Email))

	if name == "" || email == "" || body.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกชื่อ อีเมล และรหัสผ่านให้ครบ"})
		return
	}
	name, titleTH, nameEN, titleEN, msg := checkNames(body.Name, body.TitleTH, body.NameEN, body.TitleEN)
	if msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}
	if !strings.HasSuffix(email, "@silpakorn.edu") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ต้องใช้อีเมล @silpakorn.edu เท่านั้น"})
		return
	}
	if len(body.Password) < 8 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	// The account stays unconfirmed — no log-in — until the code mailed to the
	// address is entered (VerifyEmail), so only someone with that university
	// mailbox gets in. Signing up again for an address nobody has confirmed
	// takes it over (new name and password, new code): a wrong or someone
	// else's sign-up can't hold an address hostage.
	existing, err := h.accountByEmail(email)
	var userID int64
	switch {
	case err == sql.ErrNoRows:
		res, err := h.DB.Exec(
			`INSERT INTO users (name, title_th, name_en, title_en, email, password_hash, role, student_id, dept) VALUES (?, ?, ?, ?, ?, ?, 'student', ?, ?)`,
			name, titleTH, nullIfEmpty(nameEN), nullIfEmpty(titleEN), email, string(hash), nullIfEmpty(body.StudentID), nullIfEmpty(body.Dept),
		)
		if err != nil {
			if isDuplicateErr(err) {
				c.JSON(http.StatusConflict, gin.H{"error": "อีเมลนี้ถูกใช้งานแล้ว"})
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		userID, _ = res.LastInsertId()
		activitylog.Log(h.DB, &userID, "CREATE", "สมัครสมาชิกใหม่ (รอยืนยันอีเมล): "+name)
	case err != nil:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	case existing.verified:
		c.JSON(http.StatusConflict, gin.H{"error": "อีเมลนี้มีบัญชีอยู่แล้ว · เข้าสู่ระบบ หรือใช้ \"ลืมรหัสผ่าน\""})
		return
	default:
		userID = existing.user.ID
		if _, err := h.DB.Exec(`UPDATE users SET name = ?, title_th = ?, name_en = ?, title_en = ?, password_hash = ?, student_id = ?, dept = ? WHERE id = ?`,
			name, titleTH, nullIfEmpty(nameEN), nullIfEmpty(titleEN), string(hash), nullIfEmpty(body.StudentID), nullIfEmpty(body.Dept), userID); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
	}

	wait, err := h.issueCode(userID, email, name, "verify")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	retry := int(codeCooldown.Seconds())
	if wait > 0 {
		retry = int(wait.Seconds()) + 1 // a code from a moment ago is still on its way
	}
	c.JSON(http.StatusCreated, gin.H{"verification_required": true, "email": email, "retry_after": retry})
}

type loginBody struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var body loginBody
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(body.Email))
	if email == "" || body.Password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรอกอีเมลและรหัสผ่าน"})
		return
	}

	var (
		u            models.User
		passwordHash string
		active       int
	)
	row := h.DB.QueryRow(
		`SELECT id, name, title_th, name_en, title_en, email, role, student_id, dept, active, created_at, password_hash, email_verified_at IS NOT NULL FROM users WHERE email = ?`,
		email,
	)
	var verified bool
	err := row.Scan(&u.ID, &u.Name, &u.TitleTH, &u.NameEN, &u.TitleEN, &u.Email, &u.Role, &u.StudentID, &u.Dept, &active, &u.CreatedAt, &passwordHash, &verified)
	if err == sql.ErrNoRows || active != 1 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	u.Active = true

	if bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(body.Password)) != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "อีเมลหรือรหัสผ่านไม่ถูกต้อง"})
		return
	}
	// Right password, address not confirmed yet: send a code (unless one went
	// out a moment ago) and ask for it instead of signing in.
	if !verified {
		wait, err := h.issueCode(u.ID, u.Email, u.Name, "verify")
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		retry := int(codeCooldown.Seconds())
		if wait > 0 {
			retry = int(wait.Seconds()) + 1
		}
		c.JSON(http.StatusForbidden, gin.H{"error": "ยังไม่ได้ยืนยันอีเมล · กรอกรหัส 6 หลักที่ส่งไปที่ " + u.Email,
			"verification_required": true, "email": u.Email, "retry_after": retry})
		return
	}

	token, err := h.signToken(u)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &u.ID, "LOGIN", "")
	if u.Role == "admin" {
		reminders.AdminDigest(h.DB, u.ID) // what is waiting across the system, at most once a day
	}
	c.JSON(http.StatusOK, gin.H{"user": u, "token": token})
}

type googleLoginBody struct {
	Credential string `json:"credential"`
}

// googleTokenInfo mirrors the subset of fields Google's tokeninfo endpoint
// returns for an ID token that we actually need to validate and provision
// an account from — see https://oauth2.googleapis.com/tokeninfo?id_token=...
type googleTokenInfo struct {
	Aud           string `json:"aud"`
	Email         string `json:"email"`
	EmailVerified string `json:"email_verified"`
	HD            string `json:"hd"`
	Name          string `json:"name"`
	Error         string `json:"error_description"`
}

// GoogleLogin verifies a Google Identity Services ID token and either logs
// in the matching existing account or auto-provisions a new 'student'
// account for it — same @silpakorn.edu restriction as manual registration,
// enforced here (not just relied on via Google Workspace hd) since this app
// isn't necessarily running under a Workspace-restricted OAuth consent screen.
func (h *AuthHandler) GoogleLogin(c *gin.Context) {
	if h.GoogleClientID == "" {
		c.JSON(http.StatusNotImplemented, gin.H{"error": "ยังไม่ได้ตั้งค่า Google Sign-In บนระบบนี้"})
		return
	}
	var body googleLoginBody
	if err := c.ShouldBindJSON(&body); err != nil || body.Credential == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}

	resp, err := http.Get("https://oauth2.googleapis.com/tokeninfo?id_token=" + body.Credential)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "ตรวจสอบบัญชี Google ไม่สำเร็จ"})
		return
	}
	defer resp.Body.Close()

	var info googleTokenInfo
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "ตรวจสอบบัญชี Google ไม่สำเร็จ"})
		return
	}
	if resp.StatusCode != http.StatusOK || info.Error != "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "โทเคน Google ไม่ถูกต้องหรือหมดอายุ"})
		return
	}
	if info.Aud != h.GoogleClientID {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "โทเคน Google ไม่ตรงกับระบบนี้"})
		return
	}
	if info.EmailVerified != "true" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "อีเมล Google ยังไม่ได้ยืนยัน"})
		return
	}
	email := strings.ToLower(strings.TrimSpace(info.Email))
	if !strings.HasSuffix(email, "@silpakorn.edu") {
		c.JSON(http.StatusForbidden, gin.H{"error": "ต้องใช้บัญชี Google ของอีเมล @silpakorn.edu เท่านั้น"})
		return
	}

	row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE email = ?`, email)
	user, err := scanUser(row)
	isNew := false
	if err == sql.ErrNoRows {
		isNew = true
		randomHash, herr := bcrypt.GenerateFromPassword([]byte(randomHex(32)), bcrypt.DefaultCost)
		if herr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		name := strings.TrimSpace(info.Name)
		if name == "" {
			name = email
		}
		res, ierr := h.DB.Exec(
			// Google's name is usually in English: it goes into name_en as well;
			// the person is asked for the Thai name and title on first sign-in.
			`INSERT INTO users (name, name_en, email, password_hash, role, email_verified_at) VALUES (?, ?, ?, ?, 'student', UTC_TIMESTAMP())`,
			name, name, email, string(randomHash),
		)
		if ierr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		id, _ := res.LastInsertId()
		row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE id = ?`, id)
		user, err = scanUser(row)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	if !user.Active {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้ถูกระงับการใช้งาน"})
		return
	}
	// Google has checked the address belongs to this person.
	_, _ = h.DB.Exec(`UPDATE users SET email_verified_at = UTC_TIMESTAMP() WHERE id = ? AND email_verified_at IS NULL`, user.ID)
	// Google Sign-In is a participant convenience path only (students and
	// teachers) — staff (organizer/admin) keep using email + password so
	// account access stays deliberate.
	if !isParticipant(user.Role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "เข้าสู่ระบบด้วย Google ใช้ได้เฉพาะบัญชีนักศึกษาและอาจารย์ กรุณาเข้าสู่ระบบด้วยอีเมลและรหัสผ่าน"})
		return
	}

	token, err := h.signToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	if isNew {
		activitylog.Log(h.DB, &user.ID, "CREATE", "สมัครสมาชิกใหม่ผ่าน Google: "+user.Name)
	} else {
		activitylog.Log(h.DB, &user.ID, "LOGIN", "เข้าสู่ระบบด้วย Google")
	}
	c.JSON(http.StatusOK, gin.H{"user": user, "token": token})
}

func randomHex(n int) string {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

type updateMeBody struct {
	Name      string `json:"name"`
	TitleTH   string `json:"title_th"`
	NameEN    string `json:"name_en"`
	TitleEN   string `json:"title_en"`
	Dept      string `json:"dept"`
	StudentID string `json:"student_id"`
}

// UpdateMe lets a logged-in user edit their own display name/dept/student ID
// — email and role are deliberately not editable here (those stay admin-only
// via the /users endpoints, to avoid self-service privilege changes).
func (h *AuthHandler) UpdateMe(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	var b updateMeBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง"})
		return
	}
	name, titleTH, nameEN, titleEN, msg := checkNames(b.Name, b.TitleTH, b.NameEN, b.TitleEN)
	if msg != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": msg})
		return
	}

	_, err := h.DB.Exec(
		`UPDATE users SET name = ?, title_th = ?, name_en = ?, title_en = ?, dept = ?, student_id = ? WHERE id = ?`,
		name, titleTH, nullIfEmpty(nameEN), nullIfEmpty(titleEN), nullIfEmpty(b.Dept), nullIfEmpty(b.StudentID), claims.UserID,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	row := h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE id = ?`, claims.UserID)
	user, err := scanUser(row)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}

	activitylog.Log(h.DB, &claims.UserID, "UPDATE", "แก้ไขโปรไฟล์ตนเอง")
	c.JSON(http.StatusOK, gin.H{"user": user})
}

func nullIfEmpty(s string) any {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return s
}

func isDuplicateErr(err error) bool {
	return strings.Contains(err.Error(), "Error 1062")
}

// checkNames tidies and checks the Thai name with its title and the optional
// English name: the Thai name and title are required and the name must be in
// Thai (it is what Thai certificates print).
func checkNames(name, titleTH, nameEN, titleEN string) (string, string, string, string, string) {
	var ok1, ok2, ok3, ok4 bool
	name, ok1 = cleanName(name, 150)
	titleTH, ok2 = cleanName(titleTH, maxTitleLen)
	nameEN, ok3 = cleanName(nameEN, 150)
	titleEN, ok4 = cleanName(titleEN, maxTitleLen)
	switch {
	case titleTH == "":
		return "", "", "", "", "เลือกคำนำหน้าชื่อ"
	case name == "":
		return "", "", "", "", "กรอกชื่อ-นามสกุลภาษาไทย"
	case !hasThai(name):
		return "", "", "", "", "ชื่อ-นามสกุลภาษาไทยต้องพิมพ์เป็นภาษาไทย · ชื่อภาษาอังกฤษให้ใส่ในช่องภาษาอังกฤษ"
	case nameEN != "" && hasThai(nameEN):
		return "", "", "", "", "ชื่อ-นามสกุลภาษาอังกฤษต้องพิมพ์เป็นภาษาอังกฤษ"
	case !ok1 || !ok2 || !ok3 || !ok4:
		return "", "", "", "", "ชื่อหรือคำนำหน้ายาวเกินไป"
	}
	return name, titleTH, nameEN, titleEN, ""
}

// Me returns the signed-in user as stored now, so the page can refresh what it
// remembered at sign-in (name, title, role...).
func (h *AuthHandler) Me(c *gin.Context) {
	claims, _ := middleware.CurrentUser(c)
	user, err := scanUser(h.DB.QueryRow(`SELECT `+userPublicFields+` FROM users WHERE id = ?`, claims.UserID))
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบบัญชีผู้ใช้"})
		return
	}
	if !user.Active {
		c.JSON(http.StatusForbidden, gin.H{"error": "บัญชีนี้ถูกระงับการใช้งาน"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"user": user})
}
