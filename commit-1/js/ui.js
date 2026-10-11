'use strict';
/* Peer2Peer Learn - UI helpers, layout and hash router (plain script, works from file://) */

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function fmtDate(d) { if (!d) return ''; return new Date(String(d).length > 10 ? d : d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
function fmtTime(t) { var p = String(t).split(':'), h = +p[0]; return ((h % 12) || 12) + ':' + p[1] + ' ' + (h < 12 ? 'AM' : 'PM'); }
function ago(iso) { var s = (Date.now() - new Date(iso).getTime()) / 1000; if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago'; if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return Math.floor(s / 86400) + ' d ago'; }
function money(n) { return n > 0 ? '₹' + n : 'Free'; }
function stars(r) { var n = Math.round(r || 0); return '<span class="stars" aria-label="' + (r || 0) + ' out of 5">' + '★'.repeat(n) + '☆'.repeat(5 - n) + '</span>'; }
function badge(s) { return '<span class="badge b-' + String(s).toLowerCase().replace(/\s+/g, '') + '">' + esc(s) + '</span>'; }
function initials(n) { return String(n).split(/\s+/).map(function (x) { return x[0]; }).slice(0, 2).join('').toUpperCase(); }
function avatar(u, big) { return u && u.avatar ? '<img class="avatar' + (big ? ' big' : '') + '" src="' + u.avatar + '" alt="">' : '<span class="avatar' + (big ? ' big' : '') + '">' + esc(initials(u ? u.name : '?')) + '</span>'; }
function thumb(c) { return c.thumb ? '<img class="thumb" src="' + c.thumb + '" alt="">' : '<div class="thumb">' + esc(c.title[0]) + '</div>'; }
function empty(msg, linkHref, linkText) { return '<div class="state"><p>' + esc(msg) + '</p>' + (linkHref ? '<a class="btn" href="' + linkHref + '">' + esc(linkText) + '</a>' : '') + '</div>'; }
function stateBox(title, msg, href, text) { return '<div class="state big"><h2>' + esc(title) + '</h2><p>' + esc(msg) + '</p>' + (href ? '<a class="btn" href="' + href + '">' + esc(text) + '</a>' : '') + '</div>'; }
function table(heads, rows) { return '<div class="tbl-wrap"><table><thead><tr>' + heads.map(function (h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>' + rows.map(function (r) { return '<tr>' + r.map(function (c) { return '<td>' + c + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>'; }
function opts(list, sel, blank) { return (blank ? '<option value="">' + esc(blank) + '</option>' : '') + list.map(function (o) { var v = typeof o === 'object' ? o.v : o, t = typeof o === 'object' ? o.t : o; return '<option value="' + esc(v) + '"' + (String(v) === String(sel) ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join(''); }
function go(path) { var h = '#' + path; if (location.hash === h) App.render(); else location.hash = h; }
function toast(msg, type) {
  var t = document.getElementById('toast'); if (!t) return;
  t.textContent = msg; t.className = 'toast show ' + (type || ''); clearTimeout(toast._t);
  toast._t = setTimeout(function () { t.className = 'toast'; }, 3500);
}
var _confirmCb = null;
function confirmBox(msg, cb, yes) {
  _confirmCb = cb; var m = document.getElementById('modal');
  m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true"><p>' + esc(msg) + '</p><div class="row end"><button class="btn" data-act="modalNo">Cancel</button><button class="btn primary" data-act="modalYes">' + esc(yes || 'Confirm') + '</button></div></div>';
  m.hidden = false;
}
function showModal(html) { var m = document.getElementById('modal'); m.innerHTML = '<div class="modal-box" role="dialog" aria-modal="true">' + html + '<div class="row end"><button class="btn" data-act="modalNo">Close</button></div></div>'; m.hidden = false; }
function closeModal() { var m = document.getElementById('modal'); m.hidden = true; m.innerHTML = ''; _confirmCb = null; }
function readImage(input) {
  return new Promise(function (resolve, reject) {
    var f = input && input.files && input.files[0]; if (!f) return resolve(null);
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) return reject(new Error('Please choose a PNG, JPG, WEBP or GIF image.'));
    if (f.size > 150 * 1024) return reject(new Error('Image is too large (max 150 KB).'));
    var r = new FileReader(); r.onload = function () { resolve(r.result); }; r.onerror = function () { reject(new Error('Could not read the image.')); }; r.readAsDataURL(f);
  });
}
function formData(f) {
  var o = {};
  Array.prototype.forEach.call(f.elements, function (el) {
    if (!el.name || el.type === 'file' || el.type === 'submit' || el.type === 'button') return;
    if (el.type === 'checkbox') o[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
    else o[el.name] = el.value;
  });
  return o;
}
function csv(rows) {
  if (!rows.length) return '';
  var keys = Object.keys(rows[0]), q = function (v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; };
  return [keys.map(q).join(',')].concat(rows.map(function (r) { return keys.map(function (k) { return q(r[k]); }).join(','); })).join('\r\n');
}

var App = (function () {
  var A = { routes: [], actions: {}, forms: {}, changes: [], afterRender: [], after: null, nav: {}, homes: { student: '/dashboard', tutor: '/tutor', admin: '/admin' } };

  A.nav.student = [['/dashboard', 'Dashboard'], ['/courses', 'Browse courses'], ['/my-courses', 'My courses'], ['/classes', 'Classes'], ['/assignments', 'Assignments'], ['/messages', 'Messages'], ['/notifications', 'Notifications'], ['/payments', 'Payments'], ['/profile', 'Profile']];
  A.nav.tutor = [['/tutor', 'Dashboard'], ['/tutor/courses', 'My courses'], ['/tutor/classes', 'Classes'], ['/tutor/assignments', 'Assignments'], ['/tutor/students', 'Students'], ['/tutor/reviews', 'Reviews'], ['/tutor/earnings', 'Earnings'], ['/messages', 'Messages'], ['/notifications', 'Notifications'], ['/profile', 'Profile']];
  A.nav.admin = [['/admin', 'Dashboard'], ['/admin/users', 'Users'], ['/admin/courses', 'Courses'], ['/admin/reports', 'Reports'], ['/admin/monitor', 'Monitoring'], ['/admin/categories', 'Categories'], ['/messages', 'Messages'], ['/notifications', 'Notifications'], ['/profile', 'Profile']];

  A.route = function (path, access, fn, layout) { A.routes.push({ re: new RegExp('^' + path.replace(/:id/g, '(\\d+)') + '$'), access: access, fn: fn, layout: layout }); };
  A.hasRoute = function (p) { return A.routes.some(function (r) { return r.re.test(p); }); };
  A.homeFor = function (u) { var h = A.homes[u.role]; return A.hasRoute(h) ? h : '/courses'; };

  function pubHeader(u) {
    return '<header class="top"><div class="container bar"><a class="brand" href="#/">Peer2Peer <span>Learn</span></a><nav class="links"><a href="#/courses">Courses</a>' +
      (u ? '<a href="#' + A.homeFor(u) + '">Dashboard</a><a href="#" data-act="logout">Log out</a>' : '<a href="#/login">Log in</a><a class="btn primary sm" href="#/register">Sign up</a>') + '</nav></div></header>';
  }
  function pubFooter() { return '<footer class="foot"><div class="container"><span>Peer2Peer Learn · Learn from peers. Teach what you know.</span><span class="mute">Academic demo project – payments are simulated.</span></div></footer>'; }
  function appHeader(u) {
    var unread = P2P.notifications(u.id).filter(function (n) { return !n.is_read; }).length;
    return '<header class="top"><div class="bar wide"><button class="burger" data-act="toggleNav" aria-label="Menu">☰</button><a class="brand" href="#/">Peer2Peer <span>Learn</span></a><span class="grow"></span>' +
      '<a class="bell" href="#/notifications" title="Notifications">Alerts' + (unread ? ' <b>' + unread + '</b>' : '') + '</a><a class="who" href="#/profile">' + avatar(u) + '<span>' + esc(u.name) + '</span></a><a href="#" data-act="logout" class="out">Log out</a></div></header>';
  }
  function side(u, path) {
    var items = (A.nav[u.role] || []).filter(function (n) { return A.hasRoute(n[0]); });
    return '<aside class="side"><div class="role">' + esc(u.role) + '</div>' + items.map(function (n) {
      var on = path === n[0] || (n[0].split('/').length > 2 && path.indexOf(n[0] + '/') === 0);
      return '<a href="#' + n[0] + '"' + (on ? ' class="on"' : '') + '>' + n[1] + '</a>';
    }).join('') + '</aside>';
  }
  function layout(ctx, kind, body) {
    document.title = (ctx.title ? ctx.title + ' · ' : '') + 'Peer2Peer Learn';
    if (kind === 'app') return appHeader(ctx.user) + '<div class="shell">' + side(ctx.user, ctx.path) + '<main class="main">' + body + '</main></div>';
    return pubHeader(ctx.user) + '<main>' + (ctx.wide ? body : '<div class="container page">' + body + '</div>') + '</main>' + pubFooter();
  }

  A.render = function () {
    var raw = location.hash.replace(/^#/, '') || '/', q = {}, i = raw.indexOf('?');
    if (i >= 0) { raw.slice(i + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); }); raw = raw.slice(0, i); }
    var user = P2P.current();
    if (user) P2P.touch(user.id);
    document.body.classList.remove('nav-open');
    var route = null, params = [];
    for (var k = 0; k < A.routes.length; k++) { var m = raw.match(A.routes[k].re); if (m) { route = A.routes[k]; params = m.slice(1); break; } }
    var ctx = { user: user, params: params, q: q, path: raw, title: '' }, html;
    if (!route) { html = layout(ctx, user ? 'app' : 'public', stateBox('Page not found', 'The page you are looking for does not exist.', '#/', 'Go to home')); }
    else if (route.access === 'guest' && user) { return go(A.homeFor(user)); }
    else if (['student', 'tutor', 'admin', 'auth'].indexOf(route.access) >= 0 && !user) { A.after = raw; return go('/login'); }
    else if (['student', 'tutor', 'admin'].indexOf(route.access) >= 0 && user.role !== route.access) { html = layout(ctx, 'app', stateBox('Unauthorized access', 'You do not have permission to open this page.', '#' + A.homeFor(user), 'Back to dashboard')); }
    else {
      try { var body = route.fn(ctx); html = layout(ctx, user && route.layout !== 'public' ? 'app' : 'public', body); }
      catch (err) { html = layout(ctx, user ? 'app' : 'public', stateBox('Could not load this page', err.message, '#/courses', 'Browse courses')); }
    }
    document.getElementById('app').innerHTML = html;
    A.afterRender.forEach(function (f) { try { f(ctx); } catch (e) { /* ignore */ } });
    window.scrollTo(0, 0);
  };

  /* shared actions */
  A.actions.logout = function () { P2P.endSession(); toast('You have been logged out.'); go('/'); };
  A.actions.toggleNav = function () { document.body.classList.toggle('nav-open'); };
  A.actions.modalNo = function () { closeModal(); };
  A.actions.modalYes = function () { var cb = _confirmCb; closeModal(); if (cb) cb(); };
  A.actions.print = function () { window.print(); };
  A.actions.removeRow = function (el) { var r = el.closest('.lrow'); if (r) r.remove(); };

  document.addEventListener('click', function (e) {
    var el = e.target.closest('[data-act]'); if (!el) return;
    var fn = A.actions[el.dataset.act]; if (!fn) return;
    e.preventDefault();
    try { fn(el, e); } catch (err) { toast(err.message, 'error'); }
  });
  document.addEventListener('submit', function (e) {
    var f = e.target.closest('form[data-form]'); if (!f) return;
    e.preventDefault();
    var box = f.querySelector('.err'); if (box) { box.textContent = ''; box.hidden = true; }
    var fn = A.forms[f.dataset.form]; if (!fn) return;
    var data = formData(f); data._action = e.submitter ? e.submitter.value : '';
    Promise.resolve().then(function () { return fn(f, data); }).catch(function (err) {
      if (box) { box.textContent = err.message; box.hidden = false; box.scrollIntoView({ block: 'nearest' }); } else toast(err.message, 'error');
    });
  });
  document.addEventListener('input', function (e) { var f = e.target.closest('form[data-filter]'); if (f && A.filter) A.filter(f); });
  document.addEventListener('change', function (e) { A.changes.forEach(function (fn) { fn(e); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });
  window.addEventListener('hashchange', function () { A.render(); });
  return A;
})();
