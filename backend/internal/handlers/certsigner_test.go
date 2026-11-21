package handlers

import (
	"database/sql"
	"testing"

	"cpsu-etms-backend/internal/models"
)

func ns(s string) models.NullString { return models.NullString{NullString: sql.NullString{String: s, Valid: s != ""}} }

func TestSignerChanged(t *testing.T) {
	ev := models.Event{CertSignerName: ns("ผศ.ดร.ปิยะ"), CertSignerTitle: ns("หัวหน้าภาควิชา"), CertSignatureURL: ns("data:image/png;base64,AAA")}
	cases := []struct {
		name string
		raw  map[string]any
		want bool
	}{
		{"untouched", map[string]any{"title": "x"}, false},
		{"same values sent again", map[string]any{"cert_signer_name": "ผศ.ดร.ปิยะ ", "cert_signer_title": "หัวหน้าภาควิชา"}, false},
		{"new name", map[string]any{"cert_signer_name": "รศ.ดร.ใหม่"}, true},
		{"new title", map[string]any{"cert_signer_title": "รองหัวหน้า"}, true},
		{"new signature", map[string]any{"cert_signature_url": "data:image/png;base64,BBB"}, true},
		{"signature removed", map[string]any{"cert_signature_url": nil}, true},
	}
	for _, c := range cases {
		if got := signerChanged(c.raw, ev); got != c.want {
			t.Errorf("%s: got %v", c.name, got)
		}
	}
	if signerChanged(map[string]any{"cert_signature_url": nil}, models.Event{}) {
		t.Error("removing a signature that isn't there is no change")
	}
}
