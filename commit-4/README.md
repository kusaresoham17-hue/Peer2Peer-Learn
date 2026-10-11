# Peer2Peer Learn

> **Learn from Peers. Teach What You Know.**

A minimalist peer-to-peer teaching platform: students learn from peer tutors, tutors create courses and schedule live classes, and an administrator manages the platform.
It is a **static website** (HTML + CSS + JavaScript). There is **no database, no npm install and no build step** – all data is stored in your browser's `localStorage` and is pre-filled with demo data.

## Run it (pick any one)

1. **Double-click `index.html`** – works straight from the folder.
2. **VS Code Live Server** – open the folder in VS Code, install the *Live Server* extension, right-click `index.html` → *Open with Live Server*.
3. **Node (optional)** – in the VS Code terminal run `node server.js` and open <http://localhost:3000>. (`npm start` does the same. No packages are installed.)

## Demo accounts

| Role    | Email             | Password    |
|---------|-------------------|-------------|
| Student | student@demo.com  | Demo@1234   |
| Tutor   | tutor@demo.com    | Demo@1234   |
| Admin   | admin@demo.com    | Demo@1234   |

The login page has one-click buttons that fill these in. Use **Reset demo data** (login page or Admin → Monitoring) to restore the original data.

## Features

- **Public:** landing page, course catalogue with search, filters and sorting, course details, registration, login, forgot-password (demo).
- **Student:** dashboard, enrol in free courses, **mock payment** with receipt for paid courses, lessons with progress tracking, scheduled classes, **Join Class**, assignments, messages, notifications, feedback and ratings, payment history, profile.
- **Tutor:** dashboard, create/edit/publish courses with lessons, **schedule classes with a Zoom link**, create and evaluate assignments, students list, reviews, simulated earnings.
- **Admin:** dashboard, manage users (activate / deactivate / delete), moderate courses, categories, reports with CSV export, system monitoring.

### Zoom classes
Tutors paste a Zoom meeting link (must be `https://…zoom.us/…`) when scheduling. Students click **Join Class** and the link opens in a **new browser tab**. The meeting happens inside Zoom – the website has no built-in video.

### Payments are simulated
No real money is used. Any 16-digit card number works; a card ending in **0000** simulates a failed payment.

## Project structure

```
index.html            page shell (loads the scripts below)
css/style.css         all styles (minimal design, responsive)
js/core.js            data layer + business logic + demo data (also loads in Node for tests)
js/ui.js              helpers, layout and hash router
js/pages-public.js    home, courses, course details, login, register
js/pages-common.js    messages, notifications, profile
js/pages-student.js   student pages, checkout, receipt
js/pages-tutor.js     tutor pages
js/pages-admin.js     admin pages
js/main.js            starts the app
server.js             optional static server (no dependencies)
test/test.js          unit tests for the main functions
```

## Tests

```
node test/test.js
```

Covers `registerUser, loginUser, updateProfile, createCourse, enrollCourse, scheduleClass, validateZoomLink, joinClass, submitAssignment, evaluateAssignment, sendMessage, submitFeedback, processMockPayment, generateReceipt, manageUser` (49 checks).

## Troubleshooting

- *Blank page?* Make sure you opened `index.html` from the extracted folder (not from inside the zip) and that JavaScript is enabled.
- *Data looks odd after an update?* Click **Reset demo data**.
- *Port 3000 busy?* `server.js` automatically tries the next port, or set `PORT=4000`.
- Data is per browser; private/incognito windows start fresh each time.

## Security note
This is an academic demo. Passwords are salted and hashed in the browser, but because everything runs client-side it is **not** suitable for real user data.
