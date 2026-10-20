package handlers

import (
	"strings"
	"unicode"
)

// Titles join the name with no space when they are the plain Thai ones or an
// abbreviation ending in "." ("นายสมชาย ใจดี", "ผศ.ดร.สมชาย ใจดี"); spelled-out
// ranks take a space ("ผู้ช่วยศาสตราจารย์ ดร.สมชาย"). English always takes one.
var thaiTitlesNoSpace = map[string]bool{"นาย": true, "นาง": true, "นางสาว": true, "เด็กชาย": true, "เด็กหญิง": true}

// FullNameTH is the name as printed on a Thai certificate.
func FullNameTH(title, name string) string {
	title, name = strings.TrimSpace(title), strings.TrimSpace(name)
	if title == "" {
		return name
	}
	if thaiTitlesNoSpace[title] || strings.HasSuffix(title, ".") {
		return title + name
	}
	return title + " " + name
}

const maxTitleLen = 40

// cleanName trims a name or title and caps it (Thai text counted by characters).
func cleanName(s string, max int) (string, bool) {
	s = strings.Join(strings.Fields(s), " ")
	return s, len([]rune(s)) <= max
}

// hasThai reports whether s has Thai letters (a Thai name, not an English one).
func hasThai(s string) bool {
	for _, r := range s {
		if unicode.Is(unicode.Thai, r) {
			return true
		}
	}
	return false
}
