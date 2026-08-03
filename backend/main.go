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

	r := gin.Default()
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.CORSOrigin},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
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
	}

	r.GET("/api/me/registrations", requireAuth, middleware.RequireRole("student"), regs.MyRegistrations)
	r.DELETE("/api/registrations/:id", requireAuth, regs.CancelRegistration)

	r.NoRoute(func(c *gin.Context) { c.JSON(404, gin.H{"error": "ไม่พบ endpoint นี้"}) })

	log.Printf("CPSU ETMS API (Go) listening on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatal(err)
	}
}
