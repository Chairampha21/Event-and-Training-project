package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/anthropics/anthropic-sdk-go/v2"
	"github.com/gin-gonic/gin"
)

// PosterReadHandler reads an event poster with an AI model and returns the
// details it shows (title, dates, times, place ...) so the create-event form
// can be filled in for the organizer to check. Google Gemini is used when
// GEMINI_API_KEY is set (it has a free tier), otherwise Claude when
// ANTHROPIC_API_KEY is set; with neither it answers 503 and the browser
// falls back to its own OCR.
type PosterReadHandler struct {
	claude      anthropic.Client
	claudeOn    bool
	geminiKey   string
	geminiModel string
	geminiBase  string // API root; replaced in tests
	http        *http.Client
}

func NewPosterReadHandler() *PosterReadHandler {
	model := strings.TrimSpace(os.Getenv("GEMINI_MODEL"))
	if model == "" {
		model = "gemini-3.5-flash-lite"
	}
	return &PosterReadHandler{
		claude:      anthropic.NewClient(),
		claudeOn:    strings.TrimSpace(os.Getenv("ANTHROPIC_API_KEY")) != "",
		geminiKey:   strings.TrimSpace(os.Getenv("GEMINI_API_KEY")),
		geminiModel: model,
		geminiBase:  "https://generativelanguage.googleapis.com",
		http:        &http.Client{Timeout: 90 * time.Second},
	}
}

// posterErr is a failure to report to the browser as it is.
type posterErr struct {
	status int
	msg    string
}

func (e *posterErr) Error() string { return e.msg }

var (
	errPosterTimeout    = &posterErr{http.StatusGatewayTimeout, "อ่านโปสเตอร์นานเกินไป · ลองใหม่อีกครั้ง"}
	errPosterOverloaded = &posterErr{http.StatusBadGateway, "ระบบ AI มีผู้ใช้มากในขณะนี้ · กด \"ลองอีกครั้ง\" ในอีกสักครู่"}
	errPosterBusy       = &posterErr{http.StatusTooManyRequests, "มีคำขออ่านโปสเตอร์มากเกินไป (เกินโควตา) · ลองใหม่ในอีกสักครู่"}
	errPosterFailed     = &posterErr{http.StatusBadGateway, "อ่านโปสเตอร์ไม่สำเร็จ"}
	errPosterUnreadable = &posterErr{http.StatusUnprocessableEntity, "อ่านข้อมูลจากโปสเตอร์นี้ไม่ได้"}
)

type posterReadBody struct {
	Image      string   `json:"image"`      // data:image/jpeg;base64,...
	Categories []string `json:"categories"` // the form's category choices
}

// What the model fills in; every field is null when the poster doesn't say.
type posterFields struct {
	Title       *string `json:"title"`
	Description *string `json:"description"`
	Category    *string `json:"category"`
	Days        []struct {
		Date  string  `json:"date"`
		Start *string `json:"start"`
		End   *string `json:"end"`
	} `json:"days"`
	AttendMode *string  `json:"attend_mode"`
	Place      *string  `json:"place"`
	OnlineLink *string  `json:"online_link"`
	Fee        *float64 `json:"fee"`
	RegEnd     *string  `json:"reg_end"`
}

var dataURLRe = regexp.MustCompile(`^data:(image/(?:jpeg|png|webp|gif));base64,([A-Za-z0-9+/=]+)$`)

const maxPosterReadBytes = 7 << 20 // base64 text of a ~5 MB image

func nullable(t string) map[string]any { return map[string]any{"type": []string{t, "null"}} }

var posterSchema = map[string]any{
	"type": "object",
	"properties": map[string]any{
		"title":       nullable("string"),
		"description": nullable("string"),
		"category":    nullable("string"),
		"days": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type": "object",
				"properties": map[string]any{
					"date":  map[string]any{"type": "string"},
					"start": nullable("string"),
					"end":   nullable("string"),
				},
				"required":             []string{"date", "start", "end"},
				"additionalProperties": false,
			},
		},
		"attend_mode": map[string]any{"type": []string{"string", "null"}, "enum": []any{"onsite", "online", "hybrid", nil}},
		"place":       nullable("string"),
		"online_link": nullable("string"),
		"fee":         nullable("number"),
		"reg_end":     nullable("string"),
	},
	"required":             []string{"title", "description", "category", "days", "attend_mode", "place", "online_link", "fee", "reg_end"},
	"additionalProperties": false,
}

const posterSystemPrompt = `You read Thai university event posters (trainings, seminars, workshops) and pull out the details an organizer would otherwise type into the event form.

Only report what the poster actually shows; use null (or an empty days list) for anything it doesn't. Don't guess.

- title: the event's name as written, without decorative taglines.
- description: 1-3 plain Thai sentences on what the event is, who it is for and what attendees get, written from the poster's wording. Null if the poster says too little.
- category: one of the given category names that fits, or null.
- days: each event day as {"date": "YYYY-MM-DD", "start": "HH:MM", "end": "HH:MM"} in the Gregorian calendar, 24-hour times. Thai posters use Buddhist years (2569 = 2026; subtract 543). A two-digit year like "69" means 2569. If the year is missing, use the next such date on or after today.
- attend_mode: "onsite", "online" or "hybrid" (both).
- place: the room and building as written; null for online-only events.
- online_link: a meeting URL if printed (not a QR code you can't read).
- fee: the registration fee in baht; 0 if it says free; null if not mentioned.
- reg_end: the last day to register as YYYY-MM-DD, if stated.`

// Read handles POST /api/events/read-poster.
func (h *PosterReadHandler) Read(c *gin.Context) {
	if h.geminiKey == "" && !h.claudeOn {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ยังไม่ได้เปิดใช้การอ่านโปสเตอร์ด้วย AI (ไม่มี GEMINI_API_KEY หรือ ANTHROPIC_API_KEY)"})
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxPosterReadBytes+4096)
	var b posterReadBody
	if err := c.ShouldBindJSON(&b); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปโปสเตอร์ใหญ่เกินไปหรือไม่ถูกต้อง"})
		return
	}
	m := dataURLRe.FindStringSubmatch(b.Image)
	if m == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปโปสเตอร์ต้องเป็น JPG, PNG หรือ WebP"})
		return
	}
	cats := make([]string, 0, len(b.Categories))
	for _, s := range b.Categories {
		if s = strings.TrimSpace(s); s != "" && len(cats) < 50 && len([]rune(s)) <= 80 {
			cats = append(cats, s)
		}
	}
	catsJSON, _ := json.Marshal(cats)
	today := time.Now().In(time.FixedZone("ICT", 7*3600)).Format("2006-01-02")

	prompt := "Today is " + today + ". Category names: " + string(catsJSON) + "\nRead this poster."

	ctx, cancel := context.WithTimeout(c.Request.Context(), 90*time.Second)
	defer cancel()
	var text string
	var err error
	if h.geminiKey != "" {
		text, err = h.readWithGemini(ctx, m[1], m[2], prompt)
	} else {
		text, err = h.readWithClaude(ctx, m[1], m[2], prompt)
	}
	if err != nil {
		var pe *posterErr
		if !errors.As(err, &pe) {
			pe = errPosterFailed
		}
		c.JSON(pe.status, gin.H{"error": pe.msg})
		return
	}
	var fields posterFields
	if err := json.Unmarshal([]byte(stripCodeFence(text)), &fields); err != nil {
		c.JSON(errPosterUnreadable.status, gin.H{"error": errPosterUnreadable.msg})
		return
	}
	c.JSON(http.StatusOK, gin.H{"fields": fields})
}

// stripCodeFence removes a ```json ... ``` wrapper, should a model add one.
func stripCodeFence(s string) string {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "```") {
		s = strings.TrimPrefix(s, "```json")
		s = strings.TrimPrefix(s, "```")
		s = strings.TrimSuffix(strings.TrimSpace(s), "```")
	}
	return strings.TrimSpace(s)
}

func (h *PosterReadHandler) readWithClaude(ctx context.Context, mediaType, data, prompt string) (string, error) {
	resp, err := h.claude.Beta.Messages.New(ctx, anthropic.BetaMessageNewParams{
		Model:     "claude-opus-5-5",
		MaxTokens: 4000,
		// A policy decline is re-run on a fallback model inside the same call.
		Betas:     []anthropic.AnthropicBeta{anthropic.AnthropicBetaServerSideFallback2026_07_01},
		Fallbacks: anthropic.BetaFallbacksParamOfDefault(),
		System:    []anthropic.BetaTextBlockParam{{Text: posterSystemPrompt}},
		OutputConfig: anthropic.BetaOutputConfigParam{
			Effort: anthropic.BetaOutputConfigEffortLow,
			Format: anthropic.BetaJSONOutputFormatParam{Schema: posterSchema},
		},
		Messages: []anthropic.BetaMessageParam{anthropic.NewBetaUserMessage(
			anthropic.NewBetaImageBlock(anthropic.BetaBase64ImageSourceParam{Data: data, MediaType: anthropic.BetaBase64ImageSourceMediaType(mediaType)}),
			anthropic.NewBetaTextBlock(prompt),
		)},
	})
	if err != nil {
		var apiErr *anthropic.Error
		switch {
		case errors.Is(err, context.DeadlineExceeded):
			return "", errPosterTimeout
		case errors.As(err, &apiErr) && apiErr.StatusCode == http.StatusTooManyRequests:
			return "", errPosterBusy
		}
		return "", errPosterFailed
	}
	if resp.StopReason != anthropic.BetaStopReasonEndTurn {
		return "", errPosterUnreadable
	}
	var text string
	for _, block := range resp.Content {
		if t, ok := block.AsAny().(anthropic.BetaTextBlock); ok {
			text += t.Text
		}
	}
	return text, nil
}

// The JSON shape, spelled out for Gemini (asked for JSON output, no schema).
const posterJSONShape = `Answer with one JSON object and nothing else, exactly these keys:
{"title": string|null, "description": string|null, "category": string|null,
 "days": [{"date": "YYYY-MM-DD", "start": "HH:MM"|null, "end": "HH:MM"|null}],
 "attend_mode": "onsite"|"online"|"hybrid"|null, "place": string|null,
 "online_link": string|null, "fee": number|null, "reg_end": "YYYY-MM-DD"|null}`

type geminiPart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *geminiInlineData `json:"inlineData,omitempty"`
}
type geminiInlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}
type geminiContent struct {
	Role  string       `json:"role,omitempty"`
	Parts []geminiPart `json:"parts"`
}

const geminiAttempts = 3

var geminiRetryWait = time.Second // 1 s, then 2 s; shortened in tests

// geminiOnce sends one request and returns the HTTP status and body.
func (h *PosterReadHandler) geminiOnce(ctx context.Context, url string, body []byte) (int, []byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return 0, nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-goog-api-key", h.geminiKey)
	res, err := h.http.Do(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	return res.StatusCode, raw, err
}

// readWithGemini calls the generateContent REST endpoint
// (https://ai.google.dev/api/generate-content).
func (h *PosterReadHandler) readWithGemini(ctx context.Context, mediaType, data, prompt string) (string, error) {
	body, _ := json.Marshal(map[string]any{
		"systemInstruction": geminiContent{Parts: []geminiPart{{Text: posterSystemPrompt + "\n\n" + posterJSONShape}}},
		"contents": []geminiContent{{Role: "user", Parts: []geminiPart{
			{InlineData: &geminiInlineData{MimeType: mediaType, Data: data}},
			{Text: prompt},
		}}},
		"generationConfig": map[string]any{"responseMimeType": "application/json"},
	})
	url := h.geminiBase + "/v1beta/models/" + h.geminiModel + ":generateContent"
	// The free tier often answers 503 ("model overloaded") at busy times:
	// try again a couple of times before giving up.
	var raw []byte
	for attempt := 1; ; attempt++ {
		status, body2, err := h.geminiOnce(ctx, url, body)
		switch {
		case err != nil && (errors.Is(err, context.DeadlineExceeded) || os.IsTimeout(err)):
			return "", errPosterTimeout
		case err == nil && status == http.StatusOK:
			raw = body2
		case err == nil && status == http.StatusTooManyRequests:
			return "", errPosterBusy
		case err == nil && status < 500:
			log.Printf("gemini read-poster: HTTP %d: %.500s", status, body2)
			return "", errPosterFailed
		default: // 5xx or a network error: worth another try
			log.Printf("gemini read-poster: attempt %d: HTTP %d, err %v: %.300s", attempt, status, err, body2)
			if attempt == geminiAttempts {
				if err == nil && status == http.StatusServiceUnavailable {
					return "", errPosterOverloaded
				}
				return "", errPosterFailed
			}
			select {
			case <-ctx.Done():
				return "", errPosterTimeout
			case <-time.After(time.Duration(attempt) * geminiRetryWait):
			}
			continue
		}
		break
	}
	var out struct {
		Candidates []struct {
			Content      geminiContent `json:"content"`
			FinishReason string        `json:"finishReason"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || len(out.Candidates) == 0 || out.Candidates[0].FinishReason != "STOP" {
		return "", errPosterUnreadable
	}
	var text string
	for _, p := range out.Candidates[0].Content.Parts {
		text += p.Text
	}
	return text, nil
}
