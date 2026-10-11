'use strict';
/* Admin pages: dashboard, user management, course moderation, reports, monitoring, categories */
(function () {
  App.route('/admin', 'admin', function (c) {
    c.title = 'Dashboard';
    var s = P2P.adminStats(), max = Math.max.apply(null, s.perCourse.map(function (x) { return x.n; }).concat([1]));
    return '<h1>Admin dashboard</h1><div class="kpis"><div><b>' + s.users + '</b><span>Users</span></div><div><b>' + s.courses + '</b><span>Courses</span></div><div><b>' + s.enrollments + '</b><span>Enrollments</span></div><div><b>₹' + s.revenue + '</b><span>Revenue (simulated)</span></div></div>' +
      '<div class="kpis"><div><b>' + s.students + '</b><span>Students</span></div><div><b>' + s.tutors + '</b><span>Tutors</span></div><div><b>' + s.payments + '</b><span>Payments</span></div><div><b>' + s.activeClasses + '</b><span>Upcoming classes</span></div></div>' +
      '<h2>Enrollments per course</h2><div class="bars">' + s.perCourse.map(function (x) { return '<div class="bar-row"><span>' + esc(x.title) + '</span><div class="bar-bg"><i style="width:' + Math.round(x.n / max * 100) + '%"></i></div><b>' + x.n + '</b></div>'; }).join('') + '</div>' +
      '<div class="row gap wrap"><a class="btn" href="#/admin/users">Manage users</a><a class="btn" href="#/admin/courses">Manage courses</a><a class="btn" href="#/admin/reports">View reports</a></div>';
  });

  App.route('/admin/users', 'admin', function (c) {
    c.title = 'Users';
    var role = c.q.role || '', list = P2P.adminUsers(role);
    var tabs = [['', 'All'], ['student', 'Students'], ['tutor', 'Tutors'], ['admin', 'Admins']].map(function (t) { return '<a class="tab' + (t[0] === role ? ' on' : '') + '" href="#/admin/users' + (t[0] ? '?role=' + t[0] : '') + '">' + t[1] + '</a>'; }).join('');
    return '<h1>Users</h1><div class="tabs">' + tabs + '</div>' + (list.length ? table(['Name', 'Email', 'Role', 'Status', 'Last seen', ''], list.map(function (u) {
      var self = u.id === c.user.id;
      return [avatar(u) + ' ' + esc(u.name), esc(u.email), esc(u.role), badge(u.status), u.last_seen ? ago(u.last_seen) : '–', self ? '<span class="mute">You</span>' :
        (u.status === 'active' ? '<a href="#" data-act="userAct" data-do="deactivate" data-id="' + u.id + '">Deactivate</a>' : '<a href="#" data-act="userAct" data-do="activate" data-id="' + u.id + '">Activate</a>') + ' · <a href="#" data-act="userAct" data-do="delete" data-id="' + u.id + '">Delete</a>'];
    })) : empty('No users found.'));
  });
  App.actions.userAct = function (el) {
    var run = function () { P2P.manageUser(App.me(), el.dataset.id, el.dataset.do); toast('User updated.'); App.render(); };
    if (el.dataset.do === 'activate') run(); else confirmBox(el.dataset.do === 'delete' ? 'Permanently delete this user and their data?' : 'Deactivate this user? They will not be able to log in.', function () { try { run(); } catch (e) { toast(e.message, 'error'); } }, el.dataset.do === 'delete' ? 'Delete' : 'Deactivate');
  };

  App.route('/admin/courses', 'admin', function (c) {
    c.title = 'Courses';
    var st = c.q.status || '', list = P2P.adminCourses(st);
    var tabs = [['', 'All'], ['published', 'Published'], ['draft', 'Draft'], ['rejected', 'Rejected'], ['archived', 'Archived']].map(function (t) { return '<a class="tab' + (t[0] === st ? ' on' : '') + '" href="#/admin/courses' + (t[0] ? '?status=' + t[0] : '') + '">' + t[1] + '</a>'; }).join('');
    return '<h1>Courses</h1><div class="tabs">' + tabs + '</div>' + (list.length ? table(['Course', 'Tutor', 'Status', 'Students', ''], list.map(function (x) {
      return ['<a href="#/course/' + x.id + '">' + esc(x.title) + '</a>', esc(x.tutor_name), badge(x.status), x.students, '<a href="#" data-act="courseAct" data-do="approve" data-id="' + x.id + '">Approve</a> · <a href="#" data-act="courseAct" data-do="reject" data-id="' + x.id + '">Reject</a> · <a href="#" data-act="courseAct" data-do="archive" data-id="' + x.id + '">Archive</a> · <a href="#" data-act="courseAct" data-do="delete" data-id="' + x.id + '">Delete</a>'];
    })) : empty('No courses in this view.'));
  });
  App.actions.courseAct = function (el) {
    var run = function () { P2P.manageCourse(App.me(), el.dataset.id, el.dataset.do); toast('Course updated.'); App.render(); };
    if (el.dataset.do === 'delete') confirmBox('Delete this course permanently?', run, 'Delete'); else run();
  };

  var REPORTS = [['users', 'Users'], ['courses', 'Courses'], ['enrollments', 'Enrollments'], ['classes', 'Classes'], ['assignments', 'Assignments'], ['feedback', 'Feedback'], ['payments', 'Payments'], ['activity', 'Activity log']];
  App.route('/admin/reports', 'admin', function (c) {
    var type = c.q.type || 'users', rows = P2P.report(type); c.title = 'Reports';
    var tabs = REPORTS.map(function (t) { return '<a class="tab' + (t[0] === type ? ' on' : '') + '" href="#/admin/reports?type=' + t[0] + '">' + t[1] + '</a>'; }).join('');
    var keys = rows.length ? Object.keys(rows[0]) : [];
    return '<div class="row between"><h1>Reports</h1><div class="row gap noprint"><button class="btn sm" data-act="csv" data-type="' + type + '">Export CSV</button><button class="btn sm" data-act="print">Print</button></div></div><div class="tabs">' + tabs + '</div>' +
      (rows.length ? '<p class="mute">' + rows.length + ' records</p>' + table(keys.map(function (k) { return esc(k.charAt(0).toUpperCase() + k.slice(1)); }), rows.map(function (r) { return keys.map(function (k) { return esc(r[k]); }); })) : empty('No records for this report.'));
  });
  App.actions.csv = function (el) {
    var data = csv(P2P.report(el.dataset.type)); if (!data) throw new Error('Nothing to export.');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data], { type: 'text/csv' })); a.download = 'peer2peer-' + el.dataset.type + '-report.csv'; document.body.appendChild(a); a.click(); a.remove();
  };

  App.route('/admin/monitor', 'admin', function (c) {
    c.title = 'Monitoring';
    var m = P2P.monitor();
    var li = function (a) { return a.length ? '<ul class="notes">' + a.join('') + '</ul>' : empty('Nothing yet.'); };
    return '<div class="row between"><h1>System monitoring</h1><button class="btn sm" data-act="refresh">Refresh</button></div><div class="kpis"><div><b class="ok">' + m.status + '</b><span>System status</span></div><div><b>' + m.activeUsers + '</b><span>Active users (15 min)</span></div><div><b>' + m.requests + '</b><span>Page views</span></div><div><b>' + (P2P.storageOK() ? 'OK' : 'Memory only') + '</b><span>Storage</span></div></div>' +
      '<div class="two"><div><h2>Recent activity</h2>' + li(m.activity.map(function (a) { return '<li><span>' + esc(a.text) + '</span><small>' + ago(a.created_at) + '</small></li>'; })) + '</div><div><h2>New registrations</h2>' + li(m.regs.map(function (r) { return '<li><span>' + esc(r.name) + '</span><small>' + esc(r.role) + '</small></li>'; })) + '</div></div>' +
      '<div class="two"><div><h2>Recent enrollments</h2>' + li(m.enrolls.map(function (r) { return '<li><span>' + esc(r.student) + ' → ' + esc(r.course) + '</span></li>'; })) + '</div><div><h2>Recent payments</h2>' + li(m.pays.map(function (r) { return '<li><span>' + esc(r.student) + ' – ' + esc(r.course) + ' (' + money(r.amount) + ')</span><small>' + esc(r.status) + '</small></li>'; })) + '</div></div>' +
      '<p><a href="#" data-act="resetDemo">Reset demo data</a></p>';
  });
  App.actions.refresh = function () { App.render(); };

  App.route('/admin/categories', 'admin', function (c) {
    c.title = 'Categories';
    return '<h1>Categories</h1><form data-form="cat" class="row gap wrap"><input name="name" placeholder="New category name" required><button class="btn primary">Add category</button></form><p class="err" hidden></p>' +
      table(['Category', ''], P2P.categories().map(function (x) { return [esc(x.name), '<a href="#" data-act="delCat" data-id="' + x.id + '">Delete</a>']; }));
  });
  App.forms.cat = function (f, d) { P2P.addCategory(d.name); toast('Category added.'); App.render(); };
  App.actions.delCat = function (el) { confirmBox('Delete this category?', function () { P2P.deleteCategory(el.dataset.id); App.render(); }, 'Delete'); };
})();
