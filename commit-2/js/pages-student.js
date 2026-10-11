'use strict';
/* Student pages: dashboard, my courses, learning view, checkout (mock payment), receipt, classes, assignments, payments */
(function () {
  function joinBtn(s, label) {
    if (s.status === 'cancelled' || s.status === 'completed') return '<span class="mute">' + (s.status === 'cancelled' ? 'Cancelled' : 'Ended') + '</span>';
    return '<button class="btn sm primary" data-act="join" data-id="' + s.id + '">' + (label || 'Join Class') + '</button>';
  }
  App.joinBtn = joinBtn;
  /* Join Class: opens the stored Zoom link in a new tab. The meeting itself runs inside Zoom, not in this app. */
  App.actions.join = function (el) {
    var link = P2P.joinClass(App.me().id, el.dataset.id);
    var a = document.createElement('a'); a.href = link; a.target = '_blank'; a.rel = 'noopener noreferrer';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Opening Zoom in a new tab\u2026');
  };

  function classRows(list, showTutor) {
    return table(['Class', 'When', showTutor ? 'Tutor' : 'Course', 'Status', ''], list.map(function (s) {
      return ['<strong>' + esc(s.title) + '</strong><div class="mute">' + esc(s.course_title) + '</div>', fmtDate(s.date) + '<div class="mute">' + fmtTime(s.start_time) + ' – ' + fmtTime(s.end_time) + '</div>', esc(showTutor ? s.tutor_name : s.course_title), badge(s.status), joinBtn(s)];
    }));
  }

  App.route('/dashboard', 'student', function (c) {
    c.title = 'Dashboard';
    var d = P2P.studentDashboard(c.user.id);
    return '<h1>Hello, ' + esc(c.user.name.split(' ')[0]) + '</h1><div class="kpis"><div><b>' + d.enrolled + '</b><span>Enrolled courses</span></div><div><b>' + d.completed + '</b><span>Completed</span></div><div><b>' + d.hours + '</b><span>Learning hours</span></div><div><b>' + d.pending + '</b><span>Pending assignments</span></div></div>' +
      '<h2>Upcoming classes</h2>' + (d.classes.length ? classRows(d.classes, true) : empty('No upcoming classes.', '#/courses', 'Browse courses')) +
      '<h2>My courses</h2>' + (d.courses.length ? '<div class="grid3">' + d.courses.slice(0, 3).map(courseProgress).join('') + '</div>' : empty('You have not enrolled in any course yet.', '#/courses', 'Browse courses')) +
      '<div class="two"><div><h2>Recent messages</h2>' + (d.messages.length ? '<ul class="notes">' + d.messages.map(function (m) { return '<li><span><strong>' + esc(m.name) + '</strong>: ' + esc(m.body) + '</span><small>' + ago(m.created_at) + '</small></li>'; }).join('') + '</ul>' : empty('No messages.')) + '</div>' +
      '<div><h2>Notifications</h2>' + (d.notifications.length ? '<ul class="notes">' + d.notifications.map(function (n) { return '<li class="' + (n.is_read ? '' : 'unread') + '"><span>' + esc(n.text) + '</span></li>'; }).join('') + '</ul>' : empty('No notifications.')) + '</div></div>' +
      '<h2>Recommended for you</h2>' + (d.recommended.length ? '<div class="grid4">' + d.recommended.map(App.card).join('') + '</div>' : empty('No recommendations right now.'));
  });

  function courseProgress(c) {
    return '<div class="card"><a href="#/learn/' + c.id + '">' + thumb(c) + '</a><div class="card-b"><h3>' + esc(c.title) + '</h3><div class="meta">by ' + esc(c.tutor_name) + '</div><div class="bar-bg"><i style="width:' + c.progress + '%"></i></div><div class="foot"><span class="mute">' + c.progress + '% complete</span><a href="#/learn/' + c.id + '">' + (c.progress ? 'Continue' : 'Start') + '</a></div></div></div>';
  }

  App.route('/my-courses', 'student', function (c) {
    c.title = 'My courses';
    var list = P2P.myCourses(c.user.id);
    return '<h1>My courses</h1>' + (list.length ? '<div class="grid3">' + list.map(courseProgress).join('') + '</div>' : empty('You have not enrolled in any course yet.', '#/courses', 'Browse courses'));
  });

  App.route('/learn/:id', 'student', function (c) {
    var d = P2P.courseDetail(c.params[0], c.user);
    if (!d.enrolled) return stateBox('Not enrolled', 'Please enroll in this course to open the lessons.', '#/course/' + d.id, 'View course');
    c.title = d.title;
    var cur = d.lessons.filter(function (l) { return String(l.id) === c.q.l; })[0] || d.lessons.filter(function (l) { return !l.done; })[0] || d.lessons[0];
    var done = d.lessons.filter(function (l) { return l.done; }).length, pct = d.lessons.length ? Math.round(done / d.lessons.length * 100) : 0;
    var classes = P2P.classes(c.user).filter(function (s) { return s.course_id === d.id && (s.status === 'scheduled' || s.status === 'live'); });
    var asg = P2P.assignmentsFor(c.user.id).filter(function (a) { return a.course_id === d.id; });
    return '<div class="row between"><h1>' + esc(d.title) + '</h1><a href="#/course/' + d.id + '">Course page</a></div><div class="bar-bg"><i style="width:' + pct + '%"></i></div><p class="mute">' + pct + '% complete (' + done + ' of ' + d.lessons.length + ' lessons)</p>' +
      (d.lessons.length ? '<div class="learn"><nav class="lessons">' + d.lessons.map(function (l) { return '<a href="#/learn/' + d.id + '?l=' + l.id + '" class="' + (cur && l.id === cur.id ? 'on' : '') + '"><span>' + (l.done ? '✓' : '○') + '</span> ' + esc(l.title) + '<small>' + esc(l.module) + '</small></a>'; }).join('') + '</nav>' +
        '<article class="lesson"><h2>' + esc(cur.title) + '</h2><p>' + esc(cur.content) + '</p>' + (cur.resource_url ? '<p><a href="' + esc(cur.resource_url) + '" target="_blank" rel="noopener noreferrer">Open resource</a></p>' : '') +
        '<button class="btn ' + (cur.done ? '' : 'primary') + '" data-act="lessonDone" data-id="' + cur.id + '" data-done="' + (cur.done ? 0 : 1) + '">' + (cur.done ? 'Mark as not done' : 'Mark as complete') + '</button></article></div>' : empty('No lessons have been added to this course yet.')) +
      '<h2>Upcoming classes</h2>' + (classes.length ? classRows(classes, true) : empty('No classes scheduled for this course.')) +
      '<h2>Assignments</h2>' + (asg.length ? table(['Assignment', 'Due', 'Status'], asg.map(function (a) { return [esc(a.title), fmtDate(a.due_date), a.sub ? badge(a.sub.status) : '<a href="#/assignments">Submit</a>']; })) : empty('No assignments for this course.'));
  });
  App.actions.lessonDone = function (el) { P2P.setLessonDone(App.me().id, el.dataset.id, el.dataset.done === '1'); App.render(); };

  /* ---------- checkout (MOCK payment) ---------- */
  App.route('/checkout/:id', 'student', function (c) {
    var d = P2P.courseDetail(c.params[0], c.user); c.title = 'Checkout';
    if (d.enrolled) return stateBox('Already enrolled', 'You are already enrolled in this course.', '#/learn/' + d.id, 'Open course');
    if (d.price <= 0) return stateBox('This course is free', 'No payment is needed.', '#/course/' + d.id, 'Back to course');
    return '<h1>Checkout</h1><div class="two"><form data-form="checkout" class="stack" data-course="' + d.id + '"><p class="note">Demo payment – no real money is charged. Use any card number with 16 digits. A card ending in <code>0000</code> simulates a failed payment.</p>' +
      '<fieldset><legend>Payment method</legend><label class="check"><input type="radio" name="method" value="Card" checked> Card</label><label class="check"><input type="radio" name="method" value="UPI"> UPI</label><label class="check"><input type="radio" name="method" value="Net Banking"> Net banking</label></fieldset>' +
      '<div data-pay="Card"><label>Card number<input name="card" placeholder="4111 1111 1111 1111" inputmode="numeric"></label><div class="row gap"><label>Expiry (MM/YY)<input name="exp" placeholder="08/28"></label><label>CVV<input name="cvv" placeholder="123" inputmode="numeric" maxlength="4"></label></div></div>' +
      '<div data-pay="UPI" hidden><label>UPI ID<input name="upi" placeholder="name@bank"></label></div><div data-pay="Net Banking" hidden><label>Bank<select name="bank">' + opts(['State Bank', 'HDFC Bank', 'ICICI Bank', 'Axis Bank']) + '</select></label></div>' +
      '<p class="err" hidden></p><button class="btn primary block">Pay ' + money(d.price) + '</button></form><div class="summary"><h3>Order summary</h3><p><strong>' + esc(d.title) + '</strong></p><p class="mute">by ' + esc(d.tutor_name) + '</p><p class="price">' + money(d.price) + '</p></div></div>';
  });
  App.changes.push(function (e) {
    if (e.target.name !== 'method') return;
    document.querySelectorAll('[data-pay]').forEach(function (x) { x.hidden = x.dataset.pay !== e.target.value; });
  });
  App.forms.checkout = function (f, d) {
    if (d.method === 'Card') {
      if (!/^\d{16}$/.test((d.card || '').replace(/\s/g, ''))) throw new Error('Please enter a valid 16-digit card number.');
      var m = /^(\d{2})\/(\d{2})$/.exec(d.exp || '');
      if (!m || +m[1] < 1 || +m[1] > 12) throw new Error('Please enter the expiry date as MM/YY.');
      var now = new Date(); if (2000 + +m[2] < now.getFullYear() || (2000 + +m[2] === now.getFullYear() && +m[1] < now.getMonth() + 1)) throw new Error('This card has expired.');
      if (!/^\d{3,4}$/.test(d.cvv || '')) throw new Error('Please enter a valid CVV.');
    } else if (d.method === 'UPI' && !/^[\w.\-]{2,}@[\w]{2,}$/.test(d.upi || '')) throw new Error('Please enter a valid UPI ID.');
    var r = P2P.processMockPayment(App.me().id, { course_id: f.dataset.course, method: d.method, card: d.card });
    toast('Payment successful.'); go('/receipt/' + r.id);
  };
  App.route('/receipt/:id', 'auth', function (c) {
    c.title = 'Receipt';
    var r = P2P.generateReceipt(Number(c.params[0]), c.user.id);
    return '<div class="receipt"><h1>Payment receipt</h1><p class="mute">' + r.receipt_no + ' · ' + fmtDate(r.created_at) + '</p><table><tbody><tr><td>Student</td><td>' + esc(r.student) + '</td></tr><tr><td>Course</td><td>' + esc(r.course) + '</td></tr><tr><td>Tutor</td><td>' + esc(r.tutor) + '</td></tr><tr><td>Method</td><td>' + esc(r.method) + '</td></tr><tr><td>Transaction</td><td>' + esc(r.txn_id) + '</td></tr><tr><td>Status</td><td>' + badge(r.status) + '</td></tr><tr><td><strong>Amount</strong></td><td><strong>' + money(r.amount) + '</strong></td></tr></tbody></table>' +
      '<p class="mute">Simulated payment for demonstration only.</p><div class="row noprint"><button class="btn" data-act="print">Print receipt</button><a class="btn primary" href="#/my-courses">Go to my courses</a></div></div>';
  });
  App.route('/payments', 'student', function (c) {
    c.title = 'Payments';
    var list = P2P.myPayments(c.user.id);
    return '<h1>Payment history</h1>' + (list.length ? table(['Date', 'Course', 'Amount', 'Method', 'Status', ''], list.map(function (p) { return [fmtDate(p.created_at), esc(p.course), money(p.amount), esc(p.method), badge(p.status), p.status === 'Success' ? '<a href="#/receipt/' + p.id + '">Receipt</a>' : '']; })) : empty('No payments yet.'));
  });

  App.route('/classes', 'student', function (c) {
    c.title = 'Classes';
    var all = P2P.classes(c.user), up = all.filter(function (s) { return s.status === 'scheduled' || s.status === 'live'; }), past = all.filter(function (s) { return s.status === 'completed' || s.status === 'cancelled'; }).reverse();
    return '<h1>Scheduled classes</h1><p class="mute">Classes run on Zoom. Join Class opens the meeting link in a new tab.</p><h2>Upcoming</h2>' + (up.length ? classRows(up, true) : empty('No upcoming classes. Enroll in a course to see its classes here.', '#/courses', 'Browse courses')) +
      '<h2>Past and cancelled</h2>' + (past.length ? classRows(past, true) : empty('Nothing here yet.'));
  });

  App.route('/assignments', 'student', function (c) {
    c.title = 'Assignments';
    var list = P2P.assignmentsFor(c.user.id);
    return '<h1>Assignments</h1>' + (list.length ? list.map(function (a) {
      var s = a.sub;
      return '<div class="panel"><div class="row between"><div><strong>' + esc(a.title) + '</strong><div class="mute">' + esc(a.course) + ' · due ' + fmtDate(a.due_date) + ' · ' + a.max_marks + ' marks</div></div>' + (s ? badge(s.status) : badge('Pending')) + '</div><p>' + esc(a.instructions) + '</p>' +
        (s ? '<p class="mute">Your submission: ' + esc(s.content) + '</p>' + (s.status === 'Evaluated' ? '<p><strong>Marks: ' + s.marks + '/' + a.max_marks + '</strong> – ' + esc(s.feedback || 'No feedback.') + '</p>' : '') :
          '<form data-form="submit" class="stack" data-id="' + a.id + '"><label>Your answer or a link to your work<textarea name="content" rows="3" maxlength="5000"></textarea></label><p class="err" hidden></p><button class="btn primary">Submit assignment</button></form>') + '</div>';
    }).join('') : empty('No assignments yet. They appear here after you enroll in a course.', '#/courses', 'Browse courses'));
  });
  App.forms.submit = function (f, d) { var st = P2P.submitAssignment(App.me().id, f.dataset.id, d); toast(st === 'Late' ? 'Submitted (marked late).' : 'Assignment submitted.'); App.render(); };
})();
