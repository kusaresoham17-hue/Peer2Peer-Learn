# Peer2Peer Learn

**Learn from Peers. Teach What You Know.**
A Peer-to-Peer Teaching Platform (Software Engineering college project).

## Run it in VS Code (3 steps)

1. Install **Node.js 22.5 or newer** (the LTS version from https://nodejs.org). Check with `node -v`.
2. Open this folder in VS Code, then open the terminal (`Ctrl + ~`).
3. Run:

```bash
npm start
```

Open **http://localhost:3000** in your browser. The database file (`p2p.db`) and all demo data are created automatically on the first start.
Nothing to install (`npm install` is not needed): the project has no external dependencies.

| Command | What it does |
|---|---|
| `npm start` | Start the website at http://localhost:3000 |
| `npm test` | Run the automated API tests (UAT scenarios, roles, payment, Zoom validation) |
| `npm run reset` | Delete the database so demo data is recreated on the next start |

Other port: `PORT=4000 npm start` (Mac/Linux) or `$env:PORT=4000; npm start` (Windows PowerShell).

## DEMO accounts (password: `Demo@1234`)

| Role | Email |
|---|---|
| Student | student@demo.com |
| Peer Tutor | tutor@demo.com (Rahul Sharma, teaches Python) |
| Admin | admin@demo.com |

Demo data: 12 students, 5 tutors, 10 courses, enrollments, live/past/cancelled classes with Zoom links, assignments, submissions, messages, notifications, reviews and payments.
Mock payment: any method works; a card number ending in **0000** simulates a failed payment.

## Main demo workflow

- **Student:** Register, Login, Explore Courses, open a course, Enroll (free) or pay (mock), Learn (mark lessons complete), Learning Sessions, **Join Class** (opens Zoom in a new tab), submit assignment, view marks and feedback, rate the course.
- **Tutor:** Login, Create Course with lessons, Publish, Manage Classes (schedule with Zoom link), Students, Assignments (create, evaluate), Reviews.
- **Admin:** Login, Manage Users, Manage Courses, Manage Classes, Reports (CSV download), System Monitoring.

## Technology

| Layer | Used here |
|---|---|
| Frontend | Plain HTML, CSS and JavaScript single-page app (`public/`), no build step |
| Backend | Node.js built-in `http` server, REST APIs (`server.js`) |
| Business logic | `services.js` (testable functions: registerUser, loginUser, scheduleClass, validateZoomLink, joinClass, submitAssignment, evaluateAssignment, processMockPayment, ...) |
| Database | SQLite via Node's built-in `node:sqlite` (`db.js`: schema and demo data) |
| Security | scrypt password hashing, JWT (HS256), role-based middleware, input validation, parameterised SQL, Zoom URL validation, upload checks |

Zoom: the platform only stores the meeting link. **Join Class** opens the stored `https://...zoom.us/...` link in a new tab (`noopener`). There is no in-app video.

## Project structure

```
server.js     routes, auth, static files, monitoring counters
services.js   business logic and validation (white-box test targets)
db.js         tables, relationships, demo seed data
public/       index.html, style.css, app.js (all pages)
test/         run-tests.js (API tests)
```

## Mapping to the Software Engineering experiments

- **DFD:** 1.0 User Management, 2.0 Course Management, 3.0 Learning and Interaction, 4.0 Payment Management; data stores D1 to D4 = users, courses/classes, learning tables, payments.
- **Class diagram entities:** users (Student, Tutor, Admin by role), Course, Category, Lesson, Enrollment, ClassSession, Assignment, Submission, Message, Notification, Feedback, Payment; profile fields live in users; reports are generated from queries.
- **White box testing:** the functions listed above are in `services.js` with clear decisions and error paths.
- **UAT-01 to UAT-10:** covered by the demo flow and by `npm test`.
- **SCM:** `.gitignore` included. Suggested branches: main, develop, feature/authentication, feature/course-management, feature/learning, feature/classes, feature/payment, feature/admin.

## Notes and simplifications

- Tutor "Publish" makes a course live immediately; the admin can still reject or archive it (Manage Courses).
- Course Q&A uses messaging (questions go to the tutor, tagged with the course).
- Tutors can also enroll in other courses, so one person can both learn and teach.
- "Forgot password" shows an information message (no email service in the demo).
- Set the `JWT_SECRET` environment variable for anything beyond a demo.
