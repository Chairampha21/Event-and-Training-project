// Package mailer sends the system's emails (sign-up and password-reset codes)
// through an SMTP server, e.g. Gmail with an app password. Without SMTP_HOST
// it prints each email to the log instead, so the flows can be tried locally.
package mailer

import (
	"fmt"
	"log"
	"mime"
	"net/smtp"
	"strings"
	"time"
)

type Config struct {
	Host string // e.g. smtp.gmail.com; empty = log instead of sending
	Port string // 587 (STARTTLS)
	User string
	Pass string
	From string // "CPSU ETMS <name@gmail.com>"; defaults to User
}

var cfg Config

func Configure(c Config) {
	cfg = c
	if cfg.Port == "" {
		cfg.Port = "587"
	}
	if cfg.From == "" {
		cfg.From = cfg.User
	}
	if cfg.Host == "" {
		log.Printf("mailer: SMTP_HOST not set — emails are written to this log instead of being sent")
	}
}

// Enabled reports whether emails really go out.
func Enabled() bool { return cfg.Host != "" }

// Send delivers a plain-text email in the background (the request does not
// wait for the mail server); failures are logged.
func Send(to, subject, body string) {
	if !Enabled() {
		log.Printf("[mail:dev] to=%s subject=%q\n%s", to, subject, body)
		return
	}
	go func() {
		addr := cfg.Host + ":" + cfg.Port
		var auth smtp.Auth
		if cfg.User != "" {
			auth = smtp.PlainAuth("", cfg.User, cfg.Pass, cfg.Host)
		}
		from := cfg.From
		envelope := from
		if i := strings.LastIndex(from, "<"); i >= 0 {
			envelope = strings.Trim(from[i:], "<>")
		}
		msg := strings.Join([]string{
			"From: " + from,
			"To: " + to,
			"Subject: " + mime.QEncoding.Encode("utf-8", subject),
			"Date: " + time.Now().Format(time.RFC1123Z),
			"MIME-Version: 1.0",
			"Content-Type: text/plain; charset=utf-8",
			"Content-Transfer-Encoding: 8bit",
			"",
			body,
		}, "\r\n")
		if err := smtp.SendMail(addr, auth, envelope, []string{to}, []byte(msg)); err != nil {
			log.Printf("mailer: sending %q to %s failed: %v", subject, to, err)
		}
	}()
}

// Code is the email carrying a one-time code.
func Code(to, name, code, purpose string) {
	what, subject := "ยืนยันอีเมลสำหรับสมัครสมาชิก", "รหัสยืนยันอีเมล CPSU ETMS: "+code
	if purpose == "reset" {
		what, subject = "ตั้งรหัสผ่านใหม่", "รหัสตั้งรหัสผ่านใหม่ CPSU ETMS: "+code
	}
	Send(to, subject, fmt.Sprintf(`เรียน %s

รหัสสำหรับ%sในระบบ CPSU ETMS คือ

    %s

รหัสนี้ใช้ได้ 15 นาที · อย่าบอกรหัสนี้กับผู้อื่น
หากคุณไม่ได้ทำรายการนี้ ไม่ต้องทำอะไร บัญชีของคุณยังปลอดภัย

ภาควิชาคอมพิวเตอร์ คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร`, name, what, code))
}
