package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/config"
	"cpsu-etms-backend/internal/db"
	"cpsu-etms-backend/internal/handlers"
	"cpsu-etms-backend/internal/middleware"
)

func main() {
	cfg := config.Load()
	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is required (set it in .env)")
	}

	conn, err := db.Connect(cfg)
	if err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	defer conn.Close()

	auth := handlers.NewAuthHandler(conn, cfg.JWTSecret, cfg.JWTExpiresHours)
	events := handlers.NewEventsHandler(conn)
	regs := handlers.NewRegistrationsHandler(conn)
	certs := handlers.NewCertificatesHandler(conn)
	evals := handlers.NewEvaluationsHandler(conn)
	blacklist := handlers.NewBlacklistHandler(conn)
	sar := handlers.NewSARHandler(conn)
	notifs := handlers.NewNotificationsHandler(conn)
	dashboard := handlers.NewDashboardHandler(conn)
	users := handlers.NewUsersHandler(conn)
	activityLogs := handlers.NewActivityLogsHandler(conn)

	r := gin.Default()
	// Auth is a bearer JWT attached manually per-request (not a browser-managed
	// cookie), so credentialed CORS isn't needed — that lets CORS_ORIGIN=* work
	// for forwarded dev URLs without hitting the browser's
	// wildcard-origin-plus-credentials restriction.
	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{cfg.CORSOrigin},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders: []string{"Origin", "Content-Type", "Authorization"},
	}))

	requireAuth := middleware.RequireAuth(cfg.JWTSecret)
	optionalAuth := middleware.OptionalAuth(cfg.JWTSecret)

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"service": "CPSU ETMS API", "health": "/api/health"})
	})
	r.GET("/favicon.ico", func(c *gin.Context) { c.Status(204) })
	r.GET("/api/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", auth.Register)
		authGroup.POST("/login", auth.Login)
		authGroup.GET("/me", requireAuth, auth.Me)
	}

	eventsGroup := r.Group("/api/events")
	{
		eventsGroup.GET("", optionalAuth, events.List)
		eventsGroup.GET("/:id", optionalAuth, events.GetOne)
		eventsGroup.POST("", requireAuth, middleware.RequireRole("organizer", "admin"), events.Create)
		eventsGroup.PUT("/:id", requireAuth, middleware.RequireRole("organizer", "admin"), events.Update)
		eventsGroup.DELETE("/:id", requireAuth, middleware.RequireRole("organizer", "admin"), events.Remove)

		eventsGroup.POST("/:id/register", requireAuth, middleware.RequireRole("student"), regs.RegisterForEvent)
		eventsGroup.GET("/:id/registrations", requireAuth, middleware.RequireRole("organizer", "admin"), regs.EventRoster)

		eventsGroup.GET("/:id/sar", requireAuth, middleware.RequireRole("organizer", "admin"), sar.Get)
		eventsGroup.PUT("/:id/sar", requireAuth, middleware.RequireRole("organizer", "admin"), sar.Upsert)
		eventsGroup.GET("/:id/evaluations", requireAuth, middleware.RequireRole("organizer", "admin"), evals.Results)
		eventsGroup.GET("/:id/stats", requireAuth, middleware.RequireRole("organizer", "admin"), dashboard.EventStats)
	}

	r.GET("/api/me/registrations", requireAuth, middleware.RequireRole("student"), regs.MyRegistrations)
	r.DELETE("/api/registrations/:id", requireAuth, regs.CancelRegistration)
	r.PATCH("/api/registrations/:id/checkin", requireAuth, middleware.RequireRole("organizer", "admin"), regs.CheckIn)
	r.POST("/api/registrations/:id/certificate", requireAuth, middleware.RequireRole("organizer", "admin"), certs.Issue)
	r.POST("/api/registrations/:id/evaluation", requireAuth, middleware.RequireRole("student"), evals.Submit)

	r.GET("/api/me/certificates", requireAuth, middleware.RequireRole("student"), certs.MyCertificates)
	r.GET("/api/certificates/:code/verify", certs.Verify)
	r.GET("/api/evaluations/questions", evals.Questions)

	blacklistGroup := r.Group("/api/blacklist", requireAuth, middleware.RequireRole("organizer", "admin"))
	{
		blacklistGroup.GET("", blacklist.List)
		blacklistGroup.POST("", blacklist.Create)
		blacklistGroup.POST("/:id/restore", blacklist.Restore)
	}

	r.GET("/api/me/notifications", requireAuth, notifs.List)
	r.POST("/api/notifications/:id/read", requireAuth, notifs.MarkRead)

	r.GET("/api/dashboard/yearly", requireAuth, middleware.RequireRole("organizer", "admin"), dashboard.Yearly)

	usersGroup := r.Group("/api/users", requireAuth, middleware.RequireRole("admin"))
	{
		usersGroup.GET("", users.List)
		usersGroup.POST("", users.Create)
		usersGroup.PUT("/:id", users.Update)
		usersGroup.PATCH("/:id/active", users.SetActive)
		usersGroup.DELETE("/:id", users.Delete)
	}

	r.GET("/api/activity-logs", requireAuth, middleware.RequireRole("organizer", "admin"), activityLogs.List)

	r.NoRoute(func(c *gin.Context) { c.JSON(404, gin.H{"error": "ไม่พบ endpoint นี้"}) })

	log.Printf("CPSU ETMS API (Go) listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
