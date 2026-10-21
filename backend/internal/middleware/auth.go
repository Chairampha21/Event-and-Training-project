package middleware

import (
	"database/sql"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID int64  `json:"id"`
	Role   string `json:"role"`
	Name   string `json:"name"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

const userClaimsKey = "userClaims"

func extractClaims(c *gin.Context, secret string) (*Claims, bool) {
	header := c.GetHeader("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		return nil, false
	}
	tokenStr := strings.TrimPrefix(header, "Bearer ")

	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return nil, false
	}
	return claims, true
}

// refresh brings a token's claims up to date with the account as it is now.
// A token lives for days, so without this a suspended or deleted account kept
// working, and a changed role kept its old rights, until the token ran out.
// Reports false when the account no longer exists or is suspended.
func refresh(db *sql.DB, claims *Claims) bool {
	var role, name string
	var active bool
	if err := db.QueryRow(`SELECT role, name, active FROM users WHERE id = ?`, claims.UserID).Scan(&role, &name, &active); err != nil || !active {
		return false
	}
	claims.Role, claims.Name = role, name
	return true
}

// RequireAuth rejects the request unless a valid JWT for an active account is present.
func RequireAuth(secret string, db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := extractClaims(c, secret)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "ไม่ได้เข้าสู่ระบบ หรือเซสชันหมดอายุ"})
			return
		}
		if !refresh(db, claims) {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "บัญชีนี้ถูกระงับหรือไม่มีอยู่แล้ว · ติดต่อผู้ดูแลระบบ"})
			return
		}
		c.Set(userClaimsKey, claims)
		c.Next()
	}
}

// OptionalAuth decodes the token if present but never rejects the request,
// so public handlers can personalize their response for logged-in users.
func OptionalAuth(secret string, db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		if claims, ok := extractClaims(c, secret); ok && refresh(db, claims) {
			c.Set(userClaimsKey, claims)
		}
		c.Next()
	}
}

// RequireRole must run after RequireAuth/OptionalAuth.
func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		claims, ok := CurrentUser(c)
		if !ok {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์เข้าถึง"})
			return
		}
		for _, r := range roles {
			if claims.Role == r {
				c.Next()
				return
			}
		}
		c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "ไม่มีสิทธิ์เข้าถึง"})
	}
}

func CurrentUser(c *gin.Context) (*Claims, bool) {
	v, exists := c.Get(userClaimsKey)
	if !exists {
		return nil, false
	}
	claims, ok := v.(*Claims)
	return claims, ok
}
