'use strict';
/* Peer2Peer Learn - single page front end (plain JavaScript, no build step). */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1);
const S = { user: null, token: localStorage.getItem('token') || sessionStorage.getItem('token') || null };
const after = (fn) => setTimeout(fn, 0);
const go = (h) => { if (location.hash === h) render(); else location.hash = h; };

async function api(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (S.token) headers.Authorization = 'Bearer ' + S.token;
  let r;
  try { r = await fetch('/api' + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
  catch { throw new Error('Could not reach the server. Please check that it is running.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) { if (r.status === 401 && S.token) { endSession(); go('#/login'); } throw new Error(d.error || 'Something went wrong. Please try again.'); }
  return d;
}
function toast(msg, type = '') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), 4200);
}
async function act(fn) {   // runs a button action, blocks double clicks, shows errors as toasts
  const b = window.event && window.event.target && window.event.target.closest ? window.event.target.closest('button') : null;
  if (b) { if (b.disabled) return; b.disabled = true; }
  try { await fn(); } catch (e) { toast(e.message, 'err'); } finally { if (b) b.disabled = false; }
}
async function submitForm(e, fn) { e.preventDefault(); const f = e.target; const b = f.querySelector('button[type=submit]'); if (b.disabled) return; b.disabled = true; const old = b.textContent; b.textContent = 'Please wait...';
  try { await fn(Object.fromEntries(new FormData(f)), f); } catch (err) { const a = $('.alert.err', f); if (a) { a.textContent = err.message; a.hidden = false; } toast(err.message, 'err'); } finally { b.disabled = false; b.textContent = old; } }
function modal(html) { $('#modal-root').innerHTML = `<div class="modal-bg" onclick="if(event.target===this)closeModal()"><div class="modal">${html}</div></div>`; }
function closeModal() { $('#modal-root').innerHTML = ''; }
const confirmDo = (msg, fn) => modal(`<h3>Please confirm</h3><p>${esc(msg)}</p><div class="row"><button class="btn red" onclick="closeModal();act(${fn})">Yes, continue</button><button class="btn sec" onclick="closeModal()">Cancel</button></div>`);

/* ---------- formatting + small components ---------- */
const fmtD = (d) => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const fmtDT = (d) => d ? new Date(String(d).replace(' ', 'T') + 'Z').toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
const t12 = (t) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const money = (n) => (n > 0 ? '₹' + n : 'Free');
const stars = (r) => `<span class="stars">${'★'.repeat(Math.round(r || 0))}${'☆'.repeat(5 - Math.round(r || 0))}</span>`;
const BC = { scheduled: '', live: 'b-green', completed: 'b-grey', cancelled: 'b-red', published: 'b-green', draft: 'b-grey', pending: 'b-orange', rejected: 'b-red', archived: 'b-grey', Evaluated: 'b-green', Submitted: '', Late: 'b-red', 'Under Review': 'b-orange', Pending: 'b-orange', Success: 'b-green', Failed: 'b-red', active: 'b-green', disabled: 'b-red' };
const badge = (s) => `<span class="badge ${BC[s] ?? ''}">${esc(cap(s))}</span>`;
const progressBar = (p) => `<div class="progress"><i style="width:${p}%"></i></div>`;
const GRAD = ['#3b5bdb,#7048e8', '#1c7ed6,#15aabf', '#7048e8,#d6336c', '#0f1f4b,#3b5bdb', '#2f9e44,#1c7ed6', '#f08c00,#e8590c'];
const thumb = (c) => c.thumb ? `<div class="thumb"><img src="${esc(c.thumb)}" alt=""><small>${esc(c.category)}</small></div>` :
  `<div class="thumb" style="background:linear-gradient(135deg,${GRAD[[...String(c.category)].reduce((a, x) => a + x.charCodeAt(0), 0) % GRAD.length]})"><span>${esc(c.title[0])}</span><small>${esc(c.category)}</small></div>`;
const avatar = (u, cls = '') => `<div class="avatar ${cls}">${u && u.avatar ? `<img src="${esc(u.avatar)}" alt="">` : esc((u && u.name ? u.name : '?')[0].toUpperCase())}</div>`;
const empty = (msg, label, href) => `<div class="empty"><div class="big">◌</div><p>${esc(msg)}</p>${label ? `<a class="btn" href="${href}">${esc(label)}</a>` : ''}</div>`;
const errorBox = (msg) => `<div class="empty"><div class="big">!</div><p>${esc(msg)}</p><button class="btn sec" onclick="render()">Try again</button></div>`;
const card = (t, b, cls = '') => `<div class="card ${cls}">${t ? `<h3>${t}</h3>` : ''}${b}</div>`;
const statCard = (ico, n, l) => `<div class="card stat"><div class="ico">${ico}</div><div><b>${esc(n)}</b><span>${l}</span></div></div>`;
const title = (t, right = '') => `<div class="page-title"><h2>${t}</h2><div class="row">${right}</div></div>`;
function table(h, rows, emptyMsg = 'No records found.') {
  if (!rows.length) return `<div class="empty">${esc(emptyMsg)}</div>`;
  return `<div class="table-wrap"><table class="rt"><thead><tr>${h.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c, i) => `<td data-label="${esc(h[i])}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function courseCard(c) {
  return `<div class="card course-card">${thumb(c)}<div class="meta"><span class="badge">${esc(c.difficulty)}</span><span class="badge b-purple">${esc(c.duration)}h</span></div>
  <h3><a href="#/course/${c.id}">${esc(c.title)}</a></h3><p class="muted small" style="margin:0">${esc((c.description || '').slice(0, 85))}${c.description && c.description.length > 85 ? '...' : ''}</p>
  <div class="small">by <b>${esc(c.tutor_name)}</b></div><div class="small">${stars(c.rating)} ${c.rating || 'New'} <span class="muted">(${c.reviews || 0}) · ${c.students || 0} students</span></div>
  <div class="foot"><span class="price ${c.price ? '' : 'free'}">${money(c.price)}</span><a class="btn sm" href="#/course/${c.id}">Enroll</a></div></div>`;
}
function classCard(c) {
  const can = c.status === 'scheduled' || c.status === 'live';
  return `<div class="card class-card ${c.status}"><div class="row between"><div><span class="muted small">${esc(c.course_title)}</span><h3 style="margin:2px 0">${esc(c.title)}</h3></div>${badge(c.status)}</div>
  <p class="muted small">Tutor: ${esc(c.tutor_name)}</p><p class="small">📅 ${fmtD(c.date)} &nbsp;·&nbsp; ⏰ ${t12(c.start_time)} – ${t12(c.end_time)}</p>
  ${c.status === 'cancelled' ? '<p class="small" style="color:var(--red)">This class has been cancelled.</p>' : ''}
  <button class="btn green" ${can ? '' : 'disabled'} onclick="joinClass(${c.session_id})">JOIN CLASS</button></div>`;
}
function logo(white) { return `<a class="logo" href="#/"><svg viewBox="0 0 40 40"><line x1="14" y1="20" x2="26" y2="20" stroke="${white ? '#fff' : '#7048e8'}" stroke-width="3"/><circle cx="12" cy="20" r="9" fill="#3b5bdb"/><circle cx="28" cy="20" r="9" fill="#7048e8" fill-opacity=".9"/><circle cx="12" cy="17" r="3" fill="#fff"/><circle cx="28" cy="17" r="3" fill="#fff"/></svg>Peer2Peer Learn</a>`; }

/* ---------- session ---------- */
function setSession(token, user, remember) { S.token = token; S.user = user; (remember ? localStorage : sessionStorage).setItem('token', token); }
function endSession() { S.token = null; S.user = null; localStorage.removeItem('token'); sessionStorage.removeItem('token'); }
function logout() { endSession(); toast('You have been logged out.'); go('#/'); }
const home = (u) => (u.role === 'admin' ? '#/a' : u.role === 'tutor' ? '#/t' : '#/dashboard');
const wish = () => JSON.parse(localStorage.getItem('wish_' + (S.user ? S.user.id : 0)) || '[]');
function readImage(input) {
  return new Promise((res, rej) => {
    const f = input && input.files && input.files[0]; if (!f) return res(undefined);
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return rej(new Error('Please choose a PNG, JPG, WEBP or GIF image.'));
    if (f.size > 300 * 1024) return rej(new Error('Image is too large (max 300 KB).'));
    const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(new Error('Could not read the file.')); r.readAsDataURL(f);
  });
}

/* ---------- layouts ---------- */
function pubShell() {
  return `<header class="pub-head"><div class="container">${logo()}<button class="burger" onclick="$('.pub-nav').classList.toggle('open')">☰</button>
  <nav class="pub-nav"><a href="#/">Home</a><a href="#/courses">Explore Courses</a><a href="#/" onclick="scrollSec('how')">How It Works</a><a href="#/register?role=tutor">Become a Tutor</a><a href="#/" onclick="scrollSec('about')">About</a>
  <span class="auth-btns-m row">${S.user ? `<a class="btn sm" href="${home(S.user)}">My Dashboard</a>` : '<a class="btn sm sec" href="#/login">Login</a><a class="btn sm" href="#/register">Sign Up</a>'}</span></nav>
  <div class="auth-btns row">${S.user ? `<a class="btn sm" href="${home(S.user)}">My Dashboard</a>` : '<a class="btn sm sec" href="#/login">Login</a><a class="btn sm" href="#/register">Sign Up</a>'}</div></div></header>
  <main id="view"><div class="spinner"></div></main>
  <footer class="footer" id="about"><div class="container"><div class="row between" style="align-items:flex-start"><div style="max-width:340px">${logo(true)}<p class="small">Learn from Peers. Teach What You Know.<br>A Software Engineering college project.</p></div>
  <div><h4>Explore</h4><a href="#/">About</a><a href="#/courses">Courses</a><a href="#/register?role=tutor">Become Tutor</a><a href="#/" onclick="info('Contact','Email: support@peer2peer.example (demo project)')">Contact</a><a href="#/" onclick="info('Privacy','Passwords are stored as salted hashes. Demo data only.')">Privacy</a><a href="#/" onclick="info('Terms','This is a demo college project. Payments are simulated.')">Terms</a></div></div>
  <p class="small" style="margin-top:20px">© 2026 Peer2Peer Learn · Social: <a href="#/" onclick="info('Social','Follow links are placeholders in this demo.')">Instagram</a><a href="#/" onclick="info('Social','Follow links are placeholders in this demo.')">LinkedIn</a><a href="#/" onclick="info('Social','Follow links are placeholders in this demo.')">YouTube</a></p></div></footer>`;
}
const info = (t, m) => modal(`<h3>${esc(t)}</h3><p>${esc(m)}</p><button class="btn" onclick="closeModal()">Close</button>`);
function scrollSec(id) { after(() => setTimeout(() => { const e = document.getElementById(id); if (e) e.scrollIntoView({ behavior: 'smooth' }); }, 60)); }
const MENUS = {
  student: [['Dashboard', '#/dashboard', '▦'], ['Explore Courses', '#/courses', '⌕'], ['My Courses', '#/my-courses', '▤'], ['Learning Sessions', '#/sessions', '◷'], ['Assignments', '#/assignments', '✎'], ['Messages', '#/messages', '✉'], ['Notifications', '#/notifications', '◔'], ['Feedback', '#/my-feedback', '★'], ['Payments', '#/payments', '₹'], ['Profile', '#/profile', '☺'], ['Settings', '#/settings', '⚙']],
  tutor: [['Dashboard', '#/t', '▦'], ['My Courses', '#/t/courses', '▤'], ['Create Course', '#/t/create', '＋'], ['Manage Classes', '#/t/classes', '◷'], ['Students', '#/t/students', '☻'], ['Assignments', '#/t/assignments', '✎'], ['Messages', '#/messages', '✉'], ['Reviews', '#/t/reviews', '★'], ['Payments', '#/t/payments', '₹'], ['--', 'As a learner'], ['Explore Courses', '#/courses', '⌕'], ['My Learning', '#/my-courses', '▤'], ['Notifications', '#/notifications', '◔'], ['Profile', '#/profile', '☺'], ['Settings', '#/settings', '⚙']],
  admin: [['Dashboard', '#/a', '▦'], ['Manage Users', '#/a/users', '☻'], ['Manage Students', '#/a/students', '☺'], ['Manage Tutors', '#/a/tutors', '✎'], ['Manage Courses', '#/a/courses', '▤'], ['Manage Categories', '#/a/categories', '▧'], ['Manage Enrollments', '#/a/enrollments', '✓'], ['Manage Classes', '#/a/classes', '◷'], ['Manage Assignments', '#/a/assignments', '✎'], ['Manage Feedback', '#/a/feedback', '★'], ['Manage Payments', '#/a/payments', '₹'], ['Reports', '#/a/reports', '▥'], ['System Monitoring', '#/a/monitor', '◉'], ['Settings', '#/settings', '⚙']],
};
function appShell() {
  const cur = location.hash.split('?')[0], u = S.user;
  const nav = MENUS[u.role].map((m) => m[0] === '--' ? `<div class="role">${m[1]}</div>` : `<a class="nav ${cur === m[1] || (!['#/t', '#/a', '#/dashboard'].includes(m[1]) && cur.startsWith(m[1] + '/')) ? 'on' : ''}" href="${m[1]}" onclick="closeMenu()"><span>${m[2]}</span>${m[0]}</a>`).join('');
  return `<div class="app"><aside class="sidebar" id="sidebar">${logo(true)}<div class="role">${u.role === 'tutor' ? 'Peer Tutor' : cap(u.role)}</div>${nav}<a class="nav" href="#/" onclick="logout();return false" style="margin-top:auto"><span>⏻</span>Logout</a></aside>
  <div class="scrim" id="scrim" onclick="closeMenu()"></div><div class="main"><div class="topbar"><button class="btn sec sm menu-btn" onclick="$('#sidebar').classList.add('open');$('#scrim').classList.add('on')">☰ Menu</button><div class="grow"></div>
  <button class="bell" onclick="toggleBell()" aria-label="Notifications">🔔<i id="bellN" hidden>0</i></button><a href="#/profile" class="row" style="text-decoration:none;color:inherit">${avatar(u)}<span class="small"><b>${esc(u.name)}</b><br><span class="muted">${cap(u.role)}</span></span></a></div>
  <div class="content" id="view"><div class="spinner"></div></div></div></div>`;
}
const closeMenu = () => { const s = $('#sidebar'); if (s) { s.classList.remove('open'); $('#scrim').classList.remove('on'); } };
async function refreshBell() { try { const n = await api('/notifications'); const c = n.filter((x) => !x.is_read).length; const b = $('#bellN'); if (b) { b.textContent = c; b.hidden = !c; } } catch { /* ignore */ } }
async function toggleBell() {
  const old = $('#bellPanel'); if (old) return old.remove();
  const n = await api('/notifications');
  const p = document.createElement('div'); p.className = 'panel'; p.id = 'bellPanel';
  p.innerHTML = `<div class="row between"><b>Notifications</b><a href="#/notifications" onclick="$('#bellPanel').remove()">View all</a></div>` + (n.length ? n.slice(0, 6).map((x) => `<div class="note ${x.is_read ? '' : 'new'}">${esc(x.text)}<div class="muted small">${fmtDT(x.created_at)}</div></div>`).join('') : '<div class="note muted">No notifications.</div>');
  document.body.append(p); await api('/notifications/read', 'POST'); const b = $('#bellN'); if (b) b.hidden = true;
}

/* ---------- router ---------- */
const R = [];
const route = (p, fn, access = 'auth', layout = 'app') => R.push({ re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn, access, layout });
async function render() {
  const bp = $('#bellPanel'); if (bp) bp.remove(); closeModal();
  const [path, qs] = (location.hash.slice(1) || '/').split('?'); const q = Object.fromEntries(new URLSearchParams(qs || ''));
  const r = R.find((x) => x.re.test(path));
  if (S.token && !S.user) { try { S.user = await api('/me'); } catch { endSession(); } }
  if (!r) { $('#app').innerHTML = pubShell(); $('#view').innerHTML = `<div class="container" style="padding:40px 0">${errorBox('Page not found.')}</div>`; return; }
  if (!['public', 'guest'].includes(r.access) && !S.user) return go('#/login?next=' + encodeURIComponent(path));
  if (['tutor', 'admin'].includes(r.access) && S.user.role !== r.access) { toast('Unauthorized access.', 'err'); return go(home(S.user)); }
  if (r.access === 'guest' && S.user) return go(home(S.user));
  const layout = r.layout === 'auto' ? (S.user ? 'app' : 'pub') : r.layout;
  $('#app').innerHTML = layout === 'app' ? appShell() : pubShell();
  if (layout === 'app') refreshBell();
  try { $('#view').innerHTML = await r.fn({ ...path.match(r.re).groups, q, layout }); } catch (e) { $('#view').innerHTML = errorBox(e.message); }
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', render);

/* ================= PUBLIC PAGES ================= */
route('/', async () => {
  const [st, top] = await Promise.all([api('/stats'), api('/courses?sort=popular')]);
  const steps = [['Create your account', 'Sign up in a minute as a student or peer tutor.'], ['Find a course or skill', 'Search courses by topic, level and rating.'], ['Learn from a peer', 'Watch lessons, join live Zoom classes and ask questions.'], ['Share your own knowledge', 'Become a tutor and teach what you know.']];
  const why = [['₹', 'Affordable learning', 'Many courses are free and paid ones are priced by students for students.'], ['⇄', 'Knowledge sharing', 'Everyone has something to teach and something to learn.'], ['☻', 'Collaborative learning', 'Learn with classmates who explain things in a relatable way.'], ['◷', 'Flexible learning', 'Self-paced lessons plus scheduled live classes.'], ['✉', 'Community interaction', 'Message tutors and ask questions on every course.'], ['↗', 'Skill development', 'Assignments, feedback and ratings help you grow.']];
  const tm = [['Aisha K.', 'Very helpful peer tutor and easy-to-understand explanations.'], ['Rohan P.', 'The live Zoom sessions plus assignments kept me on track.'], ['Neha J.', 'I started as a student and now teach my own course!']];
  const faq = [['Is Peer2Peer Learn free?', 'Many courses are free. Paid courses use a simulated payment in this demo project.'], ['How do live classes work?', 'Tutors schedule a class and add a Zoom link. Students click Join Class and Zoom opens in a new tab.'], ['Can I be a student and a tutor?', 'Yes. Register as a Peer Tutor to teach, and you can still enroll in other courses.'], ['Do I need to install anything?', 'Only Zoom for live classes. Everything else works in your browser.']];
  return `<section class="hero"><div class="container"><div><span class="badge b-purple">Peer-to-peer education</span><h1 style="margin-top:12px"><span>Learn from Peers.</span><br>Teach What You Know.</h1>
  <p class="lead">Connect with students, share your knowledge, build new skills and learn together through peer-to-peer education.</p><div class="row"><a class="btn" href="#/courses">Explore Courses</a><a class="btn sec" href="#/register?role=tutor">Become a Peer Tutor</a></div></div>
  <div class="hero-art"><svg viewBox="0 0 400 300"><rect x="20" y="30" width="360" height="240" rx="28" fill="#fff" stroke="#e3e8f4"/><line x1="140" y1="150" x2="260" y2="150" stroke="#7048e8" stroke-width="4" stroke-dasharray="6 6"/>
  <circle cx="120" cy="140" r="52" fill="#3b5bdb"/><circle cx="120" cy="125" r="18" fill="#fff"/><path d="M88 175a32 28 0 0 1 64 0z" fill="#fff"/><circle cx="280" cy="140" r="52" fill="#7048e8"/><circle cx="280" cy="125" r="18" fill="#fff"/><path d="M248 175a32 28 0 0 1 64 0z" fill="#fff"/>
  <rect x="150" y="215" width="100" height="26" rx="13" fill="#eef3ff"/><text x="200" y="233" text-anchor="middle" font-size="13" fill="#0f1f4b" font-weight="700">Learn ⇄ Teach</text></svg>
  <div class="float" style="top:10px;right:0">Python Basics · <b style="color:var(--green)">80%</b></div><div class="float" style="bottom:10px;left:0;animation-delay:1.2s">🎥 Live class on Zoom</div></div></div></section>
  <section class="sec" style="padding:30px 0"><div class="container grid g4">${statCard('☺', st.learners + '+', 'Active Learners')}${statCard('✎', st.tutors + '+', 'Peer Tutors')}${statCard('▤', st.courses, 'Courses')}${statCard('◷', st.sessions, 'Learning Sessions')}</div></section>
  <section class="sec" id="how"><div class="container"><div class="sec-title"><h2>How Peer Learning Works</h2></div><div class="grid g4">${steps.map((s, i) => `<div class="step card flat"><div class="num">${i + 1}</div><h3>Step ${i + 1}</h3><b>${s[0]}</b><p class="muted small">${s[1]}</p></div>`).join('')}</div></div></section>
  <section class="sec" style="background:#fff"><div class="container"><div class="sec-title"><h2>Popular Courses</h2></div><div class="grid g4">${top.slice(0, 4).map(courseCard).join('')}</div><p class="center mt"><a class="btn sec" href="#/courses">View all courses</a></p></div></section>
  <section class="sec"><div class="container"><div class="sec-title"><h2>Why Peer-to-Peer Learning?</h2></div><div class="grid g3">${why.map((w) => `<div class="card benefit"><div class="ico">${w[0]}</div><h3>${w[1]}</h3><p class="muted small">${w[2]}</p></div>`).join('')}</div></div></section>
  <section class="sec"><div class="container"><div class="band row between"><div style="max-width:560px"><h2>Become a Peer Tutor</h2><p>Good at something? Register as a peer tutor, create a course, add lessons, schedule live Zoom classes and help other students grow.</p><div class="row"><span class="badge">1. Sign up</span><span class="badge">2. Create course</span><span class="badge">3. Schedule class</span></div></div><a class="btn orange" href="#/register?role=tutor">Start Teaching</a></div></div></section>
  <section class="sec"><div class="container"><div class="sec-title"><h2>What Students Say</h2></div><div class="grid g3">${tm.map((t) => `<div class="card"><div class="stars">★★★★★</div><p>“${t[1]}”</p><b class="small">${t[0]}</b></div>`).join('')}</div></div></section>
  <section class="sec"><div class="container" style="max-width:760px"><div class="sec-title"><h2>Frequently Asked Questions</h2></div>${faq.map((f) => `<details><summary>${f[0]}</summary><p class="muted" style="margin-top:8px">${f[1]}</p></details>`).join('')}</div></section>`;
}, 'public', 'pub');

route('/login', ({ q }) => `<div class="auth"><div class="card"><h2>Welcome back</h2><p class="muted">Log in to continue learning or teaching.</p>
  <form onsubmit="submitForm(event,doLogin)"><div class="alert err" hidden></div><label>Email</label><input name="email" type="email" required autocomplete="username"><label>Password</label><input name="password" type="password" required autocomplete="current-password">
  <div class="row between"><label class="inline"><input type="checkbox" name="remember"> Remember me</label><a href="#/login" onclick="info('Forgot password','Password reset by email is not part of this demo. Ask the administrator to help, or use a DEMO account below.');return false">Forgot password?</a></div>
  <input type="hidden" name="next" value="${esc(q.next || '')}"><div class="row mt"><button class="btn grow" type="submit">Login</button><a class="btn sec grow" href="#/register">Create Account</a></div></form>
  <div class="alert info mt"><b>DEMO accounts</b> (password <code>Demo@1234</code>)<div class="row mt"><button class="btn sm sec" onclick="fillDemo('student@demo.com')">Student</button><button class="btn sm sec" onclick="fillDemo('tutor@demo.com')">Tutor</button><button class="btn sm sec" onclick="fillDemo('admin@demo.com')">Admin</button></div></div></div></div>`, 'guest', 'pub');
const fillDemo = (e) => { const f = $('form'); f.email.value = e; f.password.value = 'Demo@1234'; };
async function doLogin(d) {
  const r = await api('/login', 'POST', { email: d.email, password: d.password, remember: !!d.remember });
  setSession(r.token, r.user, !!d.remember); toast('Login successful. Welcome, ' + r.user.name.split(' ')[0] + '!', 'ok');
  go(d.next ? '#' + d.next : home(r.user));
}
route('/register', ({ q }) => `<div class="auth wide"><div class="card"><h2>Create your account</h2><p class="muted">Join Peer2Peer Learn as a student or a peer tutor.</p>
  <form onsubmit="submitForm(event,doRegister)"><div class="alert err" hidden></div><div class="form-grid"><div><label>Full Name</label><input name="name" required minlength="2"></div><div><label>Email</label><input name="email" type="email" required></div>
  <div><label>Password</label><input name="password" type="password" required minlength="8" oninput="pwStrength(this)"><div class="hint" id="pwh">At least 8 characters with a letter and a number.</div></div><div><label>Confirm Password</label><input name="confirm" type="password" required></div>
  <div><label>Role</label><select name="role"><option value="student" ${q.role !== 'tutor' ? 'selected' : ''}>Student</option><option value="tutor" ${q.role === 'tutor' ? 'selected' : ''}>Peer Tutor</option></select></div>
  <div><label>Profile Picture (optional, max 300 KB)</label><input type="file" id="avatarFile" accept="image/png,image/jpeg,image/webp,image/gif"></div>
  <div><label>Skills</label><input name="skills" placeholder="e.g. Python, Photoshop"></div><div><label>Interests</label><input name="interests" placeholder="e.g. AI, Design"></div></div>
  <div class="row mt"><button class="btn grow" type="submit">Create Account</button><a class="btn sec" href="#/login">I already have an account</a></div></form></div></div>`, 'guest', 'pub');
function pwStrength(el) { const v = el.value, ok = v.length >= 8 && /[A-Za-z]/.test(v) && /\d/.test(v), h = $('#pwh'); h.textContent = ok ? (v.length >= 12 && /[^A-Za-z0-9]/.test(v) ? 'Strong password' : 'Good password') : 'At least 8 characters with a letter and a number.'; h.style.color = ok ? 'var(--green)' : ''; }
async function doRegister(d) {
  if (d.password !== d.confirm) throw new Error('Passwords do not match.');
  d.avatar = await readImage($('#avatarFile'));
  const r = await api('/register', 'POST', d); setSession(r.token, r.user, false);
  toast('Registration successful! Welcome to Peer2Peer Learn.', 'ok'); go(home(r.user));
}

/* ---------- explore + course detail ---------- */
const EX = { list: [], page: 1 };
route('/courses', async () => {
  const cats = await api('/categories');
  after(loadCourses);
  return `${S.user ? '' : '<div class="container" style="padding-top:24px">'}${title('Explore Courses')}<div class="card mb"><div class="grid g4"><div style="grid-column:span 2"><label style="margin-top:0">Search</label><input id="fq" placeholder="Search courses or tutors..." oninput="EX.page=1;loadCourses()"></div>
  <div><label style="margin-top:0">Category</label><select id="fc" onchange="EX.page=1;loadCourses()"><option value="">All</option>${cats.map((c) => `<option>${esc(c.name)}</option>`).join('')}</select></div>
  <div><label style="margin-top:0">Difficulty</label><select id="fd" onchange="EX.page=1;loadCourses()"><option value="">All</option><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></div>
  <div><label style="margin-top:0">Price</label><select id="fp" onchange="EX.page=1;loadCourses()"><option value="">Free and paid</option><option value="free">Free</option><option value="paid">Paid</option></select></div>
  <div><label style="margin-top:0">Minimum rating</label><select id="fr" onchange="EX.page=1;loadCourses()"><option value="">Any</option><option value="4">4 stars and up</option><option value="3">3 stars and up</option></select></div>
  <div><label style="margin-top:0">Sort by</label><select id="fs" onchange="EX.page=1;loadCourses()"><option value="popular">Popularity</option><option value="latest">Latest</option><option value="rating">Rating</option></select></div></div></div>
  <div id="courseGrid"><div class="spinner"></div></div><div class="pager" id="pager"></div>${S.user ? '' : '</div>'}`;
}, 'public', 'auto');
async function loadCourses() {
  const g = $('#courseGrid'); if (!g) return;
  const p = new URLSearchParams({ q: $('#fq').value, category: $('#fc').value, difficulty: $('#fd').value, price: $('#fp').value, rating: $('#fr').value, sort: $('#fs').value });
  try { EX.list = await api('/courses?' + p); } catch (e) { g.innerHTML = errorBox('Course could not be loaded. ' + e.message); return; }
  const per = 6, pages = Math.max(1, Math.ceil(EX.list.length / per)); EX.page = Math.min(EX.page, pages);
  g.innerHTML = EX.list.length ? `<div class="grid g3">${EX.list.slice((EX.page - 1) * per, EX.page * per).map(courseCard).join('')}</div>` : empty('No courses match your search.');
  $('#pager').innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<button class="${i + 1 === EX.page ? 'on' : ''}" onclick="EX.page=${i + 1};loadCourses()">${i + 1}</button>`).join('') : '';
}
route('/course/:id', async ({ id }) => {
  const c = await api('/courses/' + id), me = S.user, own = me && me.id === c.tutor_id, wl = me && wish().includes(c.id);
  const mods = {}; c.lessons.forEach((l) => (mods[l.module] = mods[l.module] || []).push(l));
  const buttons = c.enrolled ? `<a class="btn block" href="#/learn/${c.id}">Continue Learning</a><a class="btn sec block mt" href="#/messages/${c.tutor.id}?course=${c.id}">Contact Tutor</a>` :
    own ? `<a class="btn block" href="#/t/edit/${c.id}">Edit Course</a>` : `<button class="btn block" onclick="act(()=>enroll(${c.id},${c.price}))">Enroll Now</button><button class="btn sec block mt" onclick="toast('Enroll in this course to message the tutor.')">Contact Tutor</button>`;
  return `${me ? '' : '<div class="container" style="padding:24px 20px">'}<div class="grid" style="grid-template-columns:minmax(0,2fr) minmax(260px,1fr);align-items:start" id="cd"><div class="grid">
  <div class="card">${thumb(c)}<div class="row mt"><span class="badge">${esc(c.difficulty)}</span><span class="badge b-purple">${esc(c.category)}</span>${c.status !== 'published' ? badge(c.status) : ''}</div><h2 class="mt">${esc(c.title)}</h2>
  <div class="small">${stars(c.rating)} ${c.rating || 'No ratings yet'} (${c.reviews} reviews) · ${c.students} students · ${c.duration} hours</div><p class="mt">${esc(c.description)}</p></div>
  <div class="card"><h3>What you will learn</h3><ul>${(c.objectives || '').split('\n').filter(Boolean).map((o) => `<li>${esc(o)}</li>`).join('') || '<li class="muted">Objectives will be added soon.</li>'}</ul></div>
  <div class="card"><h3>Syllabus</h3>${Object.keys(mods).length ? Object.entries(mods).map(([m, ls]) => `<p><b>${esc(m)}</b></p><ul>${ls.map((l) => `<li>${esc(l.title)} ${c.enrolled || own ? '' : '<span class="muted small">🔒</span>'}</li>`).join('')}</ul>`).join('') : '<p class="muted">No lessons yet.</p>'}</div>
  <div class="card"><h3>Reviews</h3>${c.review_list.length ? c.review_list.map((r) => `<div class="note"><b>${esc(r.name)}</b> ${stars(r.rating)}<div>${esc(r.review || '')}</div></div>`).join('') : '<p class="muted">No reviews yet.</p>'}</div></div>
  <div class="grid"><div class="card"><div class="price ${c.price ? '' : 'free'}" style="font-size:1.8rem">${money(c.price)}</div><div class="mt">${buttons}${me && !own ? `<button class="btn sec block mt" onclick="toggleWish(${c.id})">${wl ? '♥ In your wishlist' : '♡ Add to Wishlist'}</button>` : ''}</div></div>
  <div class="card"><h3>Your tutor</h3><div class="row">${avatar(c.tutor)}<div><b>${esc(c.tutor.name)}</b><div class="small muted">${esc(c.tutor.skills || '')}</div></div></div><p class="small mt">${esc(c.tutor.bio || '')}</p></div></div></div>${me ? '' : '</div>'}`;
}, 'public', 'auto');
async function enroll(id, price) {
  if (!S.user) return go('#/login?next=' + encodeURIComponent('/course/' + id));
  if (price > 0) return go('#/payment/' + id);
  await api(`/courses/${id}/enroll`, 'POST'); toast('Enrollment Successful', 'ok'); render();
}
function toggleWish(id) { let w = wish(); w = w.includes(id) ? w.filter((x) => x !== id) : [...w, id]; localStorage.setItem('wish_' + S.user.id, JSON.stringify(w)); toast('Wishlist updated.'); render(); }

/* ================= STUDENT / LEARNER PAGES ================= */
route('/dashboard', async () => {
  if (S.user.role !== 'student') return go(home(S.user)) || '';
  const d = await api('/student/dashboard');
  return `${title('Welcome back, ' + esc(S.user.name.split(' ')[0]) + '!', '<a class="btn" href="#/courses">Explore Courses</a>')}
  <div class="grid g4 mb">${statCard('▤', d.enrolled, 'Courses Enrolled')}${statCard('✓', d.completed, 'Courses Completed')}${statCard('◷', d.hours, 'Learning Hours')}${statCard('✎', d.pending, 'Pending Assignments')}</div>
  <h3>Continue learning</h3>${d.courses.length ? `<div class="grid g3 mb">${d.courses.slice(0, 3).map((c) => card('', `<b>${esc(c.title)}</b><p class="muted small">Progress: ${c.progress}%</p>${progressBar(c.progress)}<a class="btn sm mt" href="#/learn/${c.id}">Continue Learning</a>`)).join('')}</div>` : empty('No courses enrolled yet.', 'Explore Courses', '#/courses')}
  <div class="grid g2 mb"><div><h3>Upcoming classes</h3>${d.classes.length ? d.classes.map(classCard).join('<div style="height:12px"></div>') : empty('No upcoming classes.')}</div>
  <div><h3>Recent messages</h3>${card('', d.messages.length ? d.messages.map((m) => `<div class="note"><b>${esc(m.name)}</b><div class="small">${esc(m.body.slice(0, 90))}</div><a class="small" href="#/messages/${m.from_id}">Reply</a></div>`).join('') : '<p class="muted">No messages.</p>')}
  <h3 class="mt">Notifications</h3>${card('', d.notifications.length ? d.notifications.map((n) => `<div class="note ${n.is_read ? '' : 'new'}">${esc(n.text)}</div>`).join('') : '<p class="muted">No notifications.</p>')}</div></div>
  <h3>Recommended for you</h3><div class="grid g4">${d.recommended.map(courseCard).join('') || empty('You have joined every course. Check back soon!')}</div>`;
});
route('/my-courses', async () => {
  const [mine, all] = await Promise.all([api('/my/courses'), api('/courses')]); const w = all.filter((c) => wish().includes(c.id));
  return `${title('My Courses')}${mine.length ? `<div class="grid g3 mb">${mine.map((c) => `<div class="card course-card">${thumb(c)}<h3>${esc(c.title)}</h3><div class="small muted">by ${esc(c.tutor_name)}</div>${progressBar(c.progress)}<div class="small">${c.progress}% complete</div><a class="btn sm" href="#/learn/${c.id}">${c.progress ? 'Continue Learning' : 'Start Learning'}</a></div>`).join('')}</div>` : empty('No courses enrolled yet.', 'Explore Courses', '#/courses')}
  <h3>Wishlist</h3>${w.length ? `<div class="grid g3">${w.map(courseCard).join('')}</div>` : '<p class="muted">Your wishlist is empty. Use “Add to Wishlist” on a course page.</p>'}`;
});
route('/payment/:id', async ({ id }) => {
  const c = await api('/courses/' + id);
  if (c.enrolled) return go('#/learn/' + id) || '';
  return `${title('Checkout')}<div class="grid g2"><div class="card"><h3>Order summary</h3><dl class="receipt" style="display:grid;grid-template-columns:110px 1fr;gap:8px"><dt class="muted">Course</dt><dd>${esc(c.title)}</dd><dt class="muted">Tutor</dt><dd>${esc(c.tutor.name)}</dd><dt class="muted">Student</dt><dd>${esc(S.user.name)}</dd><dt class="muted">Price</dt><dd class="price">₹${c.price}</dd></dl></div>
  <div class="card"><h3>Payment method</h3><div class="alert info small">DEMO payment only. No real money is charged. Use a card number ending in 0000 to test a failed payment.</div>
  <form onsubmit="submitForm(event,(d)=>doPay(d,${c.id}))"><div class="alert err" hidden></div><label class="inline"><input type="radio" name="method" value="UPI" checked onchange="$('#cardf').hidden=true"> UPI</label><label class="inline"><input type="radio" name="method" value="Card" onchange="$('#cardf').hidden=false"> Credit / Debit Card</label><label class="inline"><input type="radio" name="method" value="Net Banking" onchange="$('#cardf').hidden=true"> Net Banking</label>
  <div id="cardf" hidden><label>Card number</label><input name="card" placeholder="4111 1111 1111 1111" inputmode="numeric" maxlength="23"></div><button class="btn green block mt" type="submit">Confirm Payment · ₹${c.price}</button></form></div></div>`;
});
async function doPay(d, id) {
  if (d.method === 'Card' && !/^\d[\d\s]{11,22}$/.test(d.card || '')) throw new Error('Please enter a valid card number.');
  const r = await api('/payments', 'POST', { course_id: id, method: d.method, card: d.card }); toast('Payment Successful', 'ok'); go('#/receipt/' + r.id);
}
route('/receipt/:id', async ({ id }) => {
  const r = await api('/payments/' + id);
  return `<div class="receipt card"><div class="alert ok"><b>Payment Successful</b> · Enrollment Successful</div><h3>Receipt ${esc(r.receipt_no)}</h3><dl>${[['Transaction ID', r.txn_id], ['Student', r.student], ['Course', r.course], ['Tutor', r.tutor], ['Amount', '₹' + r.amount], ['Method', r.method], ['Status', r.status], ['Date', fmtDT(r.created_at)]].map((x) => `<dt>${x[0]}</dt><dd>${esc(x[1])}</dd>`).join('')}</dl>
  <div class="row mt"><a class="btn" href="#/learn/${r.course_id}">Start Learning</a><button class="btn sec" onclick="window.print()">Print receipt</button></div></div>`;
});
route('/payments', async () => {
  const p = await api('/payments');
  return `${title('Payment History')}${table(['Transaction ID', 'Course', 'Amount', 'Date', 'Status', 'Receipt'], p.map((x) => [esc(x.txn_id), esc(x.course), '₹' + x.amount, fmtDT(x.created_at), badge(x.status), x.status === 'Success' ? `<a href="#/receipt/${x.id}">View</a>` : '-']), 'No payments yet.')}`;
});
route('/learn/:id', async ({ id, q }) => {
  const c = await api('/courses/' + id);
  if (!c.enrolled && S.user.id !== c.tutor_id) return go('#/course/' + id) || '';
  const ls = c.lessons; if (!ls.length) return `${title(esc(c.title))}${empty('No lessons have been added yet.')}`;
  const cur = ls.find((l) => l.id === Number(q.l)) || ls.find((l) => !l.done) || ls[ls.length - 1], idx = ls.indexOf(cur), done = ls.filter((l) => l.done).length, pct = Math.round((done / ls.length) * 100);
  const next = ls[idx + 1], prev = ls[idx - 1], res = cur.resource_url;
  const qa = c.enrolled ? (await api('/messages/' + c.tutor.id)).filter((m) => m.course_id === c.id) : [];
  const mods = {}; ls.forEach((l) => (mods[l.module] = mods[l.module] || []).push(l));
  return `${title(esc(c.title), `<a class="btn sec sm" href="#/course/${c.id}">Course details</a><a class="btn sec sm" href="#/assignments">Assignments</a><a class="btn sec sm" href="#/sessions">Classes</a>`)}
  <div class="card mb"><div class="row between small"><b>Course progress</b><span>${pct}%</span></div>${progressBar(pct)}<div class="small muted mt">${done} of ${ls.length} lessons completed</div></div>
  <div class="learn"><div class="card lesson-list">${Object.entries(mods).map(([m, a]) => `<p class="small" style="margin:8px 0 2px"><b>${esc(m)}</b></p>${a.map((l) => `<a class="${l.id === cur.id ? 'on' : ''}" href="#/learn/${c.id}?l=${l.id}"><span class="chk ${l.done ? 'done' : ''}">${l.done ? '✓' : ''}</span>${esc(l.title)}</a>`).join('')}`).join('')}</div>
  <div class="grid"><div class="card"><span class="badge">${esc(cur.module)}</span><h3 class="mt">${esc(cur.title)}</h3><p>${esc(cur.content)}</p>
  ${res ? (/\.(mp4|webm)$/i.test(res) ? `<video controls style="width:100%;border-radius:12px" src="${esc(res)}"></video>` : `<a class="btn sec" href="${esc(res)}" target="_blank" rel="noopener noreferrer">Open resource ↗</a>`) : ''}
  <div class="row mt">${prev ? `<a class="btn sec" href="#/learn/${c.id}?l=${prev.id}">← Previous</a>` : ''}${c.enrolled ? `<button class="btn ${cur.done ? 'sec' : 'green'}" onclick="act(()=>markLesson(${cur.id},${!cur.done},'${next ? `#/learn/${c.id}?l=${next.id}` : ''}'))">${cur.done ? 'Mark as not completed' : '✓ Mark completed' + (next ? ' & continue' : '')}</button>` : ''}${next ? `<a class="btn" href="#/learn/${c.id}?l=${next.id}">Next →</a>` : ''}</div></div>
  ${c.enrolled ? `<div class="card"><h3>Ask the tutor a question</h3>${qa.map((m) => `<div class="note"><b>${m.from_id === S.user.id ? 'You' : esc(c.tutor.name)}:</b> ${esc(m.body)}</div>`).join('')}<form onsubmit="submitForm(event,(d)=>askTutor(d,${c.tutor.id},${c.id}))"><div class="alert err" hidden></div><textarea name="body" required maxlength="1000" placeholder="Can you explain this topic?"></textarea><button class="btn mt" type="submit">Send question</button></form></div>
  <div class="card"><h3>Rate this course</h3>${ratingForm(c.id, c.mine)}</div>` : ''}</div></div>`;
});
async function markLesson(id, done, next) { await api(`/lessons/${id}/complete`, 'POST', { done }); if (done && next) go(next); else render(); }
async function askTutor(d, tid, cid) { await api('/messages', 'POST', { to_id: tid, course_id: cid, body: d.body }); toast('Question sent to your tutor.', 'ok'); render(); }
const starsInput = (id, v) => `<div class="stars-in" id="st${id}" data-v="${v || 0}">${[1, 2, 3, 4, 5].map((i) => `<span class="${i <= (v || 0) ? 'on' : ''}" onclick="setStar(${id},${i})">★</span>`).join('')}</div>`;
function setStar(id, v) { const e = $('#st' + id); e.dataset.v = v; [...e.children].forEach((s, i) => s.classList.toggle('on', i < v)); }
const ratingForm = (cid, mine) => `${starsInput(cid, mine && mine.rating)}<textarea id="rv${cid}" maxlength="500" placeholder="Write a short review (optional)">${esc(mine ? mine.review : '')}</textarea><button class="btn mt" onclick="act(()=>sendRating(${cid}))">${mine ? 'Update feedback' : 'Submit feedback'}</button>`;
async function sendRating(cid) { await api(`/courses/${cid}/feedback`, 'POST', { rating: Number($('#st' + cid).dataset.v), review: $('#rv' + cid).value }); toast('Thank you for your feedback!', 'ok'); render(); }
route('/my-feedback', async () => {
  const [mine, fb] = await Promise.all([api('/my/courses'), api('/my/feedback')]); const m = Object.fromEntries(fb.map((f) => [f.course_id, f]));
  return `${title('Feedback and Ratings')}${mine.length ? `<div class="grid g2">${mine.map((c) => card(esc(c.title), `<p class="small muted">Tutor: ${esc(c.tutor_name)}</p>${ratingForm(c.id, m[c.id])}`)).join('')}</div>` : empty('No courses enrolled yet.', 'Explore Courses', '#/courses')}`;
});
route('/sessions', async () => {
  const cl = await api('/classes'), up = cl.filter((c) => c.status === 'scheduled' || c.status === 'live'), past = cl.filter((c) => !up.includes(c));
  return `${title('Learning Sessions')}<h3>Upcoming and live</h3>${up.length ? `<div class="grid g3 mb">${up.map(classCard).join('')}</div>` : empty('No upcoming classes.', 'Explore Courses', '#/courses')}${past.length ? `<h3>Past and cancelled</h3><div class="grid g3">${past.map(classCard).join('')}</div>` : ''}`;
});
async function joinClass(id) {   // opens the stored Zoom link in a new tab (no in-app video)
  const w = window.open('about:blank', '_blank');
  try {
    const r = await api(`/classes/${id}/join`);
    if (w) { w.opener = null; w.location.href = r.zoom_link; toast('Opening Zoom in a new tab...', 'ok'); }
    else modal(`<h3>Join your class</h3><p>Your browser blocked the pop-up. Open Zoom with this link:</p><p><a class="btn green" href="${esc(r.zoom_link)}" target="_blank" rel="noopener noreferrer">Open Zoom ↗</a></p>`);
  } catch (e) { if (w) w.close(); toast(e.message, 'err'); }
}
route('/assignments', async () => {
  const a = await api('/assignments');
  return `${title('Assignments')}${a.length ? `<div class="grid g2">${a.map((x) => { const st = x.sub_id ? x.sub_status : 'Pending'; return card(`${esc(x.title)} ${badge(st)}`, `<p class="muted small">${esc(x.course)} · Due ${fmtD(x.due_date)} · Max ${x.max_marks} marks</p><p>${esc(x.instructions)}</p>
    ${x.sub_id ? `<div class="alert info"><b>Your submission:</b> ${esc(x.content)}</div>${x.sub_status === 'Evaluated' ? `<p><b>Marks:</b> ${x.marks}/${x.max_marks}</p><p><b>Tutor feedback:</b> ${esc(x.feedback)}</p>` : '<p class="muted small">Waiting for your tutor to evaluate.</p>'}` :
    `<textarea id="as${x.id}" placeholder="Write your answer or paste a link to your work" maxlength="5000"></textarea><button class="btn mt" onclick="act(()=>submitAssign(${x.id}))">Submit assignment</button>`}`); }).join('')}</div>` : empty('No assignments pending.')}`;
});
async function submitAssign(id) { const r = await api(`/assignments/${id}/submit`, 'POST', { content: $('#as' + id).value }); toast(r.status === 'Late' ? 'Submitted (marked late).' : 'Assignment submitted.', 'ok'); render(); }
const msgPage = async ({ uid, q }) => {
  const convs = await api('/conversations'), id = uid ? Number(uid) : null, th = id ? await api('/messages/' + id) : [], who = convs.find((c) => c.id === id);
  after(() => { const m = $('.msgs'); if (m) m.scrollTop = m.scrollHeight; });
  return `${title('Messages')}<div class="chat ${id ? 'open' : ''}"><div class="convs"><div style="padding:10px"><input placeholder="Search messages..." oninput="filterConvs(this.value)"></div>
  ${convs.length ? convs.map((c) => `<a class="conv ${c.id === id ? 'on' : ''}" href="#/messages/${c.id}" data-s="${esc((c.name + ' ' + (c.last || '')).toLowerCase())}">${avatar(c)}<div><b>${esc(c.name)}</b> ${c.unread ? `<span class="badge b-red">${c.unread}</span>` : ''}<div class="last">${esc(c.last || 'Start a conversation')}</div></div></a>`).join('') : '<div class="empty" style="border:0">No messages.</div>'}</div>
  <div class="thread">${id && who ? `<div class="row" style="padding:12px;border-bottom:1px solid var(--line)"><a class="btn sm sec" href="#/messages" style="display:${innerWidth > 900 ? 'none' : 'inline-flex'}">←</a>${avatar(who)}<b>${esc(who.name)}</b><span class="badge">${cap(who.role)}</span></div>
  <div class="msgs">${th.length ? th.map((m) => `<div class="msg ${m.from_id === S.user.id ? 'me' : ''}">${m.course ? `<small>Course Q&amp;A: ${esc(m.course)}</small>` : ''}${esc(m.body)}<small>${fmtDT(m.created_at)}${m.from_id === S.user.id ? (m.is_read ? ' · Read' : ' · Unread') : ''}</small></div>`).join('') : '<p class="muted center">No messages yet. Say hello!</p>'}</div>
  <form class="row" style="padding:12px;border-top:1px solid var(--line);flex-wrap:nowrap" onsubmit="submitForm(event,(d,f)=>sendMsg(d,${id},${Number(q.course) || 0}))"><input name="body" class="grow" placeholder="Type a message" required maxlength="1000" autocomplete="off"><button class="btn" type="submit">Send</button></form>` : '<div class="empty" style="border:0;margin:auto">Select a conversation to start chatting.</div>'}</div></div>`;
};
route('/messages', msgPage); route('/messages/:uid', msgPage);
const filterConvs = (v) => $$('.conv').forEach((c) => (c.style.display = c.dataset.s.includes(v.toLowerCase()) ? '' : 'none'));
async function sendMsg(d, to, course) { await api('/messages', 'POST', { to_id: to, course_id: course || null, body: d.body }); render(); }
route('/notifications', async () => {
  const n = await api('/notifications'); await api('/notifications/read', 'POST'); refreshBell();
  return `${title('Notifications')}${n.length ? card('', n.map((x) => `<div class="note ${x.is_read ? '' : 'new'}">${esc(x.text)}<div class="muted small">${fmtDT(x.created_at)}</div></div>`).join('')) : empty('No notifications.')}`;
});
route('/profile', async () => {
  const [me, st] = await Promise.all([api('/me'), api('/profile/stats')]); S.user = me;
  return `${title('My Profile')}<div class="grid g2"><div class="card"><div class="row">${avatar(me, 'lg')}<div><h3 style="margin:0">${esc(me.name)}</h3><div class="muted">${esc(me.email)}</div><span class="badge">${cap(me.role)}</span> ${st.rating ? `<span class="stars">★</span> ${st.rating}` : ''}</div></div>
  <p class="mt">${esc(me.bio || 'No bio yet.')}</p><p class="small"><b>Skills:</b> ${esc(me.skills || '-')}<br><b>Interests:</b> ${esc(me.interests || '-')}</p>
  ${st.teaching.length ? `<p class="small"><b>Teaching:</b> ${st.teaching.map(esc).join(', ')}</p>` : ''}<p class="small"><b>Learning:</b> ${st.learning.map(esc).join(', ') || '-'}</p></div>
  <div class="card"><h3>Edit profile</h3><form onsubmit="submitForm(event,doProfile)"><div class="alert err" hidden></div><label>Full name</label><input name="name" value="${esc(me.name)}" required><label>Bio</label><textarea name="bio" maxlength="500">${esc(me.bio)}</textarea>
  <label>Skills</label><input name="skills" value="${esc(me.skills)}"><label>Interests</label><input name="interests" value="${esc(me.interests)}"><label>Profile picture (max 300 KB)</label><input type="file" id="avatarFile" accept="image/*"><button class="btn mt" type="submit">Save changes</button></form></div></div>`;
});
async function doProfile(d) { d.avatar = await readImage($('#avatarFile')); S.user = await api('/profile', 'PUT', d); toast('Profile updated.', 'ok'); render(); }
route('/settings', () => `${title('Settings')}<div class="card" style="max-width:480px"><h3>Change password</h3><form onsubmit="submitForm(event,doPassword)"><div class="alert err" hidden></div><label>Current password</label><input type="password" name="current_password" required><label>New password</label><input type="password" name="new_password" required minlength="8"><div class="hint">At least 8 characters with a letter and a number.</div><button class="btn mt" type="submit">Update password</button></form></div>`);
async function doPassword(d, f) { await api('/profile', 'PUT', { name: S.user.name, skills: S.user.skills, interests: S.user.interests, bio: S.user.bio, ...d }); f.reset(); toast('Password updated.', 'ok'); }

/* ================= PEER TUTOR PAGES ================= */
route('/t', async () => {
  const d = await api('/tutor/dashboard');
  return `${title('Tutor Dashboard', '<a class="btn" href="#/t/create">＋ Create Course</a><a class="btn sec" href="#/t/classes">Schedule Class</a>')}
  <div class="grid g4 mb">${statCard('▤', d.courses, 'Total Courses')}${statCard('☻', d.students, 'Total Students')}${statCard('◷', d.activeClasses, 'Active Classes')}${statCard('★', d.rating || '-', 'Average Rating')}</div>
  ${d.pending ? `<div class="alert info">You have <b>${d.pending}</b> submission(s) waiting for review. <a href="#/t/assignments">Review now</a></div>` : ''}
  <h3>Upcoming classes</h3>${d.classes.length ? `<div class="grid g3">${d.classes.map((c) => `<div class="card class-card ${c.status}"><b>${esc(c.title)}</b><p class="small muted">${esc(c.course_title)}</p><p class="small">📅 ${fmtD(c.date)} · ${t12(c.start_time)} – ${t12(c.end_time)}</p><p class="small">${c.participants} students ${badge(c.status)}</p></div>`).join('')}</div>` : empty('No upcoming classes.', 'Schedule a class', '#/t/classes')}`;
}, 'tutor');
let TC = [];
route('/t/courses', async () => {
  TC = await api('/tutor/courses');
  return `${title('My Courses', '<a class="btn" href="#/t/create">＋ Create Course</a>')}${TC.length ? table(['Course', 'Status', 'Students', 'Rating', 'Price', 'Actions'], TC.map((c) => [`<b>${esc(c.title)}</b><div class="muted small">${esc(c.category)} · ${esc(c.difficulty)}</div>`, badge(c.status), c.students, c.rating ? stars(c.rating) + ' ' + c.rating : '-', money(c.price),
    `<div class="row"><a class="btn sm sec" href="#/course/${c.id}">View</a><a class="btn sm sec" href="#/t/edit/${c.id}">Edit</a><button class="btn sm ${c.status === 'published' ? 'orange' : 'green'}" onclick="act(()=>togglePublish(${c.id}))">${c.status === 'published' ? 'Unpublish' : 'Publish'}</button><button class="btn sm red" onclick="confirmDo('Delete this course and all its data?','()=>deleteCourse(${c.id})')">Delete</button></div>`])) : empty('No courses created.', 'Create your first course', '#/t/create')}`;
}, 'tutor');
async function togglePublish(id) {
  const c = TC.find((x) => x.id === id);
  await api('/courses/' + id, 'PUT', { title: c.title, description: c.description, category: c.category, difficulty: c.difficulty, duration: c.duration, paid: c.price > 0, price: c.price, objectives: c.objectives, publish: c.status !== 'published' });
  toast(c.status === 'published' ? 'Course moved to drafts.' : 'Course published.', 'ok'); render();
}
async function deleteCourse(id) { await api('/courses/' + id, 'DELETE'); toast('Course deleted.', 'ok'); render(); }
const lessonRow = () => `<div class="card flat lrow" style="margin-top:10px"><div class="form-grid"><div><label>Module name</label><input name="lm" placeholder="Module 1: Basics"></div><div><label>Lesson name</label><input name="lt"></div></div><label>Lesson description / notes</label><textarea name="ld"></textarea><label>Learning resource link (video .mp4 or document URL, optional)</label><input name="lu" placeholder="https://..."><button class="btn sm red mt" type="button" onclick="this.closest('.lrow').remove()">Remove lesson</button></div>`;
const courseForm = async ({ id }) => {
  const cats = await api('/categories'); const c = id ? await api('/courses/' + id) : { price: 0, lessons: [] };
  return `${title(id ? 'Edit Course' : 'Create Course')}<div class="card"><div class="alert err" id="cfErr" hidden></div><div class="form-grid"><div><label>Course title</label><input id="cf_title" value="${esc(c.title)}"></div>
  <div><label>Category</label><select id="cf_cat"><option value="">Choose...</option>${cats.map((x) => `<option ${x.name === c.category ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
  <div><label>Difficulty</label><select id="cf_diff">${['Beginner', 'Intermediate', 'Advanced'].map((x) => `<option ${x === c.difficulty ? 'selected' : ''}>${x}</option>`).join('')}</select></div><div><label>Duration (hours)</label><input id="cf_dur" type="number" min="0" value="${c.duration || ''}"></div>
  <div><label>Pricing</label><label class="inline"><input type="radio" name="cf_paid" value="0" ${c.price ? '' : 'checked'} onchange="$('#cf_price').disabled=true"> Free</label><label class="inline"><input type="radio" name="cf_paid" value="1" ${c.price ? 'checked' : ''} onchange="$('#cf_price').disabled=false"> Paid</label></div>
  <div><label>Price (₹)</label><input id="cf_price" type="number" min="1" value="${c.price || ''}" ${c.price ? '' : 'disabled'}></div><div><label>Thumbnail (optional, max 300 KB)</label><input type="file" id="cf_thumb" accept="image/*"></div></div>
  <label>Description</label><textarea id="cf_desc">${esc(c.description)}</textarea><label>Learning objectives (one per line)</label><textarea id="cf_obj">${esc(c.objectives)}</textarea>
  <h3 class="mt">Modules and lessons</h3>${c.lessons.length ? `<ul class="small">${c.lessons.map((l) => `<li>${esc(l.module)} · ${esc(l.title)}</li>`).join('')}</ul><p class="muted small">Existing lessons are kept. Add more lessons below.</p>` : ''}
  <div id="lessonRows">${c.lessons.length ? '' : lessonRow()}</div><button class="btn sec sm mt" type="button" onclick="$('#lessonRows').insertAdjacentHTML('beforeend',lessonRow())">＋ Add lesson</button>
  <div class="row mt"><button class="btn sec" onclick="act(()=>saveCourseForm(${id || 0},false))">Save Draft</button><button class="btn green" onclick="act(()=>saveCourseForm(${id || 0},true))">Publish Course</button></div></div>`;
};
route('/t/create', courseForm, 'tutor'); route('/t/edit/:id', courseForm, 'tutor');
async function saveCourseForm(id, publish) {
  const lessons = $$('.lrow').map((r) => ({ module: $('[name=lm]', r).value, title: $('[name=lt]', r).value, description: $('[name=ld]', r).value, url: $('[name=lu]', r).value })).filter((l) => l.title.trim());
  const body = { title: $('#cf_title').value, category: $('#cf_cat').value, difficulty: $('#cf_diff').value, duration: $('#cf_dur').value, paid: $('input[name=cf_paid]:checked').value === '1', price: $('#cf_price').value, description: $('#cf_desc').value, objectives: $('#cf_obj').value, lessons, publish, thumb: await readImage($('#cf_thumb')) };
  try { await api(id ? '/courses/' + id : '/courses', id ? 'PUT' : 'POST', body); } catch (e) { const a = $('#cfErr'); a.textContent = e.message; a.hidden = false; a.scrollIntoView({ block: 'center' }); throw e; }
  toast(publish ? 'Course published.' : 'Draft saved.', 'ok'); go('#/t/courses');
}
let TCL = [];
const classFields = (p, tc, c = {}) => `<div class="alert err" id="${p}Err" hidden></div><div class="form-grid"><div><label>Course</label><select id="${p}course" ${c.course_id ? 'disabled' : ''}>${tc.map((x) => `<option value="${x.id}" ${x.id === c.course_id ? 'selected' : ''}>${esc(x.title)}</option>`).join('')}</select></div>
  <div><label>Class title</label><input id="${p}title" value="${esc(c.title)}"></div><div><label>Date</label><input id="${p}date" type="date" value="${esc(c.date)}"></div><div><label>Start time</label><input id="${p}start" type="time" value="${esc(c.start_time)}"></div><div><label>End time</label><input id="${p}end" type="time" value="${esc(c.end_time)}"></div>
  <div><label>Zoom meeting link</label><input id="${p}zoom" placeholder="https://zoom.us/j/123456789" value="${esc(c.zoom_link)}"></div></div><label>Description</label><textarea id="${p}desc">${esc(c.description)}</textarea>`;
const classBody = (p) => ({ course_id: Number($('#' + p + 'course').value), title: $('#' + p + 'title').value, date: $('#' + p + 'date').value, start_time: $('#' + p + 'start').value, end_time: $('#' + p + 'end').value, zoom_link: $('#' + p + 'zoom').value, description: $('#' + p + 'desc').value });
route('/t/classes', async () => {
  const [tc, all] = await Promise.all([api('/tutor/courses'), api('/classes')]); TCL = all.filter((c) => c.tutor_id === S.user.id); window._tc = tc;
  return `${title('Manage Classes')}<div class="card mb"><h3>Schedule New Class</h3>${tc.length ? `${classFields('nc', tc)}<button class="btn mt" onclick="act(()=>createClass())">Schedule Class</button><p class="hint">Live classes run on Zoom. Paste the meeting link; students will see a Join Class button.</p>` : empty('No courses created.', 'Create a course first', '#/t/create')}</div>
  <h3>Your classes</h3>${TCL.length ? table(['Class', 'Date and time', 'Status', 'Students', 'Actions'], TCL.map((c) => [`<b>${esc(c.title)}</b><div class="muted small">${esc(c.course_title)}</div>`, `${fmtD(c.date)}<div class="small muted">${t12(c.start_time)} – ${t12(c.end_time)}</div>`, badge(c.status), c.participants,
    `<div class="row"><button class="btn sm sec" onclick="showParticipants(${c.session_id})">Participants</button><button class="btn sm sec" onclick="editClass(${c.session_id})">Edit</button><button class="btn sm sec" onclick="act(()=>remind(${c.session_id}))">Remind</button>${c.status !== 'cancelled' && c.status !== 'completed' ? `<button class="btn sm red" onclick="confirmDo('Cancel this class? Students will be notified.','()=>cancelClass(${c.session_id})')">Cancel</button>` : ''}</div>`])) : empty('No upcoming classes.')}`;
}, 'tutor');
async function createClass() {
  try { await api('/classes', 'POST', classBody('nc')); } catch (e) { const a = $('#ncErr'); a.textContent = e.message; a.hidden = false; throw e; }
  toast('Class scheduled. Students were notified.', 'ok'); render();
}
function editClass(id) { const c = TCL.find((x) => x.session_id === id); modal(`<h3>Edit class</h3>${classFields('ec', window._tc, c)}<div class="row mt"><button class="btn" onclick="act(()=>saveClass(${id}))">Save changes</button><button class="btn sec" onclick="closeModal()">Close</button></div>`); }
async function saveClass(id) { const b = classBody('ec'); delete b.course_id; try { await api('/classes/' + id, 'PUT', b); } catch (e) { const a = $('#ecErr'); a.textContent = e.message; a.hidden = false; throw e; } closeModal(); toast('Class updated.', 'ok'); render(); }
async function cancelClass(id) { await api('/classes/' + id, 'PUT', { status: 'cancelled' }); toast('Class cancelled.', 'ok'); render(); }
async function remind(id) { await api(`/classes/${id}/remind`, 'POST'); toast('Reminder sent to enrolled students.', 'ok'); }
async function showParticipants(id) { const p = await api(`/classes/${id}/participants`); modal(`<h3>Participants (${p.length})</h3>${p.length ? p.map((x) => `<div class="note">${esc(x.name)} <span class="muted small">${esc(x.email)}</span></div>`).join('') : '<p class="muted">No students enrolled.</p>'}<button class="btn mt" onclick="closeModal()">Close</button>`); }
route('/t/students', async () => {
  const s = await api('/tutor/students');
  return `${title('My Students')}${table(['Student', 'Course', 'Progress', 'Enrolled', ''], s.map((x) => [`<b>${esc(x.name)}</b><div class="small muted">${esc(x.email)}</div>`, esc(x.course), `${progressBar(x.progress)}<span class="small">${x.progress}%</span>`, fmtD(x.created_at), `<a class="btn sm sec" href="#/messages/${x.id}">Message</a>`]), 'No students enrolled.')}`;
}, 'tutor');
route('/t/assignments', async () => {
  const [tc, as] = await Promise.all([api('/tutor/courses'), api('/tutor/assignments')]);
  return `${title('Assignments')}<div class="card mb"><h3>Create assignment</h3>${tc.length ? `<div class="alert err" id="aErr" hidden></div><div class="form-grid"><div><label>Course</label><select id="a_course">${tc.map((x) => `<option value="${x.id}">${esc(x.title)}</option>`).join('')}</select></div><div><label>Title</label><input id="a_title"></div><div><label>Deadline</label><input id="a_due" type="date"></div><div><label>Maximum marks</label><input id="a_max" type="number" value="100" min="1"></div></div><label>Instructions</label><textarea id="a_ins"></textarea><button class="btn mt" onclick="act(()=>createAssign())">Create assignment</button>` : empty('No courses created.', 'Create a course first', '#/t/create')}</div>
  ${as.length ? as.map((a) => card(`${esc(a.title)} <span class="badge b-grey">${esc(a.course)}</span>`, `<p class="small muted">Due ${fmtD(a.due_date)} · Max ${a.max_marks} marks · ${a.submissions.length} submission(s)</p>${a.submissions.length ? a.submissions.map((s) => `<div class="card flat mb"><div class="row between"><b>${esc(s.student)}</b>${badge(s.status)}</div><p class="small">${esc(s.content)}</p>
    ${s.status === 'Evaluated' ? `<p class="small"><b>${s.marks}/${a.max_marks}</b> · ${esc(s.feedback)}</p>` : `<div class="row"><input id="mk${s.id}" type="number" min="0" max="${a.max_marks}" placeholder="Marks" style="width:110px"><input id="fb${s.id}" class="grow" placeholder="Feedback for student"><button class="btn sm green" onclick="act(()=>evaluate(${s.id}))">Evaluate</button>${s.status !== 'Under Review' ? `<button class="btn sm sec" onclick="act(()=>reviewSub(${s.id}))">Mark under review</button>` : ''}</div>`}</div>`).join('') : '<p class="muted small">No submissions yet.</p>'}`, 'mb')).join('') : '<div class="empty">No assignments created.</div>'}`;
}, 'tutor');
async function createAssign() {
  try { await api('/assignments', 'POST', { course_id: Number($('#a_course').value), title: $('#a_title').value, due_date: $('#a_due').value, max_marks: $('#a_max').value, instructions: $('#a_ins').value }); } catch (e) { const a = $('#aErr'); a.textContent = e.message; a.hidden = false; throw e; }
  toast('Assignment created. Students were notified.', 'ok'); render();
}
async function evaluate(id) { await api('/submissions/' + id, 'PUT', { marks: $('#mk' + id).value, feedback: $('#fb' + id).value }); toast('Submission evaluated.', 'ok'); render(); }
async function reviewSub(id) { await api('/submissions/' + id, 'PUT', { review_only: true }); toast('Marked as under review.', 'ok'); render(); }
route('/t/reviews', async () => {
  const r = await api('/tutor/reviews'), avg = r.length ? (r.reduce((a, x) => a + x.rating, 0) / r.length).toFixed(1) : '-';
  return `${title('Reviews and Feedback')}<div class="grid g3 mb">${statCard('★', avg, 'Average rating')}${statCard('✎', r.length, 'Total reviews')}</div>${r.length ? r.map((x) => `<div class="card mb"><div class="row between"><b>${esc(x.student)}</b>${stars(x.rating)}</div><div class="small muted">${esc(x.course)} · ${fmtD(x.created_at)}</div><p>${esc(x.review || 'No written review.')}</p></div>`).join('') : empty('No feedback yet.')}`;
}, 'tutor');
route('/t/payments', async () => {
  const p = await api('/tutor/payments'), tot = p.filter((x) => x.status === 'Success').reduce((a, x) => a + x.amount, 0);
  return `${title('Payments')}<div class="grid g3 mb">${statCard('₹', '₹' + tot, 'Total earnings (demo)')}${statCard('✓', p.filter((x) => x.status === 'Success').length, 'Successful payments')}</div>${table(['Transaction', 'Student', 'Course', 'Amount', 'Date', 'Status'], p.map((x) => [esc(x.txn_id), esc(x.student), esc(x.course), '₹' + x.amount, fmtDT(x.created_at), badge(x.status)]), 'No payments yet.')}`;
}, 'tutor');

/* ================= ADMIN PAGES ================= */
route('/a', async () => {
  const d = await api('/admin/stats'), max = Math.max(1, ...d.perCourse.map((c) => c.n));
  return `${title('Admin Dashboard')}<div class="grid g4 mb">${statCard('☻', d.users, 'Total Users')}${statCard('☺', d.students, 'Students')}${statCard('✎', d.tutors, 'Tutors')}${statCard('▤', d.courses, 'Courses')}${statCard('✓', d.enrollments, 'Enrollments')}${statCard('◷', d.activeClasses, 'Active Classes')}${statCard('₹', d.payments, 'Payments')}${statCard('₹', '₹' + d.revenue, 'Revenue (demo)')}</div>
  <div class="card"><h3>Enrollments per course</h3><div class="bars">${d.perCourse.map((c) => `<div class="bar"><span>${esc(c.title)}</span><div><i style="width:${(c.n / max) * 100}%"></i></div><b>${c.n}</b></div>`).join('')}</div></div>`;
}, 'admin');
let AU = [];
async function adminUsers(role) {
  AU = await api('/admin/users' + (role ? '?role=' + role : ''));
  const head = { '': 'Manage Users', student: 'Manage Students', tutor: 'Manage Tutors' }[role || ''];
  return `${title(head)}<div class="row mb"><input id="uq" placeholder="Search by name or email" style="max-width:300px" oninput="filterUsers()"><select id="us" style="max-width:180px" onchange="filterUsers()"><option value="">All statuses</option><option value="active">Active</option><option value="disabled">Disabled</option></select></div>
  <div id="utable"></div>` + (after(filterUsers), '');
}
function filterUsers() {
  const q = $('#uq').value.toLowerCase(), s = $('#us').value, rows = AU.filter((u) => (!s || u.status === s) && (u.name + u.email).toLowerCase().includes(q));
  $('#utable').innerHTML = table(['Name', 'Email', 'Role', 'Status', 'Registered', 'Actions'], rows.map((u) => [`<b>${esc(u.name)}</b>`, esc(u.email), cap(u.role), badge(u.status), fmtD(u.created_at),
    `<div class="row"><button class="btn sm sec" onclick="viewUser(${u.id})">View</button>${u.status === 'active' ? `<button class="btn sm orange" onclick="act(()=>userAct(${u.id},'deactivate'))">Deactivate</button>` : `<button class="btn sm green" onclick="act(()=>userAct(${u.id},'activate'))">Activate</button>`}<button class="btn sm red" onclick="confirmDo('Delete this user and all their data?','()=>userAct(${u.id},\\'delete\\')')">Delete</button></div>`]), 'No users found.');
}
const viewUser = (id) => { const u = AU.find((x) => x.id === id); modal(`<h3>${esc(u.name)}</h3><p>${esc(u.email)}<br>Role: ${cap(u.role)} · ${badge(u.status)}<br>Registered: ${fmtD(u.created_at)}</p><button class="btn" onclick="closeModal()">Close</button>`); };
async function userAct(id, action) { await api('/admin/users/' + id, 'PUT', { action }); toast('User updated.', 'ok'); render(); }
route('/a/users', () => adminUsers(''), 'admin'); route('/a/students', () => adminUsers('student'), 'admin'); route('/a/tutors', () => adminUsers('tutor'), 'admin');
route('/a/courses', async ({ q }) => {
  const c = await api('/admin/courses' + (q.status ? '?status=' + q.status : ''));
  return `${title('Manage Courses')}<div class="tabs">${['', 'draft', 'published', 'rejected', 'archived'].map((s) => `<button class="${(q.status || '') === s ? 'on' : ''}" onclick="go('#/a/courses${s ? '?status=' + s : ''}')">${s ? cap(s) : 'All'}</button>`).join('')}</div>
  ${table(['Course', 'Tutor', 'Price', 'Students', 'Status', 'Actions'], c.map((x) => [`<a href="#/course/${x.id}"><b>${esc(x.title)}</b></a><div class="small muted">${esc(x.category)}</div>`, esc(x.tutor_name), money(x.price), x.students, badge(x.status),
    `<div class="row">${x.status !== 'published' ? `<button class="btn sm green" onclick="act(()=>courseAct(${x.id},'approve'))">Approve</button>` : ''}${x.status !== 'rejected' ? `<button class="btn sm orange" onclick="act(()=>courseAct(${x.id},'reject'))">Reject</button>` : ''}${x.status !== 'archived' ? `<button class="btn sm sec" onclick="act(()=>courseAct(${x.id},'archive'))">Archive</button>` : ''}<button class="btn sm red" onclick="confirmDo('Delete this course permanently?','()=>courseAct(${x.id},\\'delete\\')')">Delete</button></div>`]), 'No courses found.')}`;
}, 'admin');
async function courseAct(id, action) { await api('/admin/courses/' + id, 'PUT', { action }); toast('Course updated.', 'ok'); render(); }
route('/a/categories', async () => {
  const c = await api('/categories');
  return `${title('Manage Categories')}<div class="grid g2"><div class="card"><h3>Add category</h3><form onsubmit="submitForm(event,addCategory)"><div class="alert err" hidden></div><input name="name" required placeholder="e.g. Mathematics"><button class="btn mt" type="submit">Add category</button></form></div>
  <div>${table(['Category', ''], c.map((x) => [esc(x.name), `<button class="btn sm red" onclick="act(()=>delCategory(${x.id}))">Delete</button>`]))}</div></div>`;
}, 'admin');
async function addCategory(d) { await api('/admin/categories', 'POST', d); toast('Category added.', 'ok'); render(); }
async function delCategory(id) { await api('/admin/categories/' + id, 'DELETE'); toast('Category removed.', 'ok'); render(); }
const label = (k) => cap(k.replace(/_/g, ' '));
function reportPage(type, headTitle, del) {
  return async () => {
    const rows = await api('/admin/report/' + type), keys = rows[0] ? Object.keys(rows[0]).filter((k) => k !== 'id' || del) : [];
    return `${title(headTitle, `<button class="btn sec sm" onclick="act(()=>downloadCSV('${type}'))">Download CSV</button>`)}${table([...keys.filter((k) => k !== 'id').map(label), ...(del ? [''] : [])], rows.map((r) => [...keys.filter((k) => k !== 'id').map((k) => (k === 'status' ? badge(r[k]) : k === 'rating' ? stars(r[k]) : k === 'created_at' ? fmtDT(r[k]) : esc(r[k]))), ...(del ? [`<button class="btn sm red" onclick="confirmDo('Delete this record?','()=>delItem(\\'${del}\\',${r.id})')">Delete</button>`] : [])]), 'No records found.')}`;
  };
}
async function delItem(type, id) { await api(`/admin/${type}/${id}`, 'DELETE'); toast('Record deleted.', 'ok'); render(); }
route('/a/enrollments', reportPage('enrollments', 'Manage Enrollments', 'enrollments'), 'admin');
route('/a/classes', reportPage('classes', 'Manage Classes', 'classes'), 'admin');
route('/a/assignments', reportPage('assignments', 'Manage Assignments', 'assignments'), 'admin');
route('/a/feedback', reportPage('feedback', 'Manage Feedback', 'feedback'), 'admin');
route('/a/payments', reportPage('payments', 'Manage Payments', ''), 'admin');
async function downloadCSV(type) {
  const rows = await api('/admin/report/' + type); if (!rows.length) throw new Error('There is no data to download.');
  const k = Object.keys(rows[0]), csv = [k.join(','), ...rows.map((r) => k.map((x) => '"' + String(r[x] ?? '').replace(/"/g, '""') + '"').join(','))].join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `${type}-report.csv`; a.click(); toast('Report downloaded.', 'ok');
}
route('/a/reports', async ({ q }) => {
  const T = { users: 'User Report', courses: 'Course Report', enrollments: 'Enrollment Report', payments: 'Payment Report', feedback: 'Feedback Report', activity: 'System Activity Report' }, t = q.t || 'users';
  const rows = t === 'activity' ? (await api('/admin/monitor')).activity.map((a) => ({ time: a.at, event: a.text })) : await api('/admin/report/' + t), keys = rows[0] ? Object.keys(rows[0]).filter((k) => k !== 'id') : [];
  return `${title('Reports', `<button class="btn sec sm" onclick="window.print()">Print</button>${t !== 'activity' ? `<button class="btn sm" onclick="act(()=>downloadCSV('${t}'))">Download CSV</button>` : ''}`)}<div class="tabs">${Object.entries(T).map(([k, v]) => `<button class="${k === t ? 'on' : ''}" onclick="go('#/a/reports?t=${k}')">${v}</button>`).join('')}</div>
  <p class="muted small">${rows.length} record(s)</p>${table(keys.map(label), rows.map((r) => keys.map((k) => (k === 'status' ? badge(r[k]) : esc(r[k])))), 'No data for this report yet.')}`;
}, 'admin');
route('/a/monitor', async () => {
  const m = await api('/admin/monitor');
  const list = (h, a, f) => card(h, a.length ? a.map((x) => `<div class="note">${f(x)}</div>`).join('') : '<p class="muted">Nothing yet.</p>');
  return `${title('System Monitoring', '<button class="btn sec sm" onclick="render()">↻ Refresh</button>')}<div class="grid g4 mb">${statCard('◉', m.status, 'System status')}${statCard('☺', m.activeUsers, 'Active users (15 min)')}${statCard('⇄', m.requests, 'Total requests')}${statCard('!', m.errors, 'Server errors')}</div>
  <p class="muted small">Application uptime: ${m.uptimeMin} minute(s). This is an application-level monitor for the demo.</p>
  <div class="grid g2">${list('Recent activities', m.activity, (a) => `${esc(a.text)}<div class="muted small">${fmtDT(a.at.replace('T', ' ').slice(0, 19))}</div>`)}${list('Recent registrations', m.regs, (r) => `${esc(r.name)} <span class="badge">${cap(r.role)}</span>`)}
  ${list('Recent enrollments', m.enrolls, (e) => `${esc(e.student)} → ${esc(e.course)}`)}${list('Recent payments', m.pays, (p) => `${esc(p.student)} · ${esc(p.course)} · ₹${p.amount} ${badge(p.status)}`)}</div>`;
}, 'admin');

/* ---------- start ---------- */
render();
