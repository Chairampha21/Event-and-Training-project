package handlers

import (
	"database/sql"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/models"
)

type ActivityLogsHandler struct {
	DB *sql.DB
}

func NewActivityLogsHandler(db *sql.DB) *ActivityLogsHandler {
	return &ActivityLogsHandler{DB: db}
}

type activityLogRow struct {
	ID        int64             `json:"id"`
	UserName  models.NullString `json:"user_name"`
	UserRole  models.NullString `json:"user_role"` // null = done by the system
	Action    string            `json:"action"`
	Detail    models.NullString `json:"detail"`
	CreatedAt string            `json:"created_at"` // Thai local time, 'YYYY-MM-DD HH:MM:SS'
}

type dayCount struct {
	Day   string `json:"day"` // Thai date 'YYYY-MM-DD'
	Count int    `json:"count"`
}

type actionCount struct {
	Action string `json:"action"`
	Count  int    `json:"count"`
}

var logDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// List returns the activity log, newest first, a page at a time.
// Filters (all optional):
//
//	action  one action (LOGIN, CREATE ...); "" = everything but LOGIN; "all" = everything
//	role    admin | organizer | teacher | student | system (no user)
//	from/to Thai dates 'YYYY-MM-DD', inclusive
//	q       text in the user's name or the detail
//	before  id to continue below (the last id of the previous page)
//	limit   page size, default 100, at most 500
func (h *ActivityLogsHandler) List(c *gin.Context) {
	where := []string{"1=1"}
	args := []any{}
	switch action := strings.ToUpper(strings.TrimSpace(c.Query("action"))); action {
	case "":
		where = append(where, "l.action <> 'LOGIN'")
	case "ALL":
	default:
		where = append(where, "l.action = ?")
		args = append(args, action)
	}
	switch role := c.Query("role"); role {
	case "":
	case "system":
		where = append(where, "l.user_id IS NULL")
	case "admin", "organizer", "teacher", "student":
		where = append(where, "u.role = ?")
		args = append(args, role)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "บทบาทไม่ถูกต้อง"})
		return
	}
	if q := strings.TrimSpace(c.Query("q")); q != "" {
		where = append(where, "(u.name LIKE ? OR l.detail LIKE ? OR l.action LIKE ?)")
		like := "%" + q + "%"
		args = append(args, like, like, like)
	}
	// The days that have entries under the filters so far (not the date
	// itself), newest first, for the day picker.
	dayWhere, dayArgs := strings.Join(where, " AND "), append([]any{}, args...)

	// Times are stored in UTC; the filters and the page speak Thai time.
	for _, f := range []struct{ key, op string }{{"from", ">="}, {"to", "<="}} {
		v := c.Query(f.key)
		if v == "" {
			continue
		}
		if !logDateRe.MatchString(v) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "วันที่ไม่ถูกต้อง"})
			return
		}
		where = append(where, "DATE(l.created_at + INTERVAL 7 HOUR) "+f.op+" ?")
		args = append(args, v)
	}
	// Counts per action under the other filters, for the action picker.
	countWhere, countArgs := strings.Join(where, " AND "), append([]any{}, args...)

	if before, err := strconv.ParseInt(c.Query("before"), 10, 64); err == nil && before > 0 {
		where = append(where, "l.id < ?")
		args = append(args, before)
	}
	limit := 100
	if n, err := strconv.Atoi(c.Query("limit")); err == nil && n > 0 {
		limit = n
	}
	if limit > 500 {
		limit = 500
	}

	rows, err := h.DB.Query(
		`SELECT l.id, u.name, u.role, l.action, l.detail, DATE_FORMAT(l.created_at + INTERVAL 7 HOUR, '%Y-%m-%d %H:%i:%s')
		 FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
		 WHERE `+strings.Join(where, " AND ")+`
		 ORDER BY l.id DESC LIMIT ?`, append(args, limit+1)...,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer rows.Close()

	list := []activityLogRow{}
	for rows.Next() {
		var r activityLogRow
		if err := rows.Scan(&r.ID, &r.UserName, &r.UserRole, &r.Action, &r.Detail, &r.CreatedAt); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
			return
		}
		list = append(list, r)
	}
	hasMore := len(list) > limit
	if hasMore {
		list = list[:limit]
	}

	var total int
	if err := h.DB.QueryRow(`SELECT COUNT(*) FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id WHERE `+countWhere, countArgs...).Scan(&total); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	// Every action that exists, with how many match the other filters
	// (the action filter itself left out, so the picker can switch freely).
	actRows, err := h.DB.Query(`SELECT l.action, COUNT(*) FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
		 WHERE `+withoutAction(countWhere)+` GROUP BY l.action ORDER BY COUNT(*) DESC`, withoutActionArgs(c, countArgs)...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer actRows.Close()
	actions := []actionCount{}
	for actRows.Next() {
		var a actionCount
		if err := actRows.Scan(&a.Action, &a.Count); err == nil {
			actions = append(actions, a)
		}
	}
	dRows, err := h.DB.Query(`SELECT DATE_FORMAT(l.created_at + INTERVAL 7 HOUR, '%Y-%m-%d') d, COUNT(*) FROM activity_logs l LEFT JOIN users u ON u.id = l.user_id
		 WHERE `+dayWhere+` GROUP BY d ORDER BY d DESC LIMIT 120`, dayArgs...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในระบบ"})
		return
	}
	defer dRows.Close()
	days := []dayCount{}
	for dRows.Next() {
		var d dayCount
		if err := dRows.Scan(&d.Day, &d.Count); err == nil {
			days = append(days, d)
		}
	}
	c.JSON(http.StatusOK, gin.H{"logs": list, "has_more": hasMore, "total": total, "actions": actions, "days": days})
}

// withoutAction drops the action condition (always the second clause when
// present) from a WHERE built by List.
func withoutAction(where string) string {
	where = strings.Replace(where, " AND l.action <> 'LOGIN'", "", 1)
	return strings.Replace(where, " AND l.action = ?", "", 1)
}

// withoutActionArgs drops the action's argument when the filter named one.
func withoutActionArgs(c *gin.Context, args []any) []any {
	switch strings.ToUpper(strings.TrimSpace(c.Query("action"))) {
	case "", "ALL":
		return args
	}
	return args[1:]
}
