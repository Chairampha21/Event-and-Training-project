package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestReadWithGemini(t *testing.T) {
	var gotKey, gotPath string
	var gotBody map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotKey, gotPath = r.Header.Get("x-goog-api-key"), r.URL.Path
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		w.Write([]byte(`{"candidates":[{"content":{"role":"model","parts":[{"text":"` + "```json\\n" + `{\"title\":\"English Camp\",\"days\":[{\"date\":\"2025-11-23\",\"start\":\"07:30\",\"end\":\"16:00\"}],\"fee\":null}` + "\\n```" + `"}]},"finishReason":"STOP"}]}`))
	}))
	defer srv.Close()
	h := &PosterReadHandler{geminiKey: "k", geminiModel: "m", geminiBase: srv.URL, http: srv.Client()}

	text, err := h.readWithGemini(context.Background(), "image/jpeg", "QUJD", "Read this poster.")
	if err != nil {
		t.Fatal(err)
	}
	if gotKey != "k" || gotPath != "/v1beta/models/m:generateContent" {
		t.Fatalf("key %q path %q", gotKey, gotPath)
	}
	parts := gotBody["contents"].([]any)[0].(map[string]any)["parts"].([]any)
	if parts[0].(map[string]any)["inlineData"].(map[string]any)["mimeType"] != "image/jpeg" {
		t.Fatalf("image part: %v", parts[0])
	}
	var f posterFields
	if err := json.Unmarshal([]byte(stripCodeFence(text)), &f); err != nil || *f.Title != "English Camp" || f.Days[0].Start == nil || *f.Days[0].Start != "07:30" {
		t.Fatalf("parsed %+v, err %v, text %q", f, err, text)
	}
}

func TestReadWithGeminiErrors(t *testing.T) {
	for status, want := range map[int]*posterErr{429: errPosterBusy, 400: errPosterFailed} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(status) }))
		h := &PosterReadHandler{geminiKey: "k", geminiModel: "m", geminiBase: srv.URL, http: srv.Client()}
		if _, err := h.readWithGemini(context.Background(), "image/png", "QQ==", "x"); err != want {
			t.Errorf("HTTP %d: got %v", status, err)
		}
		srv.Close()
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"candidates":[{"content":{"parts":[]},"finishReason":"SAFETY"}]}`))
	}))
	defer srv.Close()
	h := &PosterReadHandler{geminiKey: "k", geminiModel: "m", geminiBase: srv.URL, http: srv.Client()}
	if _, err := h.readWithGemini(context.Background(), "image/png", "QQ==", "x"); err != errPosterUnreadable || !strings.Contains(err.Error(), "ไม่ได้") {
		t.Errorf("SAFETY: got %v", err)
	}
}

func TestReadWithGeminiRetries(t *testing.T) {
	geminiRetryWait = time.Millisecond
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if calls < 3 {
			w.WriteHeader(http.StatusServiceUnavailable)
			return
		}
		w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"{}"}]},"finishReason":"STOP"}]}`))
	}))
	defer srv.Close()
	h := &PosterReadHandler{geminiKey: "k", geminiModel: "m", geminiBase: srv.URL, http: srv.Client()}
	if text, err := h.readWithGemini(context.Background(), "image/png", "QQ==", "x"); err != nil || text != "{}" || calls != 3 {
		t.Fatalf("got %q, %v after %d calls", text, err, calls)
	}

	calls = -10 // always 503
	if _, err := h.readWithGemini(context.Background(), "image/png", "QQ==", "x"); err != errPosterOverloaded || calls != -7 {
		t.Fatalf("got %v after %d calls", err, calls+10)
	}
}
