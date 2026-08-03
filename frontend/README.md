# CPSU ETMS — Frontend (React)

React port of the CPSU ETMS prototype (ระบบจัดการกิจกรรมและการอบรม คณะวิทยาศาสตร์ มหาวิทยาลัยศิลปากร).
Covers Admin / Organizer / Student flows: login, browse & register for events (poster upload,
single/multi-day, onsite/online/hybrid capacity, optional pretest), QR check-in, post-event
evaluation, certificate issuance/download, per-event report, yearly dashboard, user management,
blacklist, SAR reports, and aggregate evaluation results.

## Getting started

```bash
npm install
npm start      # http://localhost:3000
npm run build  # production build to build/
```

## Structure

```
public/               static assets (index.html, images/)
src/
  App.jsx              route table (role-aware layout + guards)
  components/          shared UI: Navbar, EventCard, SearchBar, CycleProgress,
                        ApplicantsModal, EvalResultChart, CertificateCard, Modal, Toast, NotFound
  pages/
    LoginPage.jsx
    student/           HomePage, MyRegistrationsPage, EvaluationFormPage, CertificatesPage
    organizer/         CreateEventPage, EventsTablePage, EmailSettingsPage, ReportPage
    admin/              DashboardPage, UsersPage, BlacklistPage, SarReportPage,
                        EvaluationsPage, PortfolioPage
  data/                seed/demo data (events, rosters, eval questions)
  hooks/               useEvents (app-wide store via Context) + useLocalStorage
  utils/               csvExport, certificateGen (print-to-PDF), dateFormat, constants
  styles/               variables.css (design tokens) + global.css
```

## State & data

There's no backend wired up yet (see `../backend`, `../database`). All app state (session,
events, registrations, rosters, users, notifications, activity log) lives in a single React
Context provider (`src/hooks/useEvents.js`) and is persisted to `localStorage`, mirroring the
original vanilla-JS prototype's in-memory store. Swap the action implementations in that file
for real API calls once the backend exists — the components only depend on the hook's public
interface, not on how the data is stored.

Login only validates the `@silpakorn.edu` email pattern and lets you pick a role — there's a
role switcher in the navbar for quickly previewing all three roles without logging out.

Event posters are stored as base64 data URLs on the event object (`localStorage`-only) —
fine for a prototype, but swap for real file upload once there's a backend, since large
posters will bloat `localStorage`. Evaluation averages shown on the Dashboard / SAR /
Evaluations pages are deterministic mock numbers (no per-submission answers are persisted
yet) — replace `mockAvg`/the inline generators once real evaluation responses are stored.

## Known content caveat

The Thai copy (event names, labels, seed data) was rewritten by hand while porting this app,
because the source files handed off for this migration had corrupted/garbled Thai text
(an encoding issue from an earlier step, not from this app). Wording is reasonable but not
guaranteed to match your original source 1:1 — spot-check anything user-facing before shipping.

## Certificates

`utils/certificateGen.js` renders a certificate as a print-ready HTML page in a new tab/window
(`window.print()` → "Save as PDF"). Replace with a real PDF pipeline (e.g. `pdf-lib`, or
server-side rendering once the backend exists) when ready.
