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
public/                    static files served as-is (index.html, images/)
src/
  index.js                 entry point
  App.jsx                  route table: which URL shows which page, and for which roles
  App.css

  pages/                   one file per screen, grouped by who uses it
    LoginPage.jsx
    student/               HomePage, MyRegistrationsPage, EvaluationFormPage, CertificatesPage
    organizer/             CreateEventPage, EventsTablePage, ReportPage
    admin/                 DashboardPage, UsersPage, BlacklistPage, SarReportPage,
                           EvaluationsPage, ActivityLogPage

  layouts/                 page frames
    AppLayout.jsx          navbar + page + toasts, wraps every signed-in page

  components/              pieces reused across the whole app (know nothing about events)
    ui/                    building blocks: Modal, Toast, ImageViewer, MultiDatePicker
    common/                app chrome: Navbar, NotFound, ProtectedRoute

  features/                pieces that belong to one area of the app
    auth/components/         ProfileModal
    events/components/       EventCard, SearchBar, CycleProgress, PosterUpload, ApplicantsModal,
                             EventDetailModal, ManageEventModal
    budget/components/       BudgetSection, BudgetActualModal
    certificates/            components/ CertificateCard, CertOverlays
                             utils/ certificateGen (print-to-PDF)
    evaluations/components/  EvalResultChart

  context/                 app-wide state
    AppContext.js          session, events, registrations, notifications + every action
  hooks/                   useEvents (reads AppContext), useLocalStorage
  services/                api.js — the one place that talks to the backend
  utils/                   pure helpers: dateFormat, money, csvExport, constants,
                           downloadImage, fileToDataUrl, initials
  styles/                  variables.css (design tokens) + global.css
```

### Where does a new file go?

| You are adding…                                         | Put it in                         |
|---------------------------------------------------------|-----------------------------------|
| A new screen with its own URL                           | `pages/<role>/` + a route in `App.jsx` |
| A component used by one area only (events, budget, …)   | `features/<area>/components/`     |
| A generic component any page could use (button, modal)  | `components/ui/`                  |
| Something shown on every page (navbar, footer)          | `components/common/`              |
| A function with no React in it (formatting, parsing)    | `utils/`                          |
| A new backend call or piece of shared state             | `context/AppContext.js` (uses `services/api.js`) |

Rule of thumb: `components/ui/` never imports from `features/` or `pages/` (it stays generic);
`features/` may import from `components/`, `hooks/`, `utils/` but not from `pages/`;
`pages/` may import from anywhere. `components/common/` is app chrome, so it may pull in a
feature piece (the navbar opens the profile modal from `features/auth`).
A stylesheet lives next to the component it styles.

## State & data

There's no backend wired up yet (see `../backend`, `../database`). All app state (session,
events, registrations, rosters, users, notifications, activity log) lives in a single React
Context provider (`src/context/AppContext.js`, read through the `useEvents` hook) and is persisted to `localStorage`, mirroring the
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

`features/certificates/utils/certificateGen.js` renders a certificate as a print-ready HTML page in a new tab/window
(`window.print()` → "Save as PDF"). Replace with a real PDF pipeline (e.g. `pdf-lib`, or
server-side rendering once the backend exists) when ready.
