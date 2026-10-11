// Peer2Peer Learn - HTTP server (no external dependencies; requires Node 22.5+).
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj < 22 || (maj === 22 && min < 5)) { console.error(`Node 22.5 or newer is required (you have ${process.version}). Download the LTS version from https://nodejs.org`); process.exit(1); }

const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const { q, q1, run, exec, notify, seed } = require('./db');
const S = require('./services');
seed();

const PORT = process.env.PORT || 3000;
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me-for-production';
const b64 = (x) => Buffer.from(x).toString('base64url');
const sign = (payload, days) => { const h = b64('{"alg":"HS256","typ":"JWT"}'), p = b64(JSON.stringify({ ...payload, exp: Date.now() + days * 864e5 })); return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url')}`; };
function verify(t) {
  const [h, p, s] = String(t).split('.');
  if (!s) return null;
  const good = crypto.createHmac('sha256', SECRET).update(h + '.' + p).digest('base64url');
  if (s.length !== good.length || !crypto.timingSafeEqual(Buffer.from(s), Buffer.from(good))) return null;
  const d = JSON.parse(Buffer.from(p, 'base64url').toString());
  return d.exp > Date.now() ? d : null;
}

// ---- application-level monitoring (for the admin System Monitoring page)
const mon = { started: Date.now(), requests: 0, errors: 0, seen: new Map(), activity: [] };
const log = (text) => { mon.activity.unshift({ at: new Date().toISOString(), text }); mon.activity.length = Math.min(mon.activity.length, 30); };

const routes = [];
const route = (method, pattern, roles, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), roles, fn });
const pct = (c) => (c.total ? Math.round((c.done / c.total) * 100) : 0);
const COURSE_SQL = `SELECT c.id,c.title,c.description,c.category,c.difficulty,c.duration,c.price,c.status,c.thumb,c.tutor_id,c.objectives,c.created_at, u.name tutor_name,
  (SELECT ROUND(AVG(rating),1) FROM feedback f WHERE f.course_id=c.id) rating, (SELECT COUNT(*) FROM feedback f WHERE f.course_id=c.id) reviews,
  (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) students FROM courses c JOIN users u ON u.id=c.tutor_id`;
const withProgress = (uid) => q(`SELECT c.id,c.title,c.category,c.difficulty,c.price,c.duration,c.thumb,u.name tutor_name,
  (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) total,
  (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.course_id=c.id AND p.user_id=?) done
  FROM enrollments e JOIN courses c ON c.id=e.course_id JOIN users u ON u.id=c.tutor_id WHERE e.user_id=? ORDER BY e.id DESC`, uid, uid).map((c) => ({ ...c, progress: pct(c) }));
const classRows = (where, ...p) => q(`SELECT s.*, c.title course_title, u.name tutor_name, (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=s.course_id) participants
  FROM class_sessions s JOIN courses c ON c.id=s.course_id JOIN users u ON u.id=s.tutor_id ${where} ORDER BY s.date, s.start_time`, ...p).map((s) => ({ ...s, status: S.classStatus(s) }));
const safe = (rows, user) => rows.map((s) => (s.tutor_id === user.id || user.role === 'admin' ? s : { ...s, zoom_link: undefined }));

// ---------------------------------------------------------------- public
route('GET', '/api/stats', null, () => ({
  learners: q1("SELECT COUNT(*) n FROM users WHERE role='student'").n, tutors: q1("SELECT COUNT(*) n FROM users WHERE role='tutor'").n,
  courses: q1("SELECT COUNT(*) n FROM courses WHERE status='published'").n, sessions: q1('SELECT COUNT(*) n FROM class_sessions').n }));
route('GET', '/api/categories', null, () => q('SELECT * FROM categories ORDER BY name'));
route('GET', '/api/courses', null, ({ query }) => {
  const w = ["c.status='published'"], p = [];
  if (query.q) { w.push('(c.title LIKE ? OR c.description LIKE ? OR u.name LIKE ?)'); p.push(...Array(3).fill(`%${query.q}%`)); }
  if (query.category) { w.push('c.category=?'); p.push(query.category); }
  if (query.difficulty) { w.push('c.difficulty=?'); p.push(query.difficulty); }
  if (query.price === 'free') w.push('c.price=0'); else if (query.price === 'paid') w.push('c.price>0');
  const order = { popular: 'students DESC', rating: 'rating DESC', latest: 'c.id DESC' }[query.sort] || 'students DESC';
  let rows = q(`${COURSE_SQL} WHERE ${w.join(' AND ')} ORDER BY ${order}`, ...p);
  if (query.rating) rows = rows.filter((c) => (c.rating || 0) >= Number(query.rating));
  return rows;
});
route('GET', '/api/courses/:id', 'optional', ({ params, user }) => {
  const c = q1(`${COURSE_SQL} WHERE c.id=?`, params.id);
  if (!c || (c.status !== 'published' && !(user && (user.id === c.tutor_id || user.role === 'admin')))) S.fail(404, 'Course could not be loaded.');
  const tutor = q1('SELECT id,name,skills,bio,avatar FROM users WHERE id=?', c.tutor_id);
  const enrolled = user ? !!q1('SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?', user.id, c.id) : false;
  const canSee = enrolled || (user && (user.id === c.tutor_id || user.role === 'admin'));
  const lessons = q('SELECT id,module,title,position' + (canSee ? ',content,resource_url' : '') + ' FROM lessons WHERE course_id=? ORDER BY position', c.id);
  if (user && enrolled) { const done = new Set(q('SELECT lesson_id FROM progress WHERE user_id=?', user.id).map((x) => x.lesson_id)); lessons.forEach((l) => (l.done = done.has(l.id))); }
  const reviews = q('SELECT f.rating,f.review,f.created_at,u.name FROM feedback f JOIN users u ON u.id=f.user_id WHERE f.course_id=? ORDER BY f.id DESC LIMIT 10', c.id);
  const mine = user ? q1('SELECT rating,review FROM feedback WHERE course_id=? AND user_id=?', c.id, user.id) : null;
  return { ...c, tutor, enrolled, lessons, review_list: reviews, mine };
});

// ---------------------------------------------------------------- auth + profile
route('POST', '/api/register', null, ({ body }) => { const u = S.registerUser(body); log(`New registration: ${u.name} (${u.role})`); return { user: u, token: sign({ id: u.id }, 1) }; });
route('POST', '/api/login', null, ({ body }) => { const u = S.loginUser(body); log(`Login: ${u.name}`); return { user: u, token: sign({ id: u.id }, body.remember ? 30 : 1) }; });
route('GET', '/api/me', 'any', ({ user }) => S.publicUser(user.id));
route('PUT', '/api/profile', 'any', ({ user, body }) => S.updateProfile(user.id, body));
route('GET', '/api/profile/stats', 'any', ({ user }) => ({
  rating: q1('SELECT ROUND(AVG(f.rating),1) r FROM feedback f JOIN courses c ON c.id=f.course_id WHERE c.tutor_id=?', user.id).r,
  teaching: q('SELECT title FROM courses WHERE tutor_id=?', user.id).map((c) => c.title), learning: withProgress(user.id).map((c) => c.title) }));

// ---------------------------------------------------------------- learning
route('POST', '/api/courses/:id/enroll', 'any', ({ user, params }) => { const r = S.enrollCourse(user.id, Number(params.id)); log(`${user.name} enrolled in course #${params.id}`); return r; });
route('POST', '/api/payments', 'any', ({ user, body }) => { const r = S.processMockPayment(user.id, body); log(`Payment ${r.txn_id}: ${user.name} paid ${r.amount}`); return r; });
route('GET', '/api/payments', 'any', ({ user }) => q(`SELECT p.*, c.title course FROM payments p JOIN courses c ON c.id=p.course_id WHERE p.user_id=? ORDER BY p.id DESC`, user.id));
route('GET', '/api/payments/:id', 'any', ({ user, params }) => S.generateReceipt(Number(params.id), user.id));
route('GET', '/api/my/courses', 'any', ({ user }) => withProgress(user.id));
route('POST', '/api/lessons/:id/complete', 'any', ({ user, params, body }) => {
  const l = q1('SELECT l.id FROM lessons l JOIN enrollments e ON e.course_id=l.course_id WHERE l.id=? AND e.user_id=?', params.id, user.id);
  if (!l) S.fail(403, 'Unauthorized access.');
  if (body.done === false) exec('DELETE FROM progress WHERE user_id=? AND lesson_id=?', user.id, l.id); else run('INSERT OR IGNORE INTO progress(user_id,lesson_id) VALUES(?,?)', user.id, l.id);
  return { ok: true };
});
route('POST', '/api/courses/:id/feedback', 'any', ({ user, params, body }) => S.submitFeedback(user.id, Number(params.id), body));
route('GET', '/api/my/feedback', 'any', ({ user }) => q('SELECT f.*, c.title course FROM feedback f JOIN courses c ON c.id=f.course_id WHERE f.user_id=? ORDER BY f.id DESC', user.id));
route('GET', '/api/student/dashboard', 'any', ({ user }) => {
  const mine = withProgress(user.id), now = new Date().toISOString().slice(0, 10);
  const pending = q1(`SELECT COUNT(*) n FROM assignments a JOIN enrollments e ON e.course_id=a.course_id WHERE e.user_id=? AND NOT EXISTS (SELECT 1 FROM submissions s WHERE s.assignment_id=a.id AND s.student_id=?)`, user.id, user.id).n;
  return { enrolled: mine.length, completed: mine.filter((c) => c.progress === 100).length, hours: Math.round(mine.reduce((a, c) => a + (c.duration * c.progress) / 100, 0)), pending, courses: mine,
    classes: safe(classRows(`WHERE s.status!='cancelled' AND s.date>=? AND (s.course_id IN (SELECT course_id FROM enrollments WHERE user_id=?) OR s.tutor_id=?)`, now, user.id, user.id).filter((c) => c.status !== 'completed').slice(0, 4), user),
    messages: q('SELECT m.body,m.created_at,u.name,m.from_id FROM messages m JOIN users u ON u.id=m.from_id WHERE m.to_id=? ORDER BY m.id DESC LIMIT 4', user.id),
    notifications: q('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 4', user.id),
    recommended: q(`${COURSE_SQL} WHERE c.status='published' AND c.tutor_id!=? AND c.id NOT IN (SELECT course_id FROM enrollments WHERE user_id=?) ORDER BY students DESC LIMIT 4`, user.id, user.id) };
});

// ---------------------------------------------------------------- classes
route('GET', '/api/classes', 'any', ({ user }) => safe(user.role === 'admin' ? classRows('') :
  classRows('WHERE s.course_id IN (SELECT course_id FROM enrollments WHERE user_id=?) OR s.tutor_id=?', user.id, user.id), user));
route('POST', '/api/classes', ['tutor', 'admin'], ({ user, body }) => { const id = S.scheduleClass(user, body); log(`Class scheduled by ${user.name}`); return { id }; });
route('PUT', '/api/classes/:id', ['tutor', 'admin'], ({ user, params, body }) => S.updateClass(user, Number(params.id), body));
route('GET', '/api/classes/:id/join', 'any', ({ user, params }) => { const r = S.joinClass(user.id, Number(params.id)); log(`${user.name} joined class #${params.id} (Zoom)`); return r; });
route('GET', '/api/classes/:id/participants', ['tutor', 'admin'], ({ user, params }) => {
  const s = q1('SELECT * FROM class_sessions WHERE session_id=?', params.id);
  if (!s || (s.tutor_id !== user.id && user.role !== 'admin')) S.fail(403, 'Unauthorized access.');
  return q('SELECT u.id,u.name,u.email FROM enrollments e JOIN users u ON u.id=e.user_id WHERE e.course_id=?', s.course_id);
});
route('POST', '/api/classes/:id/remind', ['tutor', 'admin'], ({ user, params }) => {
  const s = q1('SELECT * FROM class_sessions WHERE session_id=?', params.id);
  if (!s || (s.tutor_id !== user.id && user.role !== 'admin')) S.fail(403, 'Unauthorized access.');
  q('SELECT user_id FROM enrollments WHERE course_id=?', s.course_id).forEach((e) => notify(e.user_id, `Reminder: your class "${s.title}" starts on ${s.date} at ${s.start_time}. Click Join Class to attend through Zoom.`));
  return { ok: true };
});

// ---------------------------------------------------------------- assignments
route('GET', '/api/assignments', 'any', ({ user }) => q(`SELECT a.*, c.title course, s.id sub_id, s.status sub_status, s.marks, s.feedback, s.content, s.submitted_at
  FROM assignments a JOIN courses c ON c.id=a.course_id JOIN enrollments e ON e.course_id=a.course_id AND e.user_id=? LEFT JOIN submissions s ON s.assignment_id=a.id AND s.student_id=? ORDER BY a.due_date`, user.id, user.id));
route('POST', '/api/assignments/:id/submit', 'any', ({ user, params, body }) => S.submitAssignment(user.id, Number(params.id), body));
route('GET', '/api/tutor/assignments', ['tutor', 'admin'], ({ user }) => q('SELECT a.*, c.title course FROM assignments a JOIN courses c ON c.id=a.course_id WHERE c.tutor_id=? ORDER BY a.id DESC', user.id)
  .map((a) => ({ ...a, submissions: q('SELECT s.*, u.name student FROM submissions s JOIN users u ON u.id=s.student_id WHERE s.assignment_id=? ORDER BY s.id', a.id) })));
route('POST', '/api/assignments', ['tutor', 'admin'], ({ user, body }) => ({ id: S.createAssignment(user, body) }));
route('PUT', '/api/submissions/:id', ['tutor', 'admin'], ({ user, params, body }) => S.evaluateAssignment(user, Number(params.id), body));

// ---------------------------------------------------------------- messages + notifications
route('GET', '/api/conversations', 'any', ({ user }) => q(`SELECT u.id,u.name,u.role,u.avatar,
  (SELECT body FROM messages m WHERE (m.from_id=u.id AND m.to_id=?) OR (m.from_id=? AND m.to_id=u.id) ORDER BY m.id DESC LIMIT 1) last,
  (SELECT COUNT(*) FROM messages m WHERE m.from_id=u.id AND m.to_id=? AND m.is_read=0) unread,
  (SELECT MAX(m.id) FROM messages m WHERE (m.from_id=u.id AND m.to_id=?) OR (m.from_id=? AND m.to_id=u.id)) mid
  FROM users u WHERE u.id!=? ORDER BY mid DESC`, user.id, user.id, user.id, user.id, user.id, user.id).filter((c) => c.mid || S.canMessage(user.id, c.id)));
route('GET', '/api/messages/:uid', 'any', ({ user, params }) => {
  exec('UPDATE messages SET is_read=1 WHERE from_id=? AND to_id=?', params.uid, user.id);
  return q(`SELECT m.*, c.title course FROM messages m LEFT JOIN courses c ON c.id=m.course_id WHERE (m.from_id=? AND m.to_id=?) OR (m.from_id=? AND m.to_id=?) ORDER BY m.id`, user.id, params.uid, params.uid, user.id);
});
route('POST', '/api/messages', 'any', ({ user, body }) => ({ id: S.sendMessage(user.id, body) }));
route('GET', '/api/notifications', 'any', ({ user }) => q('SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 50', user.id));
route('POST', '/api/notifications/read', 'any', ({ user }) => { exec('UPDATE notifications SET is_read=1 WHERE user_id=?', user.id); return { ok: true }; });

// ---------------------------------------------------------------- tutor
route('GET', '/api/tutor/dashboard', ['tutor', 'admin'], ({ user }) => ({
  courses: q1('SELECT COUNT(*) n FROM courses WHERE tutor_id=?', user.id).n,
  students: q1('SELECT COUNT(DISTINCT e.user_id) n FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE c.tutor_id=?', user.id).n,
  activeClasses: classRows('WHERE s.tutor_id=?', user.id).filter((c) => c.status === 'scheduled' || c.status === 'live').length,
  rating: q1('SELECT ROUND(AVG(f.rating),1) r FROM feedback f JOIN courses c ON c.id=f.course_id WHERE c.tutor_id=?', user.id).r,
  classes: safe(classRows('WHERE s.tutor_id=?', user.id).filter((c) => c.status === 'scheduled' || c.status === 'live').slice(0, 4), user),
  pending: q1("SELECT COUNT(*) n FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN courses c ON c.id=a.course_id WHERE c.tutor_id=? AND s.status IN ('Submitted','Late','Under Review')", user.id).n }));
route('GET', '/api/tutor/courses', ['tutor', 'admin'], ({ user }) => q(`${COURSE_SQL} WHERE c.tutor_id=? ORDER BY c.id DESC`, user.id));
route('POST', '/api/courses', ['tutor', 'admin'], ({ user, body }) => { const id = S.createCourse(user, body); log(`Course created by ${user.name}`); return { id }; });
route('PUT', '/api/courses/:id', ['tutor', 'admin'], ({ user, params, body }) => ({ id: S.saveCourse(user, body, Number(params.id)) }));
route('DELETE', '/api/courses/:id', ['tutor', 'admin'], ({ user, params }) => {
  const c = q1('SELECT * FROM courses WHERE id=?', params.id);
  if (!c) S.fail(404, 'Course not found.');
  if (c.tutor_id !== user.id && user.role !== 'admin') S.fail(403, 'Unauthorized access.');
  exec('DELETE FROM courses WHERE id=?', c.id); return { ok: true };
});
route('GET', '/api/tutor/students', ['tutor', 'admin'], ({ user }) => q(`SELECT u.id,u.name,u.email,c.title course, e.created_at,
  (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id=p.lesson_id WHERE l.course_id=c.id AND p.user_id=u.id) done, (SELECT COUNT(*) FROM lessons l WHERE l.course_id=c.id) total
  FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id WHERE c.tutor_id=? ORDER BY e.id DESC`, user.id).map((s) => ({ ...s, progress: pct(s) })));
route('GET', '/api/tutor/reviews', ['tutor', 'admin'], ({ user }) => q('SELECT f.*, u.name student, c.title course FROM feedback f JOIN users u ON u.id=f.user_id JOIN courses c ON c.id=f.course_id WHERE c.tutor_id=? ORDER BY f.id DESC', user.id));
route('GET', '/api/tutor/payments', ['tutor', 'admin'], ({ user }) => q(`SELECT p.*, c.title course, u.name student FROM payments p JOIN courses c ON c.id=p.course_id JOIN users u ON u.id=p.user_id WHERE c.tutor_id=? ORDER BY p.id DESC`, user.id));

// ---------------------------------------------------------------- admin
const REPORTS = {
  users: 'SELECT id,name,email,role,status,created_at FROM users ORDER BY id DESC',
  courses: 'SELECT c.id,c.title,c.category,c.difficulty,c.price,c.status,u.name tutor FROM courses c JOIN users u ON u.id=c.tutor_id ORDER BY c.id DESC',
  enrollments: 'SELECT e.id,u.name student,c.title course,e.created_at FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id ORDER BY e.id DESC',
  classes: 'SELECT s.session_id id,s.title,c.title course,s.date,s.start_time,s.end_time,s.status FROM class_sessions s JOIN courses c ON c.id=s.course_id ORDER BY s.date DESC',
  assignments: 'SELECT a.id,a.title,c.title course,a.due_date,(SELECT COUNT(*) FROM submissions s WHERE s.assignment_id=a.id) submissions FROM assignments a JOIN courses c ON c.id=a.course_id ORDER BY a.id DESC',
  feedback: 'SELECT f.id,u.name student,c.title course,f.rating,f.review FROM feedback f JOIN users u ON u.id=f.user_id JOIN courses c ON c.id=f.course_id ORDER BY f.id DESC',
  payments: 'SELECT p.id,p.txn_id,u.name student,c.title course,p.amount,p.method,p.status,p.created_at FROM payments p JOIN users u ON u.id=p.user_id JOIN courses c ON c.id=p.course_id ORDER BY p.id DESC' };
route('GET', '/api/admin/stats', ['admin'], () => ({
  users: q1('SELECT COUNT(*) n FROM users').n, students: q1("SELECT COUNT(*) n FROM users WHERE role='student'").n, tutors: q1("SELECT COUNT(*) n FROM users WHERE role='tutor'").n,
  courses: q1('SELECT COUNT(*) n FROM courses').n, enrollments: q1('SELECT COUNT(*) n FROM enrollments').n, payments: q1("SELECT COUNT(*) n FROM payments WHERE status='Success'").n,
  revenue: q1("SELECT COALESCE(SUM(amount),0) n FROM payments WHERE status='Success'").n,
  activeClasses: classRows('').filter((c) => c.status === 'scheduled' || c.status === 'live').length,
  perCourse: q('SELECT c.title, COUNT(e.id) n FROM courses c LEFT JOIN enrollments e ON e.course_id=c.id GROUP BY c.id ORDER BY n DESC LIMIT 8') }));
route('GET', '/api/admin/users', ['admin'], ({ query }) => {
  const w = ['1=1'], p = [];
  if (query.role) { w.push('role=?'); p.push(query.role); }
  if (query.status) { w.push('status=?'); p.push(query.status); }
  if (query.q) { w.push('(name LIKE ? OR email LIKE ?)'); p.push(`%${query.q}%`, `%${query.q}%`); }
  return q(`SELECT id,name,email,role,status,created_at FROM users WHERE ${w.join(' AND ')} ORDER BY id DESC`, ...p);
});
route('PUT', '/api/admin/users/:id', ['admin'], ({ user, params, body }) => S.manageUser(user, Number(params.id), body.action));
route('GET', '/api/admin/courses', ['admin'], ({ query }) => q(`${COURSE_SQL} ${query.status ? 'WHERE c.status=?' : ''} ORDER BY c.id DESC`, ...(query.status ? [query.status] : [])));
route('PUT', '/api/admin/courses/:id', ['admin'], ({ user, params, body }) => S.manageCourse(user, Number(params.id), body.action));
route('GET', '/api/admin/report/:type', ['admin'], ({ params }) => { if (!REPORTS[params.type]) S.fail(404, 'Unknown report.'); return q(REPORTS[params.type]); });
route('DELETE', '/api/admin/:type/:id', ['admin'], ({ params }) => {
  const t = { enrollments: ['enrollments', 'id'], feedback: ['feedback', 'id'], assignments: ['assignments', 'id'], classes: ['class_sessions', 'session_id'] }[params.type];
  if (!t) S.fail(404, 'Unknown item.');
  exec(`DELETE FROM ${t[0]} WHERE ${t[1]}=?`, params.id); return { ok: true };
});
route('POST', '/api/admin/categories', ['admin'], ({ body }) => {
  const n = String(body.name || '').trim();
  if (!n) S.fail(400, 'Please enter a category name.');
  if (q1('SELECT 1 FROM categories WHERE name=?', n)) S.fail(409, 'Category already exists.');
  return { id: run('INSERT INTO categories(name) VALUES(?)', n) };
});
route('DELETE', '/api/admin/categories/:id', ['admin'], ({ params }) => { exec('DELETE FROM categories WHERE id=?', params.id); return { ok: true }; });
route('GET', '/api/admin/monitor', ['admin'], () => ({
  activeUsers: [...mon.seen.values()].filter((t) => Date.now() - t < 15 * 60e3).length, requests: mon.requests, errors: mon.errors, uptimeMin: Math.round((Date.now() - mon.started) / 60e3),
  activity: mon.activity, regs: q('SELECT name,role,created_at FROM users ORDER BY id DESC LIMIT 5'),
  enrolls: q('SELECT u.name student,c.title course,e.created_at FROM enrollments e JOIN users u ON u.id=e.user_id JOIN courses c ON c.id=e.course_id ORDER BY e.id DESC LIMIT 5'),
  pays: q("SELECT u.name student,c.title course,p.amount,p.status,p.created_at FROM payments p JOIN users u ON u.id=p.user_id JOIN courses c ON c.id=p.course_id ORDER BY p.id DESC LIMIT 5"), status: 'Operational' }));

// ---------------------------------------------------------------- server
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const send = (res, code, data, headers = {}) => { const body = typeof data === 'string' ? data : JSON.stringify(data); res.writeHead(code, { 'Content-Type': 'application/json', ...headers }); res.end(body); };

async function handleApi(req, res, url) {
  mon.requests++;
  try {
    const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
    if (!r) S.fail(404, 'Not found.');
    const params = { ...url.pathname.match(r.re).groups };
    let user = null;
    const t = (req.headers.authorization || '').replace('Bearer ', '');
    if (t) {
      const d = verify(t);
      if (d) { user = q1('SELECT id,name,email,role,status,avatar FROM users WHERE id=?', d.id); if (user && user.status !== 'active') user = null; }
    }
    if (r.roles && r.roles !== 'optional') {
      if (!user) S.fail(401, 'Please log in to continue.');
      if (Array.isArray(r.roles) && !r.roles.includes(user.role)) S.fail(403, 'Unauthorized access.');
    }
    if (user) mon.seen.set(user.id, Date.now());
    let body = {};
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > 2e6) S.fail(413, 'Request is too large.'); chunks.push(c); }
      try { body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}; } catch { S.fail(400, 'Invalid request.'); }
    }
    send(res, 200, r.fn({ req, res, params, query: Object.fromEntries(url.searchParams), body, user }) ?? {});
  } catch (e) {
    if (!(e instanceof S.AppError)) { console.error(e); mon.errors++; }
    send(res, e.status || 500, { error: e.status ? e.message : 'Something went wrong. Please try again.' });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(req, res, url);
  let file = path.join(__dirname, 'public', path.normalize(url.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(path.join(__dirname, 'public'))) return send(res, 403, { error: 'Forbidden' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(__dirname, 'public', 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'X-Content-Type-Options': 'nosniff' });
  fs.createReadStream(file).pipe(res);
});
if (require.main === module) server.listen(PORT, () => console.log(`\nPeer2Peer Learn is running at http://localhost:${PORT}\nDEMO logins (password Demo@1234): student@demo.com | tutor@demo.com | admin@demo.com\n`));
module.exports = { server };
