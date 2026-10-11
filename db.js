// Database layer: SQLite (built into Node 22.5+), schema and demo data.
const { DatabaseSync } = require('node:sqlite');
const crypto = require('crypto');
const path = require('path');

const db = new DatabaseSync(process.env.DB_FILE || path.join(__dirname, 'p2p.db'));
db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');

const q = (sql, ...p) => db.prepare(sql).all(...p);
const q1 = (sql, ...p) => db.prepare(sql).get(...p);
const run = (sql, ...p) => Number(db.prepare(sql).run(...p).lastInsertRowid);
const exec = (sql, ...p) => db.prepare(sql).run(...p).changes;
const notify = (uid, text) => run('INSERT INTO notifications(user_id,text) VALUES(?,?)', uid, text);

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString('hex');
  return salt + ':' + crypto.scryptSync(pw, salt, 64).toString('hex');
}
function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  return crypto.timingSafeEqual(test, Buffer.from(hash, 'hex'));
}

db.exec(`
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','tutor','admin')), skills TEXT DEFAULT '', interests TEXT DEFAULT '',
  bio TEXT DEFAULT '', avatar TEXT, status TEXT NOT NULL DEFAULT 'active', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL);
CREATE TABLE IF NOT EXISTS courses(
  id INTEGER PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, category TEXT NOT NULL, difficulty TEXT NOT NULL,
  tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, duration INTEGER DEFAULT 0, price INTEGER DEFAULT 0,
  objectives TEXT DEFAULT '', thumb TEXT, status TEXT NOT NULL DEFAULT 'draft', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS lessons(
  id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, module TEXT NOT NULL, title TEXT NOT NULL,
  content TEXT DEFAULT '', resource_url TEXT DEFAULT '', position INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS enrollments(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id,course_id));
CREATE TABLE IF NOT EXISTS progress(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, PRIMARY KEY(user_id,lesson_id));
CREATE TABLE IF NOT EXISTS class_sessions(
  session_id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL, description TEXT DEFAULT '', date TEXT NOT NULL, start_time TEXT NOT NULL, end_time TEXT NOT NULL, zoom_link TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled', created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS assignments(
  id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, title TEXT NOT NULL, instructions TEXT DEFAULT '',
  due_date TEXT NOT NULL, max_marks INTEGER DEFAULT 100, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS submissions(
  id INTEGER PRIMARY KEY, assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE, student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'Submitted', marks INTEGER, feedback TEXT DEFAULT '', submitted_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(assignment_id,student_id));
CREATE TABLE IF NOT EXISTS messages(
  id INTEGER PRIMARY KEY, from_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, to_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL, body TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS notifications(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, text TEXT NOT NULL, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS feedback(
  id INTEGER PRIMARY KEY, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5), review TEXT DEFAULT '', created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(course_id,user_id));
CREATE TABLE IF NOT EXISTS payments(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, method TEXT NOT NULL, txn_id TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

// ---------------------------------------------------------------- demo data
function seed() {
  if (q1('SELECT COUNT(*) n FROM users').n > 0) return;
  const DEMO_PW = 'Demo@1234';
  const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const ts = (n) => new Date(Date.now() + n * 864e5).toISOString().replace('T', ' ').slice(0, 19);
  ['Programming', 'Web Development', 'Computer Science', 'Data Science', 'Design', 'Databases', 'Soft Skills', 'Cloud', 'Business']
    .forEach((c) => run('INSERT INTO categories(name) VALUES(?)', c));
  const mk = (name, email, role, skills, interests, bio) =>
    run('INSERT INTO users(name,email,password_hash,role,skills,interests,bio,created_at) VALUES(?,?,?,?,?,?,?,?)',
      name, email, hashPassword(DEMO_PW), role, skills, interests, bio, ts(-30));
  mk('Platform Admin', 'admin@demo.com', 'admin', '', '', 'Administrator of Peer2Peer Learn (DEMO account).');
  const tutors = [
    ['Rahul Sharma', 'tutor@demo.com', 'Python, SQL, Databases', 'Teaching, open source', 'Final-year CS student who loves explaining code. (DEMO account)'],
    ['Priya Nair', 'priya@demo.com', 'HTML, CSS, JavaScript, UI/UX', 'Design systems', 'Front-end developer and design enthusiast.'],
    ['Aman Verma', 'aman@demo.com', 'Java, Data Structures', 'Competitive programming', 'Coding club mentor, 2 years of tutoring experience.'],
    ['Sneha Kulkarni', 'sneha@demo.com', 'Machine Learning, Cloud', 'AI research', 'Likes turning maths into intuition.'],
    ['Karan Mehta', 'karan@demo.com', 'Communication, Marketing', 'Public speaking', 'Debate club captain and marketing intern.'],
  ].map((t) => mk(t[0], t[1], 'tutor', t[2], t[3], t[4]));
  const names = ['Aisha Khan', 'Rohan Patil', 'Neha Joshi', 'Vikram Singh', 'Meera Iyer', 'Arjun Desai', 'Fatima Sheikh', 'Siddharth Rao', 'Anjali Gupta', 'Dev Malhotra', 'Isha Kapoor', 'Yash Bhatt'];
  const students = names.map((n, i) => mk(n, i === 0 ? 'student@demo.com' : n.split(' ')[0].toLowerCase() + '@demo.com', 'student',
    ['Python, C', 'HTML, CSS', 'Java', 'SQL', 'Figma', 'JavaScript'][i % 6], ['Web development', 'AI', 'Design', 'Data'][i % 4], i === 0 ? 'Third-year engineering student. (DEMO account)' : ''));

  const courses = [
    ['Python Programming', 'Programming', 'Beginner', 0, 12, 0, 'Learn Python from scratch: syntax, data types, functions, files and small projects.'],
    ['Web Development', 'Web Development', 'Intermediate', 1, 20, 499, 'Build responsive websites with HTML, CSS and JavaScript and publish them online.'],
    ['Java Programming', 'Programming', 'Beginner', 2, 18, 0, 'Object-oriented programming in Java with classes, inheritance, collections and exceptions.'],
    ['Data Structures', 'Computer Science', 'Intermediate', 2, 16, 299, 'Arrays, linked lists, stacks, queues, trees and graphs with practical problems.'],
    ['Machine Learning', 'Data Science', 'Advanced', 3, 24, 799, 'Supervised and unsupervised learning, model evaluation and a hands-on mini project.'],
    ['UI/UX Design', 'Design', 'Beginner', 1, 10, 0, 'Design principles, wireframing and prototyping for clean, usable interfaces.'],
    ['Database Management', 'Databases', 'Intermediate', 0, 14, 199, 'ER modelling, normalization and SQL queries with real datasets.'],
    ['Communication Skills', 'Soft Skills', 'Beginner', 4, 8, 0, 'Speak, write and present with confidence in college and at work.'],
    ['Cloud Computing Basics', 'Cloud', 'Beginner', 3, 10, 299, 'Cloud concepts, virtual machines, storage and deploying a simple web app.'],
    ['Digital Marketing', 'Business', 'Beginner', 4, 9, 0, 'SEO, social media and analytics fundamentals for small projects and startups.'],
  ];
  const cid = [], lessonIds = [];
  courses.forEach((c, i) => {
    const id = run('INSERT INTO courses(title,description,category,difficulty,tutor_id,duration,price,objectives,status,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',
      c[0], c[6], c[1], c[2], tutors[c[3]], c[4], c[5], `Understand the fundamentals of ${c[0]}\nApply concepts in small practical tasks\nComplete a final mini project`, 'published', ts(-25 + i));
    cid.push(id);
    const ls = [['Module 1: Getting Started', 'Introduction to ' + c[0]], ['Module 1: Getting Started', 'Setting up your tools'], ['Module 1: Getting Started', 'Core concepts explained'],
      ['Module 2: Practice', 'Hands-on exercises'], ['Module 2: Practice', 'Mini project and wrap-up']];
    lessonIds.push(ls.map((l, p) => run('INSERT INTO lessons(course_id,module,title,content,resource_url,position) VALUES(?,?,?,?,?,?)', id, l[0], l[1],
      `Notes for "${l[1]}": key ideas, worked examples and practice questions for ${c[0]}. Read the notes, try the examples yourself and ask your tutor if something is unclear.`, '', p)));
  });
  const enroll = (s, ci) => {
    run('INSERT OR IGNORE INTO enrollments(user_id,course_id,created_at) VALUES(?,?,?)', s, cid[ci], ts(-10));
    if (courses[ci][5] > 0) run('INSERT INTO payments(user_id,course_id,amount,method,txn_id,status,created_at) VALUES(?,?,?,?,?,?,?)', s, cid[ci], courses[ci][5], ['UPI', 'Card', 'Net Banking'][ci % 3], 'TXN' + (700000 + s * 37 + ci * 11), 'Success', ts(-10));
  };
  students.forEach((s, i) => [i % 10, (i + 1) % 10, (i + 3) % 10].forEach((ci) => enroll(s, ci)));
  enroll(students[0], 0); enroll(students[0], 1); enroll(students[0], 5);
  lessonIds[0].slice(0, 4).forEach((l) => run('INSERT INTO progress(user_id,lesson_id) VALUES(?,?)', students[0], l));
  lessonIds[5].slice(0, 2).forEach((l) => run('INSERT INTO progress(user_id,lesson_id) VALUES(?,?)', students[0], l));
  students.slice(1, 6).forEach((s, i) => lessonIds[(i + 1) % 10].slice(0, (i % 4) + 1).forEach((l) => run('INSERT OR IGNORE INTO progress(user_id,lesson_id) VALUES(?,?)', s, l)));

  const zoom = (i) => `https://zoom.us/j/${98765430000 + i * 137}?pwd=demo${i}`;
  courses.forEach((c, i) => {
    run('INSERT INTO class_sessions(course_id,tutor_id,title,description,date,start_time,end_time,zoom_link,status) VALUES(?,?,?,?,?,?,?,?,?)',
      cid[i], tutors[c[3]], `${c[0]} - Live Session`, 'Concept walkthrough and live Q&A.', day((i % 6) + 1), '10:00', '11:00', zoom(i), 'scheduled');
  });
  run('INSERT INTO class_sessions(course_id,tutor_id,title,description,date,start_time,end_time,zoom_link,status) VALUES(?,?,?,?,?,?,?,?,?)', cid[0], tutors[0], 'Python Basics - Live Session', 'Variables, loops and functions.', day(-4), '10:00', '11:00', zoom(20), 'scheduled');
  run('INSERT INTO class_sessions(course_id,tutor_id,title,description,date,start_time,end_time,zoom_link,status) VALUES(?,?,?,?,?,?,?,?,?)', cid[1], tutors[1], 'Responsive Layouts Workshop', 'CSS grid and flexbox.', day(8), '16:00', '17:00', zoom(21), 'cancelled');

  const asg = cid.map((id, i) => run('INSERT INTO assignments(course_id,title,instructions,due_date,max_marks) VALUES(?,?,?,?,?)', id, `${courses[i][0]} - Assignment 1`,
    'Solve the three practice problems from the notes and submit your answers or a link to your work.', day(7 + (i % 3)), 100));
  students.slice(0, 8).forEach((s, i) => {
    const ci = i % 10;
    if (!q1('SELECT 1 FROM enrollments WHERE user_id=? AND course_id=?', s, cid[ci])) return;
    const evald = i % 2 === 0;
    run('INSERT OR IGNORE INTO submissions(assignment_id,student_id,content,status,marks,feedback,submitted_at) VALUES(?,?,?,?,?,?,?)', asg[ci], s,
      'My solutions: https://github.com/demo/assignment-' + (i + 1), evald ? 'Evaluated' : 'Submitted', evald ? 70 + i * 3 : null, evald ? 'Good work. Add more comments in your code.' : '', ts(-2));
  });
  run('INSERT OR IGNORE INTO submissions(assignment_id,student_id,content,status,marks,feedback,submitted_at) VALUES(?,?,?,?,?,?,?)', asg[5], students[0], 'Wireframes link: https://example.com/wireframes', 'Evaluated', 88, 'Clear layout and good use of spacing.', ts(-3));

  const msg = (a, b, body, n, read = 1) => run('INSERT INTO messages(from_id,to_id,course_id,body,is_read,created_at) VALUES(?,?,?,?,?,?)', a, b, cid[0], body, read, ts(n));
  msg(students[0], tutors[0], 'Can you explain how list comprehensions work?', -2);
  msg(tutors[0], students[0], 'Sure! A list comprehension builds a list in one line, e.g. [x*x for x in range(5)]. We will also cover it in the next class.', -2);
  msg(students[0], tutors[0], 'Thank you, that helps!', -1, 0);
  msg(tutors[0], students[1], 'Welcome to the course! Ask me anything.', -5);

  [[students[0], 'Your Python Programming class starts tomorrow at 10:00 AM. Click Join Class to attend through Zoom.'],
   [students[0], 'Your assignment "UI/UX Design - Assignment 1" was evaluated.'], [students[0], 'Payment successful for Web Development.'],
   [tutors[0], 'A new student enrolled in Python Programming.'], [tutors[0], 'New feedback received on Python Programming.']].forEach((n) => notify(n[0], n[1]));

  const comments = ['Very helpful peer tutor and easy-to-understand explanations.', 'Clear examples and great pace.', 'Good course, would like more practice questions.', 'Loved the live sessions!'];
  let k = 0;
  q('SELECT user_id,course_id FROM enrollments').forEach((e) => {
    if (k++ % 3 === 0) run('INSERT OR IGNORE INTO feedback(course_id,user_id,rating,review) VALUES(?,?,?,?)', e.course_id, e.user_id, 4 + (k % 2), comments[k % 4]);
  });
  run('INSERT OR REPLACE INTO feedback(course_id,user_id,rating,review) VALUES(?,?,?,?)', cid[5], students[0], 5, comments[0]);
  console.log('Demo data created.');
}

module.exports = { db, q, q1, run, exec, notify, hashPassword, verifyPassword, seed };
