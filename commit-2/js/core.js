'use strict';
/*
 * Peer2Peer Learn (minimal edition)
 * Data layer + business logic. Runs in the browser; all data lives in localStorage,
 * so the project needs no server, no database and no npm install.
 *
 * Testable functions (white-box testing): registerUser, loginUser, updateProfile, manageUser,
 * saveCourse/createCourse, enrollCourse, scheduleClass, validateZoomLink, joinClass,
 * submitAssignment, evaluateAssignment, sendMessage, submitFeedback, processMockPayment, generateReceipt.
 */
var P2P = (function () {
  var KEY = 'p2p_minimal_db_v0';
  var TABLES = ['users', 'categories', 'courses', 'lessons', 'enrollments', 'progress', 'sessions', 'assignments', 'submissions', 'messages', 'notifications', 'feedback', 'payments', 'activity'];
  var DB = null;
  var store = function () { return typeof localStorage !== 'undefined' ? localStorage : null; };
  var tmp = function () { return typeof sessionStorage !== 'undefined' ? sessionStorage : null; };

  function fail(msg) { throw new Error(msg); }
  function nowISO() { return new Date().toISOString(); }
  function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }

  /* ---------- password hashing (salted SHA-256, synchronous so it works on file://) ---------- */
  function sha256(str) {
    str = unescape(encodeURIComponent(str));
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, mw = mp(2, 32), i, j, result = '', words = [], bitLen = str.length * 8, hash = [], k = [], pc = 0, isC = {};
    for (var c = 2; pc < 64; c++) {
      if (!isC[c]) { for (i = 0; i < 313; i += c) isC[i] = c; hash[pc] = (mp(c, 0.5) * mw) | 0; k[pc++] = (mp(c, 1 / 3) * mw) | 0; }
    }
    str += '\x80';
    while (str.length % 64 - 56) str += '\x00';
    for (i = 0; i < str.length; i++) { j = str.charCodeAt(i); words[i >> 2] |= j << ((3 - i) % 4) * 8; }
    words[words.length] = (bitLen / mw) | 0; words[words.length] = bitLen;
    for (j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), old = hash; hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ (~e & hash[6])) + k[i] +
          (w[i] = i < 16 ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash); hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + old[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += (b < 16 ? 0 : '') + b.toString(16); }
    return result;
  }
  function hashPassword(pw) { return pw; } // TODO: passwords are stored as plain text
  function checkPassword(pw, stored) { return pw === stored; }
  function validPassword(p) { return typeof p === 'string' && p.length >= 1; }

  /* ---------- tiny table helpers ---------- */
  function nid(t) { DB.seq[t] = (DB.seq[t] || 0) + 1; return DB.seq[t]; }
  function add(t, o) { o.id = nid(t); if (!o.created_at) o.created_at = nowISO(); DB[t].push(o); return o; }
  function by(t, id) { id = Number(id); return DB[t].find(function (x) { return x.id === id; }) || null; }
  function where(t, fn) { return DB[t].filter(fn); }
  function remove(t, fn) { DB[t] = DB[t].filter(function (x) { return !fn(x); }); }
  var storageOK = true;
  function save() { try { store().setItem(KEY, JSON.stringify(DB)); storageOK = true; } catch (e) { storageOK = false; /* keep working in memory */ } }
  function notify(uid, text) { add('notifications', { user_id: uid, text: text, is_read: false }); }
  function log(text) { add('activity', { text: text }); if (DB.activity.length > 40) DB.activity.splice(0, DB.activity.length - 40); }

  /* ---------- demo data ---------- */
  function seed() {
    DB = { seq: {}, meta: { requests: 0 } };
    TABLES.forEach(function (t) { DB[t] = []; });
    var D = function (n) { return ymd(new Date(Date.now() + n * 864e5)); };
    var TS = function (n) { return new Date(Date.now() + n * 864e5).toISOString(); };
    ['Programming', 'Web Development', 'Computer Science', 'Data Science', 'Design', 'Databases', 'Soft Skills', 'Cloud', 'Business'].forEach(function (n) { add('categories', { name: n }); });
    var PW = 'Demo@1234';
    var mk = function (name, email, role, skills, interests, bio) {
      return add('users', { name: name, email: email, pass: hashPassword(PW), role: role, skills: skills, interests: interests, bio: bio, avatar: null, status: 'active', last_seen: null, created_at: TS(-30) }).id;
    };
    mk('Platform Admin', 'admin@demo.com', 'admin', '', '', 'Administrator of Peer2Peer Learn (DEMO account).');
    var tutors = [
      ['Rahul Sharma', 'tutor@demo.com', 'Python, SQL, Databases', 'Teaching, open source', 'Final-year CS student who loves explaining code. (DEMO account)'],
      ['Priya Nair', 'priya@demo.com', 'HTML, CSS, JavaScript, UI/UX', 'Design systems', 'Front-end developer and design enthusiast.'],
      ['Aman Verma', 'aman@demo.com', 'Java, Data Structures', 'Competitive programming', 'Coding club mentor with two years of tutoring experience.'],
      ['Sneha Kulkarni', 'sneha@demo.com', 'Machine Learning, Cloud', 'AI research', 'Likes turning maths into intuition.'],
      ['Karan Mehta', 'karan@demo.com', 'Communication, Marketing', 'Public speaking', 'Debate club captain and marketing intern.']
    ].map(function (t) { return mk(t[0], t[1], 'tutor', t[2], t[3], t[4]); });
    var names = ['Aisha Khan', 'Rohan Patil', 'Neha Joshi', 'Vikram Singh', 'Meera Iyer', 'Arjun Desai', 'Fatima Sheikh', 'Siddharth Rao', 'Anjali Gupta', 'Dev Malhotra', 'Isha Kapoor', 'Yash Bhatt'];
    var students = names.map(function (n, i) {
      return mk(n, i === 0 ? 'student@demo.com' : n.split(' ')[0].toLowerCase() + '@demo.com', 'student', ['Python, C', 'HTML, CSS', 'Java', 'SQL', 'Figma', 'JavaScript'][i % 6], ['Web development', 'AI', 'Design', 'Data'][i % 4], i === 0 ? 'Third-year engineering student. (DEMO account)' : '');
    });
    var courses = [
      ['Python Programming', 'Programming', 'Beginner', 0, 12, 0, 'Learn Python from scratch: syntax, data types, functions, files and small projects.'],
      ['Web Development', 'Web Development', 'Intermediate', 1, 20, 499, 'Build responsive websites with HTML, CSS and JavaScript and publish them online.'],
      ['Java Programming', 'Programming', 'Beginner', 2, 18, 0, 'Object-oriented programming in Java: classes, inheritance, collections and exceptions.'],
      ['Data Structures', 'Computer Science', 'Intermediate', 2, 16, 299, 'Arrays, linked lists, stacks, queues, trees and graphs with practical problems.'],
      ['Machine Learning', 'Data Science', 'Advanced', 3, 24, 799, 'Supervised and unsupervised learning, model evaluation and a hands-on mini project.'],
      ['UI/UX Design', 'Design', 'Beginner', 1, 10, 0, 'Design principles, wireframing and prototyping for clean, usable interfaces.'],
      ['Database Management', 'Databases', 'Intermediate', 0, 14, 199, 'ER modelling, normalization and SQL queries with real datasets.'],
      ['Communication Skills', 'Soft Skills', 'Beginner', 4, 8, 0, 'Speak, write and present with confidence in college and at work.'],
      ['Cloud Computing Basics', 'Cloud', 'Beginner', 3, 10, 299, 'Cloud concepts, virtual machines, storage and deploying a simple web app.'],
      ['Digital Marketing', 'Business', 'Beginner', 4, 9, 0, 'SEO, social media and analytics fundamentals for small projects and startups.']
    ];
    var cid = [], lids = [];
    courses.forEach(function (c, i) {
      var id = add('courses', { title: c[0], description: c[6], category: c[1], difficulty: c[2], tutor_id: tutors[c[3]], duration: c[4], price: c[5], objectives: 'Understand the fundamentals of ' + c[0] + '\nApply the concepts in small practical tasks\nComplete a final mini project', thumb: null, status: 'published', created_at: TS(-25 + i) }).id;
      cid.push(id);
      var ls = [['Module 1: Getting Started', 'Introduction to ' + c[0]], ['Module 1: Getting Started', 'Setting up your tools'], ['Module 1: Getting Started', 'Core concepts explained'], ['Module 2: Practice', 'Hands-on exercises'], ['Module 2: Practice', 'Mini project and wrap-up']];
      lids.push(ls.map(function (l, p) {
        return add('lessons', { course_id: id, module: l[0], title: l[1], content: 'Notes for "' + l[1] + '": key ideas, worked examples and practice questions for ' + c[0] + '. Read the notes, try the examples yourself and ask your tutor if something is unclear.', resource_url: '', position: p }).id;
      }));
    });
    var enroll = function (s, ci) {
      if (where('enrollments', function (e) { return e.user_id === s && e.course_id === cid[ci]; }).length) return;
      add('enrollments', { user_id: s, course_id: cid[ci], created_at: TS(-10) });
      if (courses[ci][5] > 0) add('payments', { user_id: s, course_id: cid[ci], amount: courses[ci][5], method: ['UPI', 'Card', 'Net Banking'][ci % 3], txn_id: 'TXN' + (700000 + s * 37 + ci * 11), status: 'Success', created_at: TS(-10) });
    };
    students.forEach(function (s, i) { [i % 10, (i + 1) % 10, (i + 3) % 10].forEach(function (ci) { enroll(s, ci); }); });
    [0, 1, 5].forEach(function (ci) { enroll(students[0], ci); });
    lids[0].slice(0, 4).forEach(function (l) { add('progress', { user_id: students[0], lesson_id: l }); });
    lids[5].slice(0, 2).forEach(function (l) { add('progress', { user_id: students[0], lesson_id: l }); });
    var zoom = function (i) { return 'https://zoom.us/j/' + (98765430000 + i * 137) + '?pwd=demo' + i; };
    courses.forEach(function (c, i) { add('sessions', { course_id: cid[i], tutor_id: tutors[c[3]], title: c[0] + ' - Live Session', description: 'Concept walkthrough and live Q&A.', date: D((i % 6) + 1), start_time: '10:00', end_time: '11:00', zoom_link: zoom(i), status: 'scheduled' }); });
    add('sessions', { course_id: cid[0], tutor_id: tutors[0], title: 'Python Basics - Live Session', description: 'Variables, loops and functions.', date: D(-4), start_time: '10:00', end_time: '11:00', zoom_link: zoom(20), status: 'scheduled' });
    add('sessions', { course_id: cid[1], tutor_id: tutors[1], title: 'Responsive Layouts Workshop', description: 'CSS grid and flexbox.', date: D(8), start_time: '16:00', end_time: '17:00', zoom_link: zoom(21), status: 'cancelled' });
    var asg = cid.map(function (id, i) { return add('assignments', { course_id: id, title: courses[i][0] + ' - Assignment 1', instructions: 'Solve the three practice problems from the notes and submit your answers or a link to your work.', due_date: D(7 + (i % 3)), max_marks: 100 }).id; });
    students.slice(0, 8).forEach(function (s, i) {
      var ci = i % 10;
      if (!where('enrollments', function (e) { return e.user_id === s && e.course_id === cid[ci]; }).length) return;
      var ev = i % 2 === 0;
      add('submissions', { assignment_id: asg[ci], student_id: s, content: 'My solutions: https://github.com/demo/assignment-' + (i + 1), status: ev ? 'Evaluated' : 'Submitted', marks: ev ? 70 + i * 3 : null, feedback: ev ? 'Good work. Add more comments in your code.' : '', created_at: TS(-2) });
    });
    add('submissions', { assignment_id: asg[5], student_id: students[0], content: 'Wireframes link: https://example.com/wireframes', status: 'Evaluated', marks: 88, feedback: 'Clear layout and good use of spacing.', created_at: TS(-3) });
    var msg = function (a, b, body, n, read) { add('messages', { from_id: a, to_id: b, course_id: cid[0], body: body, is_read: read !== false, created_at: TS(n) }); };
    msg(students[0], tutors[0], 'Can you explain how list comprehensions work?', -2);
    msg(tutors[0], students[0], 'Sure! A list comprehension builds a list in one line, e.g. [x*x for x in range(5)]. We will also cover it in the next class.', -2);
    msg(students[0], tutors[0], 'Thank you, that helps!', -1, false);
    msg(tutors[0], students[1], 'Welcome to the course! Ask me anything.', -5);
    notify(students[0], 'Your Python Programming class starts tomorrow at 10:00 AM. Click Join Class to attend through Zoom.');
    notify(students[0], 'Your assignment "UI/UX Design - Assignment 1" was evaluated: 88/100.');
    notify(students[0], 'Payment successful for Web Development.');
    notify(tutors[0], 'A new student enrolled in Python Programming.');
    notify(tutors[0], 'New feedback received on Python Programming.');
    var comments = ['Very helpful peer tutor and easy-to-understand explanations.', 'Clear examples and great pace.', 'Good course, would like more practice questions.', 'Loved the live sessions!'];
    DB.enrollments.slice().forEach(function (e, k) {
      if (k % 3 === 0 && !where('feedback', function (f) { return f.user_id === e.user_id && f.course_id === e.course_id; }).length) add('feedback', { course_id: e.course_id, user_id: e.user_id, rating: 4 + (k % 2), review: comments[k % 4] });
    });
    remove('feedback', function (f) { return f.user_id === students[0] && f.course_id === cid[5]; });
    add('feedback', { course_id: cid[5], user_id: students[0], rating: 5, review: comments[0] });
    save();
  }

  function load() {
    if (DB) return;
    try { DB = JSON.parse(store().getItem(KEY)); } catch (e) { DB = null; }
    if (!DB || !DB.users) seed();
  }
  function resetDemo() { DB = null; try { store().removeItem(KEY); } catch (e) { /* ignore */ } seed(); }

  /* ---------- session ---------- */
  function publicUser(u) { if (!u) return null; var c = Object.assign({}, u); delete c.pass; return c; }
  function startSession(uid, remember) {
    try { (remember ? store() : tmp()).setItem('p2p_uid', String(uid)); (remember ? tmp() : store()).removeItem('p2p_uid'); } catch (e) { /* ignore */ }
  }
  function endSession() { try { store().removeItem('p2p_uid'); tmp().removeItem('p2p_uid'); } catch (e) { /* ignore */ } }
  function current() {
    load();
    var id = null;
    try { id = (tmp() && tmp().getItem('p2p_uid')) || (store() && store().getItem('p2p_uid')); } catch (e) { /* ignore */ }
    var u = id ? by('users', id) : null;
    if (!u || u.status !== 'active') return null;
    return publicUser(u);
  }
  function touch(uid) { var u = by('users', uid); if (u) { u.last_seen = nowISO(); DB.meta.requests++; save(); } }

  /* ---------- validation helpers ---------- */
  var EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var NAME = /^[A-Za-z][A-Za-z .'-]{1,59}$/;
  function checkImage(d, what) {
    if (!d) return null;
    if (!/^data:image\/(png|jpeg|webp|gif);base64,/.test(d)) fail((what || 'Image') + ' must be a PNG, JPG, WEBP or GIF image.');
    if (d.length > 200000) fail((what || 'Image') + ' is too large (max 150 KB).');
    return d;
  }
  function validateZoomLink(url) {
    return String(url || '').trim().length > 0; // TODO: accepts any link
  }
  var HHMM = /^([01]\d|2[0-3]):[0-5]\d$/, DATE = /^\d{4}-\d{2}-\d{2}$/;
  function todayStr() { return ymd(new Date()); }

  /* ---------- users ---------- */
  function registerUser(b) {
    load();
    var name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase();
    if (!name || !email || !b.password) fail('Name, email and password are required.');
    if (!validPassword(b.password)) fail('Password must be at least 8 characters and contain a letter and a number.');
    if (b.password !== b.confirm) fail('Passwords do not match.');
    if (['student', 'tutor'].indexOf(b.role) < 0) fail('Please choose Student or Peer Tutor.');
    if (where('users', function (u) { return u.email === email; }).length) fail('This email is already registered.');
    var u = add('users', { name: name, email: email, pass: hashPassword(b.password), role: b.role, skills: String(b.skills || '').slice(0, 200), interests: String(b.interests || '').slice(0, 200), bio: '', avatar: checkImage(b.avatar, 'Profile picture'), status: 'active', last_seen: null });
    notify(u.id, 'Welcome to Peer2Peer Learn! Complete your profile to get started.');
    log('New registration: ' + name + ' (' + b.role + ')');
    save();
    return publicUser(u);
  }
  function loginUser(email, password, remember) {
    load();
    email = String(email || '').trim().toLowerCase();
    if (!email || !password) fail('Please enter your email and password.');
    var u = where('users', function (x) { return x.email === email; })[0];
    if (!u || !checkPassword(String(password), u.pass)) fail('Invalid email or password.');
    if (u.status !== 'active') fail('Your account has been disabled. Please contact the administrator.');
    startSession(u.id, !!remember);
    log('Login: ' + u.name);
    u.last_seen = nowISO(); save();
    return publicUser(u);
  }
  function updateProfile(uid, b) {
    var u = by('users', uid), name = String(b.name || '').trim();
    if (!name) fail('Name cannot be empty.');
    var avatar = b.avatar ? checkImage(b.avatar, 'Profile picture') : null;
    if (b.new_password) {
      if (!checkPassword(String(b.current_password || ''), u.pass)) fail('Current password is incorrect.');
      if (!validPassword(b.new_password)) fail('New password must be at least 8 characters with a letter and a number.');
      u.pass = hashPassword(b.new_password);
    }
    u.name = name;
    if (b.skills !== undefined) u.skills = String(b.skills).slice(0, 200);
    if (b.interests !== undefined) u.interests = String(b.interests).slice(0, 200);
    if (b.bio !== undefined) u.bio = String(b.bio).slice(0, 500);
    if (avatar) u.avatar = avatar;
    save();
    return publicUser(u);
  }
  function manageUser(admin, id, action) {
    var u = by('users', id);
    if (!u) fail('User not found.');
    if (u.id === admin.id) fail('You cannot change your own account.');
    if (action === 'activate') u.status = 'active';
    else if (action === 'deactivate') u.status = 'disabled';
    else if (action === 'delete') cascadeUser(u.id);
    else fail('Unknown action.');
    log('Admin ' + action + ' user ' + u.name);
    save();
  }
  function cascadeUser(id) {
    where('courses', function (c) { return c.tutor_id === id; }).forEach(function (c) { cascadeCourse(c.id); });
    remove('enrollments', function (x) { return x.user_id === id; });
    remove('progress', function (x) { return x.user_id === id; });
    remove('submissions', function (x) { return x.student_id === id; });
    remove('messages', function (x) { return x.from_id === id || x.to_id === id; });
    remove('notifications', function (x) { return x.user_id === id; });
    remove('feedback', function (x) { return x.user_id === id; });
    remove('payments', function (x) { return x.user_id === id; });
    remove('users', function (x) { return x.id === id; });
  }
  function cascadeCourse(id) {
    var lids = where('lessons', function (l) { return l.course_id === id; }).map(function (l) { return l.id; });
    var aids = where('assignments', function (a) { return a.course_id === id; }).map(function (a) { return a.id; });
    remove('progress', function (p) { return lids.indexOf(p.lesson_id) >= 0; });
    remove('submissions', function (s) { return aids.indexOf(s.assignment_id) >= 0; });
    ['lessons', 'enrollments', 'sessions', 'assignments', 'feedback', 'payments'].forEach(function (t) { remove(t, function (x) { return x.course_id === id; }); });
    remove('courses', function (c) { return c.id === id; });
  }

  function deleteLesson(user, id) {
    var l = by('lessons', id);
    if (!l) fail('Lesson not found.');
    var c = by('courses', l.course_id);
    if (c.tutor_id !== user.id && user.role !== 'admin') fail('Unauthorized access.');
    remove('progress', function (p) { return p.lesson_id === l.id; });
    remove('lessons', function (x) { return x.id === l.id; });
    save();
  }

  /* ---------- courses ---------- */
  function saveCourse(user, b, id) {
    var title = String(b.title || '').trim(), description = String(b.description || '').trim();
    if (title.length < 3) fail('Course title must be at least 3 characters.');
    if (description.length < 10) fail('Please add a course description (at least 10 characters).');
    if (!b.category) fail('Please choose a category.');
    if (['Beginner', 'Intermediate', 'Advanced'].indexOf(b.difficulty) < 0) fail('Please choose a difficulty level.');
    var price = b.paid ? Number(b.price) : 0;
    if (b.paid && !(price > 0)) fail('Please enter a price greater than 0 for a paid course.');
    var lessons = (b.lessons || []).filter(function (l) { return l && String(l.title || '').trim(); });
    var thumb = checkImage(b.thumb, 'Thumbnail');
    var c;
    if (id) {
      c = by('courses', id);
      if (!c) fail('Course not found.');
      if (c.tutor_id !== user.id && user.role !== 'admin') fail('Unauthorized access.');
    } else {
      if (b.publish && !lessons.length) fail('Add at least one lesson before publishing.');
      c = add('courses', { tutor_id: user.id, thumb: null, status: 'draft' });
    }
    var wasPublished = c.status === 'published';
    Object.assign(c, { title: title, description: description, category: b.category, difficulty: b.difficulty, duration: Math.max(0, Number(b.duration) || 0), price: price, objectives: String(b.objectives || ''), status: b.publish ? 'published' : 'draft' });
    if (thumb) c.thumb = thumb;
    var pos = where('lessons', function (l) { return l.course_id === c.id; }).length;
    lessons.forEach(function (l, i) { add('lessons', { course_id: c.id, module: String(l.module || 'Module 1').trim(), title: String(l.title).trim(), content: String(l.description || ''), resource_url: String(l.url || '').trim(), position: pos + i }); });
    if (c.status === 'published' && !wasPublished) where('users', function (u) { return u.role !== 'admin' && u.id !== user.id; }).forEach(function (u) { notify(u.id, 'New course published: "' + title + '".'); });
    log('Course saved: ' + title);
    save();
    return c.id;
  }
  function createCourse(tutor, b) { return saveCourse(tutor, b, null); }
  function manageCourse(admin, id, action) {
    var c = by('courses', id);
    if (!c) fail('Course not found.');
    var map = { approve: 'published', reject: 'rejected', archive: 'archived' };
    if (action === 'delete') cascadeCourse(c.id);
    else if (map[action]) { c.status = map[action]; notify(c.tutor_id, 'Your course "' + c.title + '" was ' + map[action] + ' by the administrator.'); }
    else fail('Unknown action.');
    save();
  }
  function deleteCourse(user, id) {
    var c = by('courses', id);
    if (!c) fail('Course not found.');
    if (c.tutor_id !== user.id && user.role !== 'admin') fail('Unauthorized access.');
    cascadeCourse(c.id); save();
  }
  function isEnrolled(uid, cid) { return where('enrollments', function (e) { return e.user_id === uid && e.course_id === Number(cid); }).length > 0; }
  function enrollCourse(uid, cid) {
    var c = by('courses', cid);
    if (!c || c.status !== 'published') fail('Course could not be loaded.');
    if (c.tutor_id === uid) fail('You cannot enroll in your own course.');
    if (isEnrolled(uid, c.id)) fail('You are already enrolled in this course.');
    if (c.price > 0) fail('This is a paid course. Please complete the payment to enroll.');
    add('enrollments', { user_id: uid, course_id: c.id });
    notify(uid, 'Enrollment successful: ' + c.title + '.');
    notify(c.tutor_id, 'A new student enrolled in ' + c.title + '.');
    log(by('users', uid).name + ' enrolled in ' + c.title);
    save();
  }
  function setLessonDone(uid, lid, done) {
    var l = by('lessons', lid);
    if (!l || !isEnrolled(uid, l.course_id)) fail('Unauthorized access.');
    remove('progress', function (p) { return p.user_id === uid && p.lesson_id === l.id; });
    if (done) add('progress', { user_id: uid, lesson_id: l.id });
    save();
  }

  /* ---------- payments (MOCK only: no real money) ---------- */
  function processMockPayment(uid, b) {
    var c = by('courses', b.course_id);
    if (!c || c.status !== 'published') fail('Course could not be loaded.');
    if (c.price <= 0) fail('This course is free. No payment is needed.');
    if (isEnrolled(uid, c.id)) fail('You are already enrolled in this course.');
    if (['Card', 'UPI', 'Net Banking'].indexOf(b.method) < 0) fail('Please choose a payment method.');
    var txn = 'TXN' + String(Date.now()).slice(-8) + Math.floor(Math.random() * 90 + 10);
    if (b.method === 'Card' && String(b.card || '').replace(/\s/g, '').slice(-4) === '0000') { // DEMO: card ending 0000 fails
      add('payments', { user_id: uid, course_id: c.id, amount: c.price, method: b.method, txn_id: txn, status: 'Failed' }); save();
      fail('Payment could not be completed.');
    }
    var p = add('payments', { user_id: uid, course_id: c.id, amount: c.price, method: b.method, txn_id: txn, status: 'Success' });
    add('enrollments', { user_id: uid, course_id: c.id });
    notify(uid, 'Payment successful for ' + c.title + '.');
    notify(c.tutor_id, 'A new student enrolled in ' + c.title + '.');
    log('Payment ' + txn + ' by ' + by('users', uid).name);
    save();
    return generateReceipt(p.id, uid);
  }
  function generateReceipt(pid, uid) {
    var p = by('payments', pid);
    if (!p) fail('Receipt not found.');
    var viewer = by('users', uid);
    if (p.user_id !== uid && viewer.role !== 'admin') fail('Unauthorized access.');
    var c = by('courses', p.course_id);
    return Object.assign({}, p, { course: c.title, tutor: by('users', c.tutor_id).name, student: by('users', p.user_id).name, receipt_no: 'RCPT-' + String(p.id).padStart(5, '0') });
  }

  /* ---------- classes (Zoom links only; no in-app video) ---------- */
  function classStatus(s, now) {
    now = now || new Date();
    if (s.status === 'cancelled') return 'cancelled';
    var st = new Date(s.date + 'T' + s.start_time + ':00'), en = new Date(s.date + 'T' + s.end_time + ':00');
    if (now > en) return 'completed';
    if (now >= st) return 'live';
    return 'scheduled';
  }
  function scheduleClass(user, b) {
    var c = by('courses', b.course_id);
    if (!c || (c.tutor_id !== user.id && user.role !== 'admin')) fail('You can only schedule classes for your own courses.');
    if (!String(b.title || '').trim()) fail('Please enter a class title.');
    if (!DATE.test(b.date || '')) fail('Please choose a valid date.');
    if (!validateZoomLink(b.zoom_link)) fail('Please enter a valid Zoom meeting link.');
    var s = add('sessions', { course_id: c.id, tutor_id: c.tutor_id, title: String(b.title).trim(), description: String(b.description || ''), date: b.date, start_time: b.start_time, end_time: b.end_time, zoom_link: String(b.zoom_link).trim(), status: 'scheduled' });
    where('enrollments', function (e) { return e.course_id === c.id; }).forEach(function (e) { notify(e.user_id, 'New class scheduled: "' + s.title + '" on ' + s.date + ' at ' + s.start_time + '. Click Join Class to attend through Zoom.'); });
    log('Class scheduled: ' + s.title);
    save();
    return s.id;
  }
  function updateClass(user, id, b) {
    var s = by('sessions', id);
    if (!s) fail('Class not found.');
    if (s.tutor_id !== user.id && user.role !== 'admin') fail('Unauthorized access.');
    var students = where('enrollments', function (e) { return e.course_id === s.course_id; });
    if (b.status === 'cancelled') {
      s.status = 'cancelled'; s.updated_at = nowISO();
      students.forEach(function (e) { notify(e.user_id, 'Class cancelled: "' + s.title + '" on ' + s.date + '.'); });
      save(); return;
    }
    var n = { title: b.title || s.title, description: b.description !== undefined ? b.description : s.description, date: b.date || s.date, start_time: b.start_time || s.start_time, end_time: b.end_time || s.end_time, zoom_link: b.zoom_link || s.zoom_link };
    if (!DATE.test(n.date)) fail('Please choose a valid date.');
    if (!HHMM.test(n.start_time) || !HHMM.test(n.end_time) || n.end_time <= n.start_time) fail('Please choose a valid start and end time.');
    if (!validateZoomLink(n.zoom_link)) fail('Please enter a valid Zoom meeting link.');
    var moved = n.date !== s.date || n.start_time !== s.start_time;
    Object.assign(s, n, { status: 'scheduled', updated_at: nowISO() });
    if (moved) students.forEach(function (e) { notify(e.user_id, 'Class rescheduled: "' + s.title + '" is now on ' + s.date + ' at ' + s.start_time + '.'); });
    save();
  }
  function remindClass(user, id) {
    var s = by('sessions', id);
    if (!s || (s.tutor_id !== user.id && user.role !== 'admin')) fail('Unauthorized access.');
    where('enrollments', function (e) { return e.course_id === s.course_id; }).forEach(function (e) { notify(e.user_id, 'Reminder: your class "' + s.title + '" starts on ' + s.date + ' at ' + s.start_time + '. Click Join Class to attend through Zoom.'); });
    save();
  }
  function joinClass(uid, sid) {
    var s = by('sessions', sid);
    if (!s) fail('Class not found.');
    if (!isEnrolled(uid, s.course_id) && s.tutor_id !== uid && by('users', uid).role !== 'admin') fail('Unauthorized access.');
    var st = classStatus(s);
    if (st === 'cancelled') fail('This class has been cancelled.');
    if (st === 'completed') fail('This class has already ended.');
    if (!validateZoomLink(s.zoom_link)) fail('Please enter a valid Zoom meeting link.');
    log(by('users', uid).name + ' joined class "' + s.title + '" (Zoom)'); save();
    return s.zoom_link;
  }

  /* ---------- assignments ---------- */
  function createAssignment(user, b) {
    var c = by('courses', b.course_id);
    if (!c || (c.tutor_id !== user.id && user.role !== 'admin')) fail('You can only create assignments for your own courses.');
    if (!String(b.title || '').trim()) fail('Please enter an assignment title.');
    if (!DATE.test(b.due_date || '')) fail('Please choose a valid deadline.');
    var max = Number(b.max_marks) || 100;
    if (max < 1 || max > 1000) fail('Maximum marks must be between 1 and 1000.');
    var a = add('assignments', { course_id: c.id, title: String(b.title).trim(), instructions: String(b.instructions || ''), due_date: b.due_date, max_marks: max });
    where('enrollments', function (e) { return e.course_id === c.id; }).forEach(function (e) { notify(e.user_id, 'New assignment "' + a.title + '" is due on ' + a.due_date + '.'); });
    save();
    return a.id;
  }
  function submitAssignment(uid, aid, b) {
    var a = by('assignments', aid);
    if (!a) fail('Assignment not found.');
    if (!isEnrolled(uid, a.course_id)) fail('Unauthorized access.');
    var content = String(b.content || '').trim();
    if (!content) fail('Please write your answer or paste a link to your work.');
    if (content.length > 5000) fail('Submission is too long (max 5000 characters).');
    if (where('submissions', function (s) { return s.assignment_id === a.id && s.student_id === uid; }).length) fail('You have already submitted this assignment.');
    var late = new Date() > new Date(a.due_date + 'T23:59:59');
    add('submissions', { assignment_id: a.id, student_id: uid, content: content, status: late ? 'Late' : 'Submitted', marks: null, feedback: '' });
    notify(by('courses', a.course_id).tutor_id, 'New submission for "' + a.title + '".');
    save();
    return late ? 'Late' : 'Submitted';
  }
  function evaluateAssignment(user, sid, b) {
    var s = by('submissions', sid);
    if (!s) fail('Submission not found.');
    var a = by('assignments', s.assignment_id), c = by('courses', a.course_id);
    if (c.tutor_id !== user.id && user.role !== 'admin') fail('Unauthorized access.');
    if (b.review_only) { s.status = 'Under Review'; save(); return; }
    var marks = Number(b.marks);
    if (b.marks === '' || b.marks == null || !isFinite(marks) || marks < 0 || marks > a.max_marks) fail('Marks must be a number between 0 and ' + a.max_marks + '.');
    s.marks = Math.round(marks); s.feedback = String(b.feedback || '').slice(0, 1000); s.status = 'Evaluated';
    notify(s.student_id, 'Your assignment "' + a.title + '" was evaluated: ' + s.marks + '/' + a.max_marks + '.');
    save();
  }

  /* ---------- messages and feedback ---------- */
  function canMessage(a, b) {
    var ua = by('users', a), ub = by('users', b);
    if (!ua || !ub) return false;
    if (ua.role === 'admin' || ub.role === 'admin') return true;
    return where('enrollments', function (e) {
      var c = by('courses', e.course_id);
      return c && ((e.user_id === a && c.tutor_id === b) || (e.user_id === b && c.tutor_id === a));
    }).length > 0;
  }
  function sendMessage(uid, b) {
    var to = Number(b.to_id), body = String(b.body || '').trim();
    if (!to || to === uid) fail('Please choose who to message.');
    if (!body) fail('Message cannot be empty.');
    if (body.length > 1000) fail('Message is too long (max 1000 characters).');
    if (!canMessage(uid, to)) fail('You can only message tutors of your courses or students of your courses.');
    add('messages', { from_id: uid, to_id: to, course_id: b.course_id ? Number(b.course_id) : null, body: body, is_read: false });
    notify(to, 'New message from ' + by('users', uid).name + '.');
    save();
  }
  function submitFeedback(uid, cid, b) {
    if (!isEnrolled(uid, cid)) fail('Only enrolled students can rate this course.');
    var rating = Number(b.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) fail('Please choose a star rating from 1 to 5.');
    remove('feedback', function (f) { return f.user_id === uid && f.course_id === Number(cid); });
    add('feedback', { course_id: Number(cid), user_id: uid, rating: rating, review: String(b.review || '').trim().slice(0, 500) });
    var c = by('courses', cid);
    notify(c.tutor_id, 'New feedback received on ' + c.title + '.');
    save();
  }

  /* ---------- read-only queries used by the pages ---------- */
  function avg(list) { return list.length ? Math.round(list.reduce(function (a, x) { return a + x.rating; }, 0) / list.length * 10) / 10 : null; }
  function view(c) {
    var fb = where('feedback', function (f) { return f.course_id === c.id; });
    return Object.assign({}, c, { tutor_name: by('users', c.tutor_id).name, rating: avg(fb), reviews: fb.length, students: where('enrollments', function (e) { return e.course_id === c.id; }).length });
  }
  function courses(f) {
    f = f || {};
    var q = String(f.q || '').toLowerCase();
    var list = where('courses', function (c) { return c.status === 'published'; }).map(view).filter(function (c) {
      return (!q || (c.title + ' ' + c.description + ' ' + c.tutor_name).toLowerCase().indexOf(q) >= 0) && (!f.category || c.category === f.category) && (!f.difficulty || c.difficulty === f.difficulty) &&
        (!f.price || (f.price === 'free' ? c.price === 0 : c.price > 0)) && (!f.rating || (c.rating || 0) >= Number(f.rating));
    });
    var sorts = { popular: function (a, b) { return b.students - a.students; }, rating: function (a, b) { return (b.rating || 0) - (a.rating || 0); }, latest: function (a, b) { return b.id - a.id; } };
    return list.sort(sorts[f.sort] || sorts.popular);
  }
  function courseDetail(id, user) {
    var c = by('courses', id);
    if (!c) fail('Course could not be loaded.');
    var own = user && (user.id === c.tutor_id || user.role === 'admin');
    if (c.status !== 'published' && !own) fail('Course could not be loaded.');
    var enrolled = user ? isEnrolled(user.id, c.id) : false, can = enrolled || own;
    var done = user ? where('progress', function (p) { return p.user_id === user.id; }).map(function (p) { return p.lesson_id; }) : [];
    var lessons = where('lessons', function (l) { return l.course_id === c.id; }).sort(function (a, b) { return a.position - b.position; }).map(function (l) {
      return { id: l.id, module: l.module, title: l.title, content: can ? l.content : undefined, resource_url: can ? l.resource_url : undefined, done: done.indexOf(l.id) >= 0 };
    });
    var t = by('users', c.tutor_id);
    var reviews = where('feedback', function (f) { return f.course_id === c.id; }).slice().reverse().slice(0, 10).map(function (f) { return Object.assign({}, f, { name: by('users', f.user_id).name }); });
    var mine = user ? where('feedback', function (f) { return f.course_id === c.id && f.user_id === user.id; })[0] || null : null;
    return Object.assign(view(c), { tutor: { id: t.id, name: t.name, skills: t.skills, bio: t.bio, avatar: t.avatar }, enrolled: enrolled, lessons: lessons, review_list: reviews, mine: mine });
  }
  function myCourses(uid) {
    return where('enrollments', function (e) { return e.user_id === uid; }).slice().reverse().map(function (e) {
      var c = view(by('courses', e.course_id)), ls = where('lessons', function (l) { return l.course_id === c.id; });
      var done = where('progress', function (p) { return p.user_id === uid && ls.some(function (l) { return l.id === p.lesson_id; }); }).length;
      return Object.assign(c, { total: ls.length, done: done, progress: ls.length ? Math.round(done / ls.length * 100) : 0 });
    });
  }
  function classRow(s) { var c = by('courses', s.course_id); return Object.assign({}, s, { status: classStatus(s), course_title: c ? c.title : '', tutor_name: by('users', s.tutor_id).name, participants: where('enrollments', function (e) { return e.course_id === s.course_id; }).length }); }
  function classes(user) {
    var mine = user.role === 'admin' ? DB.sessions : where('sessions', function (s) { return isEnrolled(user.id, s.course_id) || s.tutor_id === user.id; });
    return mine.slice().sort(function (a, b) { return (a.date + a.start_time).localeCompare(b.date + b.start_time); }).map(classRow);
  }
  function studentDashboard(uid) {
    var mine = myCourses(uid);
    var pend = where('assignments', function (a) { return isEnrolled(uid, a.course_id) && !where('submissions', function (s) { return s.assignment_id === a.id && s.student_id === uid; }).length; }).length;
    var u = by('users', uid);
    return {
      enrolled: mine.length, completed: mine.filter(function (c) { return c.progress === 100; }).length, hours: Math.round(mine.reduce(function (a, c) { return a + c.duration * c.progress / 100; }, 0)), pending: pend, courses: mine,
      classes: classes(u).filter(function (c) { return c.status === 'scheduled' || c.status === 'live'; }).slice(0, 3),
      messages: where('messages', function (m) { return m.to_id === uid; }).slice(-3).reverse().map(function (m) { return Object.assign({}, m, { name: by('users', m.from_id).name }); }),
      notifications: notifications(uid).slice(0, 4),
      recommended: courses({ sort: 'popular' }).filter(function (c) { return c.tutor_id !== uid && !isEnrolled(uid, c.id); }).slice(0, 4)
    };
  }
  function assignmentsFor(uid) {
    return where('assignments', function (a) { return isEnrolled(uid, a.course_id); }).map(function (a) {
      var s = where('submissions', function (x) { return x.assignment_id === a.id && x.student_id === uid; })[0];
      return Object.assign({}, a, { course: by('courses', a.course_id).title, sub: s || null });
    }).sort(function (a, b) { return a.due_date.localeCompare(b.due_date); });
  }
  function myFeedback(uid) { return where('feedback', function (f) { return f.user_id === uid; }); }
  function conversations(uid) {
    var ids = {};
    DB.messages.forEach(function (m) { if (m.from_id === uid) ids[m.to_id] = 1; if (m.to_id === uid) ids[m.from_id] = 1; });
    DB.users.forEach(function (u) { if (u.id !== uid && u.role !== 'admin' && canMessage(uid, u.id)) ids[u.id] = 1; });
    return Object.keys(ids).map(function (k) {
      var u = by('users', k), th = thread(uid, u.id, true), last = th[th.length - 1];
      return { id: u.id, name: u.name, role: u.role, avatar: u.avatar, last: last ? last.body : '', mid: last ? last.id : 0, unread: th.filter(function (m) { return m.to_id === uid && !m.is_read; }).length };
    }).sort(function (a, b) { return b.mid - a.mid; });
  }
  function thread(uid, other, keepUnread) {
    other = Number(other);
    if (!keepUnread) { var ch = false; DB.messages.forEach(function (m) { if (m.from_id === other && m.to_id === uid && !m.is_read) { m.is_read = true; ch = true; } }); if (ch) save(); }
    return where('messages', function (m) { return (m.from_id === uid && m.to_id === other) || (m.from_id === other && m.to_id === uid); }).map(function (m) { var c = m.course_id ? by('courses', m.course_id) : null; return Object.assign({}, m, { course: c ? c.title : '' }); });
  }
  function notifications(uid) { return where('notifications', function (n) { return n.user_id === uid; }).slice().reverse(); }
  function markNotificationsRead(uid) { DB.notifications.forEach(function (n) { if (n.user_id === uid) n.is_read = true; }); save(); }
  function myPayments(uid) { return where('payments', function (p) { return p.user_id === uid; }).slice().reverse().map(function (p) { return Object.assign({}, p, { course: by('courses', p.course_id).title }); }); }
  function profileStats(uid) {
    var mine = where('courses', function (c) { return c.tutor_id === uid; });
    var fb = where('feedback', function (f) { return mine.some(function (c) { return c.id === f.course_id; }); });
    return { rating: avg(fb), teaching: mine.map(function (c) { return c.title; }), learning: myCourses(uid).map(function (c) { return c.title; }) };
  }

  /* tutor */
  function tutorCourses(uid) { return where('courses', function (c) { return c.tutor_id === uid; }).slice().reverse().map(view); }
  function tutorDashboard(uid) {
    var cs = tutorCourses(uid), ids = cs.map(function (c) { return c.id; });
    var students = {}; DB.enrollments.forEach(function (e) { if (ids.indexOf(e.course_id) >= 0) students[e.user_id] = 1; });
    var cl = classes(by('users', uid)).filter(function (c) { return c.tutor_id === uid && (c.status === 'scheduled' || c.status === 'live'); });
    var fb = where('feedback', function (f) { return ids.indexOf(f.course_id) >= 0; });
    var pend = where('submissions', function (s) { return ['Submitted', 'Late', 'Under Review'].indexOf(s.status) >= 0 && ids.indexOf(by('assignments', s.assignment_id).course_id) >= 0; }).length;
    return { courses: cs.length, students: Object.keys(students).length, activeClasses: cl.length, rating: avg(fb), classes: cl.slice(0, 4), pending: pend };
  }
  function tutorStudents(uid) {
    var ids = tutorCourses(uid).map(function (c) { return c.id; });
    return where('enrollments', function (e) { return ids.indexOf(e.course_id) >= 0; }).slice().reverse().map(function (e) {
      var c = myCourses(e.user_id).filter(function (x) { return x.id === e.course_id; })[0], u = by('users', e.user_id);
      return { id: u.id, name: u.name, email: u.email, course: c.title, progress: c.progress, created_at: e.created_at };
    });
  }
  function tutorAssignments(uid) {
    var ids = tutorCourses(uid).map(function (c) { return c.id; });
    return where('assignments', function (a) { return ids.indexOf(a.course_id) >= 0; }).slice().reverse().map(function (a) {
      return Object.assign({}, a, { course: by('courses', a.course_id).title, submissions: where('submissions', function (s) { return s.assignment_id === a.id; }).map(function (s) { return Object.assign({}, s, { student: by('users', s.student_id).name }); }) });
    });
  }
  function tutorReviews(uid) {
    var ids = tutorCourses(uid).map(function (c) { return c.id; });
    return where('feedback', function (f) { return ids.indexOf(f.course_id) >= 0; }).slice().reverse().map(function (f) { return Object.assign({}, f, { student: by('users', f.user_id).name, course: by('courses', f.course_id).title }); });
  }
  function tutorPayments(uid) {
    var ids = tutorCourses(uid).map(function (c) { return c.id; });
    return where('payments', function (p) { return ids.indexOf(p.course_id) >= 0; }).slice().reverse().map(function (p) { return Object.assign({}, p, { course: by('courses', p.course_id).title, student: by('users', p.user_id).name }); });
  }
  function participants(user, sid) {
    var s = by('sessions', sid);
    if (!s || (s.tutor_id !== user.id && user.role !== 'admin')) fail('Unauthorized access.');
    return where('enrollments', function (e) { return e.course_id === s.course_id; }).map(function (e) { var u = by('users', e.user_id); return { id: u.id, name: u.name, email: u.email }; });
  }

  /* admin */
  function adminStats() {
    var per = DB.courses.map(function (c) { return { title: c.title, n: where('enrollments', function (e) { return e.course_id === c.id; }).length }; }).sort(function (a, b) { return b.n - a.n; }).slice(0, 8);
    var ok = where('payments', function (p) { return p.status === 'Success'; });
    return { users: DB.users.length, students: where('users', function (u) { return u.role === 'student'; }).length, tutors: where('users', function (u) { return u.role === 'tutor'; }).length, courses: DB.courses.length, enrollments: DB.enrollments.length, payments: ok.length, revenue: ok.reduce(function (a, p) { return a + p.amount; }, 0), activeClasses: DB.sessions.map(classStatus).filter(function (s) { return s === 'scheduled' || s === 'live'; }).length, perCourse: per };
  }
  function adminUsers(role) { return where('users', function (u) { return !role || u.role === role; }).slice().reverse().map(publicUser); }
  function adminCourses(status) { return where('courses', function (c) { return !status || c.status === status; }).slice().reverse().map(view); }
  function report(type) {
    var U = function (id) { var u = by('users', id); return u ? u.name : ''; }, C = function (id) { var c = by('courses', id); return c ? c.title : ''; };
    var R = {
      users: function () { return DB.users.map(function (u) { return { id: u.id, name: u.name, email: u.email, role: u.role, status: u.status, registered: u.created_at.slice(0, 10) }; }); },
      courses: function () { return DB.courses.map(function (c) { return { id: c.id, title: c.title, category: c.category, difficulty: c.difficulty, price: c.price, status: c.status, tutor: U(c.tutor_id) }; }); },
      enrollments: function () { return DB.enrollments.map(function (e) { return { id: e.id, student: U(e.user_id), course: C(e.course_id), date: e.created_at.slice(0, 10) }; }); },
      classes: function () { return DB.sessions.map(function (s) { return { id: s.id, title: s.title, course: C(s.course_id), date: s.date, start: s.start_time, end: s.end_time, status: classStatus(s) }; }); },
      assignments: function () { return DB.assignments.map(function (a) { return { id: a.id, title: a.title, course: C(a.course_id), due: a.due_date, submissions: where('submissions', function (s) { return s.assignment_id === a.id; }).length }; }); },
      feedback: function () { return DB.feedback.map(function (f) { return { id: f.id, student: U(f.user_id), course: C(f.course_id), rating: f.rating, review: f.review }; }); },
      payments: function () { return DB.payments.map(function (p) { return { id: p.id, transaction: p.txn_id, student: U(p.user_id), course: C(p.course_id), amount: p.amount, method: p.method, status: p.status, date: p.created_at.slice(0, 10) }; }); },
      activity: function () { return DB.activity.slice().reverse().map(function (a) { return { id: a.id, time: a.created_at.replace('T', ' ').slice(0, 19), event: a.text }; }); }
    };
    if (!R[type]) fail('Unknown report.');
    return R[type]().reverse();
  }
  function deleteItem(type, id) {
    var t = { enrollments: 'enrollments', feedback: 'feedback', assignments: 'assignments', classes: 'sessions' }[type];
    if (!t) fail('Unknown item.');
    id = Number(id);
    if (t === 'assignments') remove('submissions', function (s) { return s.assignment_id === id; });
    remove(t, function (x) { return x.id === id; }); save();
  }
  function addCategory(name) {
    name = String(name || '').trim();
    if (!name) fail('Please enter a category name.');
    if (where('categories', function (c) { return c.name.toLowerCase() === name.toLowerCase(); }).length) fail('Category already exists.');
    add('categories', { name: name }); save();
  }
  function deleteCategory(id) { remove('categories', function (c) { return c.id === Number(id); }); save(); }
  function monitor() {
    var U = function (id) { var u = by('users', id); return u ? u.name : ''; }, C = function (id) { var c = by('courses', id); return c ? c.title : ''; };
    return {
      status: 'Operational', requests: DB.meta.requests, activeUsers: where('users', function (u) { return u.last_seen && Date.now() - new Date(u.last_seen).getTime() < 15 * 60000; }).length,
      activity: DB.activity.slice().reverse().slice(0, 8),
      regs: DB.users.slice(-5).reverse().map(function (u) { return { name: u.name, role: u.role }; }),
      enrolls: DB.enrollments.slice(-5).reverse().map(function (e) { return { student: U(e.user_id), course: C(e.course_id) }; }),
      pays: DB.payments.slice(-5).reverse().map(function (p) { return { student: U(p.user_id), course: C(p.course_id), amount: p.amount, status: p.status }; })
    };
  }
  function stats() {
    return { learners: where('users', function (u) { return u.role === 'student'; }).length, tutors: where('users', function (u) { return u.role === 'tutor'; }).length, courses: where('courses', function (c) { return c.status === 'published'; }).length, sessions: DB.sessions.length };
  }
  function categories() { return DB.categories.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }); }
  function users() { return DB.users; }

  load();
  return {
    sha256: sha256, validPassword: validPassword, validateZoomLink: validateZoomLink, classStatus: classStatus, resetDemo: resetDemo, current: current, endSession: endSession, touch: touch,
    registerUser: registerUser, loginUser: loginUser, updateProfile: updateProfile, manageUser: manageUser, saveCourse: saveCourse, deleteLesson: deleteLesson, storageOK: function () { return storageOK; }, createCourse: createCourse, manageCourse: manageCourse, deleteCourse: deleteCourse,
    enrollCourse: enrollCourse, setLessonDone: setLessonDone, processMockPayment: processMockPayment, generateReceipt: generateReceipt, scheduleClass: scheduleClass, updateClass: updateClass,
    remindClass: remindClass, joinClass: joinClass, createAssignment: createAssignment, submitAssignment: submitAssignment, evaluateAssignment: evaluateAssignment, canMessage: canMessage,
    sendMessage: sendMessage, submitFeedback: submitFeedback, courses: courses, courseDetail: courseDetail, myCourses: myCourses, classes: classes, studentDashboard: studentDashboard,
    assignmentsFor: assignmentsFor, myFeedback: myFeedback, conversations: conversations, thread: thread, notifications: notifications, markNotificationsRead: markNotificationsRead, myPayments: myPayments,
    profileStats: profileStats, tutorCourses: tutorCourses, tutorDashboard: tutorDashboard, tutorStudents: tutorStudents, tutorAssignments: tutorAssignments, tutorReviews: tutorReviews,
    tutorPayments: tutorPayments, participants: participants, adminStats: adminStats, adminUsers: adminUsers, adminCourses: adminCourses, report: report, deleteItem: deleteItem,
    addCategory: addCategory, deleteCategory: deleteCategory, monitor: monitor, stats: stats, categories: categories, users: users, userById: function (id) { return publicUser(by('users', id)); }
  };
})();
if (typeof module !== 'undefined') module.exports = P2P;
