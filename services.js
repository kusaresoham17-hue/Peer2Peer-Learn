// Business logic. Each exported function maps to a testable unit used in white-box testing.
const { q, q1, run, exec, notify, hashPassword, verifyPassword } = require('./db');

class AppError extends Error { constructor(status, message) { super(message); this.status = status; } }
const fail = (s, m) => { throw new AppError(s, m); };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DIFFICULTY = ['Beginner', 'Intermediate', 'Advanced'];

const publicUser = (id) => q1('SELECT id,name,email,role,skills,interests,bio,avatar,status,created_at FROM users WHERE id=?', id);

function checkImage(d, what = 'Image') {
  if (!d) return null;
  if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(d)) fail(400, `${what} must be a PNG, JPG, WEBP or GIF image.`);
  if (d.length > 400000) fail(400, `${what} is too large (max 300 KB).`);
  return d;
}

function validateZoomLink(url) {
  try {
    const u = new URL(String(url || '').trim());
    return u.protocol === 'https:' && (u.hostname === 'zoom.us' || u.hostname.endsWith('.zoom.us'));
  } catch { return false; }
}

function validPassword(p) { return typeof p === 'string' && p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p); }

// ---------------------------------------------------------------- users
function registerUser(b) {
  const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase();
  if (!name || !email || !b.password) fail(400, 'Name, email and password are required.');
  if (!EMAIL.test(email)) fail(400, 'Please enter a valid email address.');
  if (!validPassword(b.password)) fail(400, 'Password must be at least 8 characters and contain a letter and a number.');
  if (b.password !== b.confirm) fail(400, 'Passwords do not match.');
  if (!['student', 'tutor'].includes(b.role)) fail(400, 'Please choose Student or Peer Tutor.');
  if (q1('SELECT id FROM users WHERE email=?', email)) fail(409, 'This email is already registered.');
  const avatar = checkImage(b.avatar, 'Profile picture');
  const id = run('INSERT INTO users(name,email,password_hash,role,skills,interests,avatar) VALUES(?,?,?,?,?,?,?)',
    name, email, hashPassword(b.password), b.role, String(b.skills || '').slice(0, 200), String(b.interests || '').slice(0, 200), avatar);
  notify(id, 'Welcome to Peer2Peer Learn! Complete your profile to get started.');
  return publicUser(id);
}

function loginUser(b) {
  const email = String(b.email || '').trim().toLowerCase();
  if (!email || !b.password) fail(400, 'Please enter your email and password.');
  const u = q1('SELECT * FROM users WHERE email=?', email);
  if (!u || !verifyPassword(String(b.password), u.password_hash)) fail(401, 'Invalid email or password.');
  if (u.status !== 'active') fail(403, 'Your account has been disabled. Please contact the administrator.');
  return publicUser(u.id);
}

function updateProfile(uid, b) {
  const name = String(b.name || '').trim();
  if (!name) fail(400, 'Name cannot be empty.');
  const avatar = b.avatar === undefined ? undefined : checkImage(b.avatar, 'Profile picture');
  run('UPDATE users SET name=?,skills=?,interests=?,bio=? WHERE id=?', name, String(b.skills || '').slice(0, 200), String(b.interests || '').slice(0, 200), String(b.bio || '').slice(0, 500), uid);
  if (avatar) run('UPDATE users SET avatar=? WHERE id=?', avatar, uid);
  if (b.new_password) {
    const u = q1('SELECT password_hash FROM users WHERE id=?', uid);
    if (!verifyPassword(String(b.current_password || ''), u.password_hash)) fail(400, 'Current password is incorrect.');
    if (!validPassword(b.new_password)) fail(400, 'New password must be at least 8 characters with a letter and a number.');
    run('UPDATE users SET password_hash=? WHERE id=?', hashPassword(b.new_password), uid);
  }
  return publicUser(uid);
}

function manageUser(admin, id, action) {
  const u = q1('SELECT * FROM users WHERE id=?', id);
  if (!u) fail(404, 'User not found.');
  if (u.id === admin.id) fail(400, 'You cannot change your own account.');
  if (action === 'activate') exec("UPDATE users SET status='active' WHERE id=?", id);
  else if (action === 'deactivate') exec("UPDATE users SET status='disabled' WHERE id=?", id);
  else if (action === 'delete') exec('DELETE FROM users WHERE id=?', id);
  else fail(400, 'Unknown action.');
  return { ok: true };
}

// ---------------------------------------------------------------- courses
function saveCourse(user, b, id) {
  const title = String(b.title || '').trim(), description = String(b.description || '').trim();
  if (title.length < 3) fail(400, 'Course title must be at least 3 characters.');
  if (description.length < 10) fail(400, 'Please add a course description (at least 10 characters).');
  if (!b.category) fail(400, 'Please choose a category.');
  if (!DIFFICULTY.includes(b.difficulty)) fail(400, 'Please choose a difficulty level.');
  const price = b.paid ? Number(b.price) : 0;
  if (b.paid && !(price > 0)) fail(400, 'Please enter a price greater than 0 for a paid course.');
  const duration = Math.max(0, Number(b.duration) || 0);
  const thumb = checkImage(b.thumb, 'Thumbnail');
  const status = b.publish ? 'published' : 'draft';
  const lessons = (Array.isArray(b.lessons) ? b.lessons : []).filter((l) => l && String(l.title || '').trim());
  if (b.publish && lessons.length === 0 && !id) fail(400, 'Add at least one lesson before publishing.');
  let cid = id, wasPublished = false;
  if (id) {
    const c = q1('SELECT * FROM courses WHERE id=?', id);
    if (!c) fail(404, 'Course not found.');
    if (c.tutor_id !== user.id && user.role !== 'admin') fail(403, 'Unauthorized access.');
    wasPublished = c.status === 'published';
    run("UPDATE courses SET title=?,description=?,category=?,difficulty=?,duration=?,price=?,objectives=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", title, description, b.category, b.difficulty, duration, price, String(b.objectives || ''), status, id);
    if (thumb) run('UPDATE courses SET thumb=? WHERE id=?', thumb, id);
  } else {
    cid = run('INSERT INTO courses(title,description,category,difficulty,tutor_id,duration,price,objectives,thumb,status) VALUES(?,?,?,?,?,?,?,?,?,?)', title, description, b.category, b.difficulty, user.id, duration, price, String(b.objectives || ''), thumb, status);
  }
  if (lessons.length) {
    const pos = q1('SELECT COALESCE(MAX(position),-1)+1 p FROM lessons WHERE course_id=?', cid).p;
    lessons.forEach((l, i) => run('INSERT INTO lessons(course_id,module,title,content,resource_url,position) VALUES(?,?,?,?,?,?)', cid, String(l.module || 'Module 1').trim(), String(l.title).trim(), String(l.description || ''), String(l.url || '').trim(), pos + i));
  }
  if (status === 'published' && !wasPublished) {
    q("SELECT id FROM users WHERE role!='admin' AND id!=?", user.id).forEach((u) => notify(u.id, `New course published: "${title}".`));
  }
  return cid;
}
const createCourse = (tutor, b) => saveCourse(tutor, b, null);

function manageCourse(admin, id, action) {
  const c = q1('SELECT * FROM courses WHERE id=?', id);
  if (!c) fail(404, 'Course not found.');
  const map = { approve: 'published', reject: 'rejected', archive: 'archived' };
  if (action === 'delete') exec('DELETE FROM courses WHERE id=?', id);
  else if (map[action]) { exec('UPDATE courses SET status=? WHERE id=?', map[action], id); notify(c.tutor_id, `Your course "${c.title}" was ${map[action]} by the administrator.`); }
  else fail(400, 'Unknown action.');
  return { ok: true };
}

function enrollCourse(uid, cid) {
  const c = q1("SELECT * FROM courses WHERE id=? AND status='published'", cid);
  if (!c) fail(404, 'Course could not be loaded.');
  if (c.tutor_id === uid) fail(400, 'You cannot enroll in your own course.');
  if (q1('SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?', uid, cid)) fail(409, 'You are already enrolled in this course.');
  if (c.price > 0) fail(402, 'This is a paid course. Please complete the payment to enroll.');
  run('INSERT INTO enrollments(user_id,course_id) VALUES(?,?)', uid, cid);
  notify(uid, `Enrollment successful: ${c.title}.`);
  notify(c.tutor_id, `A new student enrolled in ${c.title}.`);
  return { ok: true, message: 'Enrollment Successful' };
}

// ---------------------------------------------------------------- payments (MOCK only)
function processMockPayment(uid, b) {
  const c = q1("SELECT * FROM courses WHERE id=? AND status='published'", b.course_id);
  if (!c) fail(404, 'Course could not be loaded.');
  if (c.price <= 0) fail(400, 'This course is free. No payment is needed.');
  if (q1('SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?', uid, c.id)) fail(409, 'You are already enrolled in this course.');
  if (!['Card', 'UPI', 'Net Banking'].includes(b.method)) fail(400, 'Please choose a payment method.');
  const txn = 'TXN' + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  // DEMO: a card number ending in 0000 simulates a failed payment.
  if (b.method === 'Card' && String(b.card || '').replace(/\s/g, '').endsWith('0000')) {
    run('INSERT INTO payments(user_id,course_id,amount,method,txn_id,status) VALUES(?,?,?,?,?,?)', uid, c.id, c.price, b.method, txn, 'Failed');
    fail(402, 'Payment could not be completed.');
  }
  const pid = run('INSERT INTO payments(user_id,course_id,amount,method,txn_id,status) VALUES(?,?,?,?,?,?)', uid, c.id, c.price, b.method, txn, 'Success');
  run('INSERT INTO enrollments(user_id,course_id) VALUES(?,?)', uid, c.id);
  notify(uid, `Payment successful for ${c.title}.`);
  notify(c.tutor_id, `A new student enrolled in ${c.title}.`);
  return generateReceipt(pid, uid);
}

function generateReceipt(pid, uid) {
  const p = q1(`SELECT p.*, c.title course, t.name tutor, u.name student, u.email FROM payments p JOIN courses c ON c.id=p.course_id
    JOIN users t ON t.id=c.tutor_id JOIN users u ON u.id=p.user_id WHERE p.id=?`, pid);
  if (!p) fail(404, 'Receipt not found.');
  const viewer = q1('SELECT role FROM users WHERE id=?', uid);
  if (p.user_id !== uid && viewer.role !== 'admin') fail(403, 'Unauthorized access.');
  return { ...p, receipt_no: 'RCPT-' + String(p.id).padStart(5, '0') };
}

// ---------------------------------------------------------------- classes (Zoom links only)
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
function scheduleClass(tutor, b) {
  const c = q1('SELECT * FROM courses WHERE id=?', b.course_id);
  if (!c || (c.tutor_id !== tutor.id && tutor.role !== 'admin')) fail(403, 'You can only schedule classes for your own courses.');
  if (!String(b.title || '').trim()) fail(400, 'Please enter a class title.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.date || '')) fail(400, 'Please choose a valid date.');
  if (!hhmm.test(b.start_time || '') || !hhmm.test(b.end_time || '')) fail(400, 'Please choose a valid start and end time.');
  if (b.end_time <= b.start_time) fail(400, 'End time must be after start time.');
  if (!validateZoomLink(b.zoom_link)) fail(400, 'Please enter a valid Zoom meeting link.');
  const id = run('INSERT INTO class_sessions(course_id,tutor_id,title,description,date,start_time,end_time,zoom_link) VALUES(?,?,?,?,?,?,?,?)',
    c.id, c.tutor_id, String(b.title).trim(), String(b.description || ''), b.date, b.start_time, b.end_time, String(b.zoom_link).trim());
  q('SELECT user_id FROM enrollments WHERE course_id=?', c.id).forEach((e) => notify(e.user_id, `New class scheduled: "${b.title}" on ${b.date} at ${b.start_time}. Click Join Class to attend through Zoom.`));
  return id;
}

function updateClass(user, id, b) {
  const s = q1('SELECT * FROM class_sessions WHERE session_id=?', id);
  if (!s) fail(404, 'Class not found.');
  if (s.tutor_id !== user.id && user.role !== 'admin') fail(403, 'Unauthorized access.');
  const students = q('SELECT user_id FROM enrollments WHERE course_id=?', s.course_id);
  if (b.status === 'cancelled') {
    exec("UPDATE class_sessions SET status='cancelled',updated_at=CURRENT_TIMESTAMP WHERE session_id=?", id);
    students.forEach((e) => notify(e.user_id, `Class cancelled: "${s.title}" on ${s.date}.`));
    return { ok: true };
  }
  const n = { title: b.title ?? s.title, description: b.description ?? s.description, date: b.date ?? s.date, start_time: b.start_time ?? s.start_time, end_time: b.end_time ?? s.end_time, zoom_link: b.zoom_link ?? s.zoom_link };
  if (!hhmm.test(n.start_time) || !hhmm.test(n.end_time) || n.end_time <= n.start_time) fail(400, 'Please choose a valid start and end time.');
  if (!validateZoomLink(n.zoom_link)) fail(400, 'Please enter a valid Zoom meeting link.');
  exec("UPDATE class_sessions SET title=?,description=?,date=?,start_time=?,end_time=?,zoom_link=?,status='scheduled',updated_at=CURRENT_TIMESTAMP WHERE session_id=?", n.title, n.description, n.date, n.start_time, n.end_time, n.zoom_link, id);
  if (n.date !== s.date || n.start_time !== s.start_time) students.forEach((e) => notify(e.user_id, `Class rescheduled: "${n.title}" is now on ${n.date} at ${n.start_time}.`));
  return { ok: true };
}

function classStatus(c, now = new Date()) {
  if (c.status === 'cancelled') return 'cancelled';
  const start = new Date(`${c.date}T${c.start_time}:00`), end = new Date(`${c.date}T${c.end_time}:00`);
  if (now > end) return 'completed';
  if (now >= start) return 'live';
  return 'scheduled';
}

function joinClass(uid, sid) {
  const c = q1('SELECT * FROM class_sessions WHERE session_id=?', sid);
  if (!c) fail(404, 'Class not found.');
  const enrolled = q1('SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?', uid, c.course_id);
  if (!enrolled && c.tutor_id !== uid) fail(403, 'Unauthorized access.');
  const st = classStatus(c);
  if (st === 'cancelled') fail(410, 'This class has been cancelled.');
  if (st === 'completed') fail(410, 'This class has already ended.');
  if (!validateZoomLink(c.zoom_link)) fail(400, 'Please enter a valid Zoom meeting link.');
  return { zoom_link: c.zoom_link };
}

// ---------------------------------------------------------------- assignments
function createAssignment(tutor, b) {
  const c = q1('SELECT * FROM courses WHERE id=?', b.course_id);
  if (!c || (c.tutor_id !== tutor.id && tutor.role !== 'admin')) fail(403, 'You can only create assignments for your own courses.');
  if (!String(b.title || '').trim()) fail(400, 'Please enter an assignment title.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.due_date || '')) fail(400, 'Please choose a valid deadline.');
  const max = Number(b.max_marks) || 100;
  if (max < 1 || max > 1000) fail(400, 'Maximum marks must be between 1 and 1000.');
  const id = run('INSERT INTO assignments(course_id,title,instructions,due_date,max_marks) VALUES(?,?,?,?,?)', c.id, String(b.title).trim(), String(b.instructions || ''), b.due_date, max);
  q('SELECT user_id FROM enrollments WHERE course_id=?', c.id).forEach((e) => notify(e.user_id, `New assignment "${b.title}" is due on ${b.due_date}.`));
  return id;
}

function submitAssignment(uid, aid, b) {
  const a = q1('SELECT a.*, c.tutor_id FROM assignments a JOIN courses c ON c.id=a.course_id WHERE a.id=?', aid);
  if (!a) fail(404, 'Assignment not found.');
  if (!q1('SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?', uid, a.course_id)) fail(403, 'Unauthorized access.');
  const content = String(b.content || '').trim();
  if (!content) fail(400, 'Please write your answer or paste a link to your work.');
  if (content.length > 5000) fail(400, 'Submission is too long (max 5000 characters).');
  if (q1('SELECT 1 FROM submissions WHERE assignment_id=? AND student_id=?', aid, uid)) fail(409, 'You have already submitted this assignment.');
  const late = new Date() > new Date(a.due_date + 'T23:59:59');
  run('INSERT INTO submissions(assignment_id,student_id,content,status) VALUES(?,?,?,?)', aid, uid, content, late ? 'Late' : 'Submitted');
  notify(a.tutor_id, `New submission for "${a.title}".`);
  return { ok: true, status: late ? 'Late' : 'Submitted' };
}

function evaluateAssignment(tutor, sid, b) {
  const s = q1(`SELECT s.*, a.title, a.max_marks, c.tutor_id FROM submissions s JOIN assignments a ON a.id=s.assignment_id JOIN courses c ON c.id=a.course_id WHERE s.id=?`, sid);
  if (!s) fail(404, 'Submission not found.');
  if (s.tutor_id !== tutor.id && tutor.role !== 'admin') fail(403, 'Unauthorized access.');
  if (b.review_only) { exec("UPDATE submissions SET status='Under Review' WHERE id=?", sid); return { ok: true }; }
  const marks = Number(b.marks);
  if (b.marks === '' || b.marks == null || !Number.isFinite(marks) || marks < 0 || marks > s.max_marks) fail(400, `Marks must be a number between 0 and ${s.max_marks}.`);
  exec("UPDATE submissions SET marks=?,feedback=?,status='Evaluated' WHERE id=?", Math.round(marks), String(b.feedback || '').slice(0, 1000), sid);
  notify(s.student_id, `Your assignment "${s.title}" was evaluated: ${Math.round(marks)}/${s.max_marks}.`);
  return { ok: true };
}

// ---------------------------------------------------------------- messages and feedback
function canMessage(a, b) {
  const ua = q1('SELECT role FROM users WHERE id=?', a), ub = q1('SELECT role FROM users WHERE id=?', b);
  if (!ua || !ub) return false;
  if (ua.role === 'admin' || ub.role === 'admin') return true;
  return !!q1(`SELECT 1 FROM enrollments e JOIN courses c ON c.id=e.course_id WHERE (e.user_id=? AND c.tutor_id=?) OR (e.user_id=? AND c.tutor_id=?)`, a, b, b, a);
}

function sendMessage(uid, b) {
  const to = Number(b.to_id), body = String(b.body || '').trim();
  if (!to || to === uid) fail(400, 'Please choose who to message.');
  if (!body) fail(400, 'Message cannot be empty.');
  if (body.length > 1000) fail(400, 'Message is too long (max 1000 characters).');
  if (!canMessage(uid, to)) fail(403, 'You can only message tutors of your courses or students of your courses.');
  const id = run('INSERT INTO messages(from_id,to_id,course_id,body) VALUES(?,?,?,?)', uid, to, b.course_id || null, body);
  notify(to, `New message from ${q1('SELECT name FROM users WHERE id=?', uid).name}.`);
  return id;
}

function submitFeedback(uid, cid, b) {
  if (!q1('SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?', uid, cid)) fail(403, 'Only enrolled students can rate this course.');
  const rating = Number(b.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail(400, 'Please choose a star rating from 1 to 5.');
  const review = String(b.review || '').trim().slice(0, 500);
  run('INSERT OR REPLACE INTO feedback(course_id,user_id,rating,review) VALUES(?,?,?,?)', cid, uid, rating, review);
  const c = q1('SELECT * FROM courses WHERE id=?', cid);
  notify(c.tutor_id, `New feedback received on ${c.title}.`);
  return { ok: true };
}

module.exports = { AppError, fail, publicUser, validateZoomLink, validPassword, registerUser, loginUser, updateProfile, manageUser, createCourse, saveCourse, manageCourse,
  enrollCourse, processMockPayment, generateReceipt, scheduleClass, updateClass, classStatus, joinClass, createAssignment, submitAssignment, evaluateAssignment,
  canMessage, sendMessage, submitFeedback };
