# ApexGym — Gym Management System

A complete, browser-based gym management system built with **pure JavaScript** — no build tools, no server, no frameworks. Data is persisted in your browser's `localStorage`.

Built from the feature specification in `Gym_Management_System_Features.pdf`.

## Run it

1. Open `index.html` in a modern browser, **or** serve the folder:

   ```
   npx serve .
   # then open http://localhost:3000
   ```

2. Sign in with any demo account (below) and seed data loads automatically.

> Tip: always keep the app open in one tab while working — that's where the data lives.

## Demo accounts

| Role          | Username    | Password     |
| ------------- | ----------- | ------------ |
| Administrator | `admin`     | `admin123`   |
| Manager       | `manager`   | `manager123` |
| Receptionist  | `reception` | `reception123` |
| Trainer       | `trainer`   | `trainer123` |
| Accountant    | `accountant`| `acc123`     |
| Member        | `member`    | `member123`  |

Click any account on the login screen to auto-fill the credentials.

## Modules

- **Dashboard** — KPIs, 6-month revenue + 14-day attendance charts, renewal & alerts feed
- **Members** — CRUD, filters, full profile (membership / payments / attendance / progress tabs)
- **Membership Plans** — pricing & duration, expiring / expired renewal queues
- **Payments & Invoices** — record payments, printable receipts, pending tracking
- **Attendance** — check-in/out by member code, scannable QR member card, in-gym board, CSV export
- **Trainers** — staff roster with specializations and schedules
- **Workout Plans** — multi-day exercise programs per member
- **Diet & Nutrition** — meal plans with calories/macros
- **Member Progress** — weight/BMI/body-fat tracking with charts
- **Equipment** — inventory, condition, maintenance, warranties
- **Expenses** — categorized expense tracking
- **Gym Store / POS** — products, low-stock alerting, point-of-sale sales
- **Classes & Booking** — schedule, capacity, member booking
- **Reports & Analytics** — revenue by month/plan, expenses, attendance, tax, CSV/JSON export + backup
- **Activity Log** — audit trail of every action
- **Settings** — gym profile, branding, tax, data backup/restore/reset, admin user management
- **My Profile** — personal account, linked member card w/ QR, password change (role-aware)

## Roles & access

`admin`, `manager`, `reception`, `trainer`, `accountant`, `member` — each sees only the views its role allows (nav and routes are permission-filtered).

## Data & reset

- All data persists under the `apexgym_` localStorage prefix.
- **Settings → Reset to Demo Data** wipes everything and re-seeds.
- **Settings → Backup / Restore** exports a full JSON snapshot.

## Architecture

```
index.html              app shell (login + sidebar/topbar)
assets/css/app.css      full futuristic dark theme
assets/js/db.js         data layer + demo seed (localStorage, domain helpers)
assets/js/utils.js      icons, toasts, modals, QR, CSV/JSON, printing
assets/js/charts.js     zero-dependency canvas chart engine (line/bar/donut)
assets/js/auth.js       login/session + role-based access map
assets/js/views.js      view registry + dashboard, members, plans, payments
assets/js/views2.js     attendance, trainers, workouts, diet, progress,
                        equipment, expenses, store, classes, reports,
                        activity, settings, profile
assets/js/app.js        bootstrap: router, sidebar nav, clock, bell, search
assets/lib/qrcodegen.js vendored QR generator (MIT, qrcode-generator 1.4.4)
test/                   jsdom smoke tests (npm test) — 435 checks
```

## Verification

```
cd test
npm install
npm test
```

Runs the app in a headless DOM, logs in as every role, navigates every allowed view,
exercises the key buttons (add member / plan / payment, check-in, POS, settings save)
and reports any exception or broken interaction.