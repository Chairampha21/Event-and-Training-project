package main

import (
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"cpsu-etms-backend/internal/config"
	"cpsu-etms-backend/internal/db"
	"cpsu-etms-backend/internal/handlers"
	"cpsu-etms-backend/internal/mailer"
	"cpsu-etms-backend/internal/middleware"
	"cpsu-etms-backend/internal/reminders"
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

	// Time-based work: reminders, registration-closed summaries, no-show counting.
	reminders.Start(conn)

	auth := handlers.NewAuthHandler(conn, cfg.JWTSecret, cfg.JWTExpiresHours, cfg.GoogleClientID)
	events := handlers.NewEventsHandler(conn)
	regs := handlers.NewRegistrationsHandler(conn)
	handlers.SetCheckinSecret(cfg.JWTSecret)
	mailer.Configure(mailer.Config{Host: cfg.SMTPHost, Port: cfg.SMTPPort, User: cfg.SMTPUser, Pass: cfg.SMTPPass, From: cfg.SMTPFrom})
	certs := handlers.NewCertificatesHandler(conn)
	evals := handlers.NewEvaluationsHandler(conn)
	blacklist := handlers.NewBlacklistHandler(conn)
	sar := handlers.NewSARHandler(conn)
	notifs := handlers.NewNotificationsHandler(conn)
	dashboard := handlers.NewDashboardHandler(conn)
	certDefaults := handlers.NewCertDefaultsHandler(conn)
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

	requireAuth := middleware.RequireAuth(cfg.JWTSecret, conn)
	optionalAuth := middleware.OptionalAuth(cfg.JWTSecret, conn)

	r.GET("/", func(c *gin.Context) {
		c.JSON(200, gin.H{"service": "CPSU ETMS API", "health": "/api/health"})
	})
	r.GET("/favicon.ico", func(c *gin.Context) { c.Status(204) })
	r.GET("/api/health", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/register", auth.Register)
		authGroup.POST("/login", auth.Login)
		authGroup.POST("/google", auth.GoogleLogin)
		authGroup.POST("/verify-email", auth.VerifyEmail)
		authGroup.POST("/resend-code", auth.ResendCode)
		authGroup.POST("/forgot-password", auth.ForgotPassword)
		authGroup.POST("/reset-password", auth.ResetPassword)
		authGroup.GET("/me", requireAuth, auth.Me)
		authGroup.PUT("/me", requireAuth, auth.UpdateMe)
	}

	eventsGroup := r.Group("/api/events")
	{
		eventsGroup.GET("", optionalAuth, events.List)
		eventsGroup.GET("/:id/assets/:asset", events.Asset) // poster | cert-template | signature
		eventsGroup.POST("", requireAuth, middleware.RequireRole("organizer", "admin"), events.Create)
		eventsGroup.PUT("/:id", requireAuth, middleware.RequireRole("organizer", "admin"), events.Update)
		eventsGroup.DELETE("/:id", requireAuth, middleware.RequireRole("organizer", "admin"), events.Remove)

		eventsGroup.POST("/:id/register", requireAuth, middleware.RequireRole("student", "teacher"), regs.RegisterForEvent)
		eventsGroup.POST("/:id/self-checkin", requireAuth, middleware.RequireRole("student", "teacher"), regs.SelfCheckIn)
		eventsGroup.GET("/:id/registrations", requireAuth, middleware.RequireRole("organizer", "admin", "teacher"), regs.EventRoster)

		eventsGroup.GET("/:id/sar", requireAuth, middleware.RequireRole("organizer", "admin"), sar.Get)
		eventsGroup.PUT("/:id/sar", requireAuth, middleware.RequireRole("organizer", "admin"), sar.Upsert)
		eventsGroup.GET("/:id/evaluations", requireAuth, middleware.RequireRole("organizer", "admin", "teacher"), evals.Results)
		eventsGroup.GET("/:id/evaluation-questions", requireAuth, evals.EventQuestions)
		eventsGroup.PUT("/:id/evaluation-questions", requireAuth, middleware.RequireRole("organizer", "admin"), evals.SetEventQuestions)
	}

	r.GET("/api/me/registrations", requireAuth, middleware.RequireRole("student", "teacher"), regs.MyRegistrations)
	r.DELETE("/api/registrations/:id", requireAuth, regs.CancelRegistration)
	r.PATCH("/api/registrations/:id/payment", requireAuth, middleware.RequireRole("organizer", "admin"), regs.SetPayment)
	r.POST("/api/registrations/:id/slip", requireAuth, middleware.RequireRole("student", "teacher"), regs.SubmitSlip)
	r.PATCH("/api/registrations/:id/refund-account", requireAuth, middleware.RequireRole("student", "teacher"), regs.SetRefundAccount)
	r.GET("/api/registrations/:id/slip", requireAuth, regs.GetSlip)
	r.PATCH("/api/registrations/:id/checkin", requireAuth, middleware.RequireRole("organizer", "admin"), regs.CheckIn)
	r.POST("/api/registrations/:id/certificate", requireAuth, middleware.RequireRole("organizer", "admin"), certs.Issue)
	r.POST("/api/registrations/:id/evaluation", requireAuth, middleware.RequireRole("student", "teacher"), evals.Submit)

	r.GET("/api/me/certificates", requireAuth, middleware.RequireRole("student", "teacher"), certs.MyCertificates)
	r.GET("/api/certificates/:code/verify", certs.Verify)
	r.GET("/api/evaluations/questions", evals.Questions)

	blacklistGroup := r.Group("/api/blacklist", requireAuth, middleware.RequireRole("organizer", "admin"))
	{
		blacklistGroup.GET("", blacklist.List)
		blacklistGroup.GET("/lookup", blacklist.LookupUsers)
		blacklistGroup.POST("", blacklist.Create)
		blacklistGroup.POST("/:id/restore", blacklist.Restore)
	}

	r.GET("/api/me/notifications", requireAuth, notifs.List)
	r.POST("/api/me/notifications/read-all", requireAuth, notifs.MarkAllRead)
	r.DELETE("/api/me/notifications", requireAuth, notifs.ClearAll)
	r.POST("/api/notifications/:id/read", requireAuth, notifs.MarkRead)

	r.GET("/api/dashboard/yearly", requireAuth, middleware.RequireRole("organizer", "admin"), dashboard.Yearly)
	r.GET("/api/dashboard/budget", requireAuth, middleware.RequireRole("organizer", "admin"), dashboard.Budget)
	r.GET("/api/dashboard/summary", requireAuth, dashboard.Summary)

	r.GET("/api/coordinators", requireAuth, middleware.RequireRole("organizer", "admin"), users.Coordinators)
	usersGroup := r.Group("/api/users", requireAuth, middleware.RequireRole("admin"))
	{
		usersGroup.GET("", users.List)
		usersGroup.POST("", users.Create)
		usersGroup.PUT("/:id", users.Update)
		usersGroup.PATCH("/:id/active", users.SetActive)
		usersGroup.DELETE("/:id", users.Delete)
	}

	r.GET("/api/activity-logs", requireAuth, middleware.RequireRole("admin"), activityLogs.List)
	// Department-wide certificate defaults: everyone signed in reads them (certificates are drawn
	// on the default template); only an admin changes them.
	r.GET("/api/settings/certificate", requireAuth, certDefaults.Get)
	r.GET("/api/settings/certificate/templates/:id", requireAuth, certDefaults.Template)
	r.PUT("/api/settings/certificate", requireAuth, middleware.RequireRole("admin"), certDefaults.Update)

	r.NoRoute(func(c *gin.Context) { c.JSON(404, gin.H{"error": "ไม่พบ endpoint นี้"}) })

	log.Printf("CPSU ETMS API (Go) listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
