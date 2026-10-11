'use strict';
/* Tutor pages: dashboard, courses, course editor, classes (Zoom links), assignments, students, reviews, earnings */
(function () {
  App.route('/tutor', 'tutor', function (c) {
    c.title = 'Dashboard';
    var d = P2P.tutorDashboard(c.user.id);
    return '<h1>Hello, ' + esc(c.user.name.split(' ')[0]) + '</h1><div class="kpis"><div><b>' + d.courses + '</b><span>Courses</span></div><div><b>' + d.students + '</b><span>Students</span></div><div><b>' + d.activeClasses + '</b><span>Upcoming classes</span></div><div><b>' + (d.rating || '–') + '</b><span>Average rating</span></div></div>' +
      '<div class="row gap wrap"><a class="btn primary" href="#/tutor/courses/new">Create course</a><a class="btn" href="#/tutor/classes">Schedule class</a><a class="btn" href="#/tutor/assignments">' + (d.pending ? d.pending + ' submissions to evaluate' : 'Assignments') + '</a></div>' +
      '<h2>Upcoming classes</h2>' + (d.classes.length ? table(['Class', 'When', 'Students', ''], d.classes.map(function (s) { return [esc(s.title) + '<div class="mute">' + esc(s.course_title) + '</div>', fmtDate(s.date) + ' ' + fmtTime(s.start_time), s.participants, App.joinBtn(s, 'Start class')]; })) : empty('No upcoming classes.', '#/tutor/classes', 'Schedule a class'));
  });

  App.route('/tutor/courses', 'tutor', function (c) {
    c.title = 'My courses';
    var list = P2P.tutorCourses(c.user.id);
    return '<div class="row between"><h1>My courses</h1><a class="btn primary" href="#/tutor/courses/new">Create course</a></div>' + (list.length ? table(['Course', 'Status', 'Students', 'Rating', 'Price', ''], list.map(function (x) {
      return ['<a href="#/course/' + x.id + '">' + esc(x.title) + '</a>', badge(x.status), x.students, x.rating || '–', money(x.price), '<a href="#/tutor/courses/' + x.id + '/edit">Edit</a> · <a href="#" data-act="delCourse" data-id="' + x.id + '">Delete</a>'];
    })) : empty('You have not created any course yet.', '#/tutor/courses/new', 'Create your first course'));
  });
  App.actions.delCourse = function (el) { confirmBox('Delete this course with its lessons, classes and assignments? This cannot be undone.', function () { P2P.deleteCourse(App.me(), el.dataset.id); toast('Course deleted.'); App.render(); }, 'Delete'); };

  function lessonRow() {
    return '<div class="lrow"><input name="l_module" placeholder="Module" value="Module 1"><input name="l_title" placeholder="Lesson title"><input name="l_url" placeholder="Resource link (optional)"><textarea name="l_desc" rows="2" placeholder="Lesson notes"></textarea><button type="button" class="link" data-act="removeRow">Remove</button></div>';
  }
  function courseForm(c, d) {
    var cats = P2P.categories().map(function (x) { return x.name; }), v = d || { title: '', description: '', category: '', difficulty: 'Beginner', duration: 10, price: 0, objectives: '', lessons: [] };
    c.title = d ? 'Edit course' : 'Create course';
    return '<h1>' + (d ? 'Edit course' : 'Create course') + '</h1><form data-form="course" class="stack narrow" data-id="' + (d ? d.id : '') + '"><label>Title<input name="title" value="' + esc(v.title) + '" required></label><label>Description<textarea name="description" rows="4" required>' + esc(v.description) + '</textarea></label>' +
      '<div class="row gap"><label>Category<select name="category">' + opts(cats, v.category, 'Choose') + '</select></label><label>Level<select name="difficulty">' + opts(['Beginner', 'Intermediate', 'Advanced'], v.difficulty) + '</select></label></div>' +
      '<div class="row gap"><label>Duration (hours)<input type="number" name="duration" min="0" value="' + v.duration + '"></label><label>Price in ₹ (0 = free)<input type="number" name="price" min="0" value="' + v.price + '"></label></div>' +
      '<label>Learning objectives (one per line)<textarea name="objectives" rows="3">' + esc(v.objectives) + '</textarea></label><label>Thumbnail (optional, max 150 KB)<input type="file" name="thumb" accept="image/*"></label>' +
      '<h3>Lessons</h3>' + (d && d.lessons.length ? '<ul class="plain">' + d.lessons.map(function (l) { return '<li>' + esc(l.module) + ' – ' + esc(l.title) + ' <a href="#" data-act="delLesson" data-id="' + l.id + '">remove</a></li>'; }).join('') + '</ul>' : '') +
      '<div id="lessons">' + (d ? '' : lessonRow()) + '</div><button type="button" class="btn sm" data-act="addLesson">+ Add lesson</button><p class="err" hidden></p>' +
      '<div class="row gap"><button class="btn" value="draft">Save as draft</button><button class="btn primary" value="publish">Publish course</button></div></form>';
  }
  App.route('/tutor/courses/new', 'tutor', function (c) { return courseForm(c, null); });
  App.route('/tutor/courses/:id/edit', 'tutor', function (c) {
    var d = P2P.courseDetail(c.params[0], c.user);
    if (d.tutor_id !== c.user.id) throw new Error('Unauthorized access.');
    return courseForm(c, d);
  });
  App.actions.addLesson = function () { document.getElementById('lessons').insertAdjacentHTML('beforeend', lessonRow()); };
  App.actions.delLesson = function (el) { confirmBox('Remove this lesson?', function () { P2P.deleteLesson(App.me(), el.dataset.id); App.render(); }, 'Remove'); };
  App.forms.course = function (f, d) {
    return readImage(f.thumb).then(function (img) {
      d.thumb = img; d.paid = Number(d.price) > 0; d.publish = d._action === 'publish';
      d.lessons = Array.prototype.map.call(f.querySelectorAll('.lrow'), function (r) { return { module: r.querySelector('[name=l_module]').value, title: r.querySelector('[name=l_title]').value, url: r.querySelector('[name=l_url]').value, description: r.querySelector('[name=l_desc]').value }; });
      var id = P2P.saveCourse(App.me(), d, f.dataset.id || null);
      toast(d.publish ? 'Course published.' : 'Course saved as draft.'); go('/tutor/courses');
    });
  };

  /* ---------- classes ---------- */
  App.route('/tutor/classes', 'tutor', function (c) {
    c.title = 'Classes';
    var mine = P2P.tutorCourses(c.user.id), list = P2P.classes(c.user).filter(function (s) { return s.tutor_id === c.user.id; });
    var today = new Date().toISOString().slice(0, 10);
    return '<h1>Classes</h1><p class="mute">Create a class by pasting a Zoom meeting link. Students click Join Class to open it in a new tab.</p>' +
      (mine.length ? '<form data-form="schedule" class="stack narrow panel"><h3>Schedule a class</h3><label>Course<select name="course_id">' + opts(mine.map(function (x) { return { v: x.id, t: x.title }; })) + '</select></label><label>Title<input name="title" required></label><label>Description<textarea name="description" rows="2"></textarea></label>' +
        '<div class="row gap"><label>Date<input type="date" name="date" min="' + today + '" required></label><label>Start<input type="time" name="start_time" required></label><label>End<input type="time" name="end_time" required></label></div>' +
        '<label>Zoom meeting link<input name="zoom_link" placeholder="https://zoom.us/j/123456789" required></label><p class="err" hidden></p><button class="btn primary">Schedule class</button></form>' : empty('Create a course first, then schedule classes for it.', '#/tutor/courses/new', 'Create course')) +
      '<h2>Your classes</h2>' + (list.length ? table(['Class', 'When', 'Students', 'Status', 'Actions'], list.map(function (s) {
        return [esc(s.title) + '<div class="mute">' + esc(s.course_title) + '</div>', fmtDate(s.date) + '<div class="mute">' + fmtTime(s.start_time) + ' – ' + fmtTime(s.end_time) + '</div>', s.participants, badge(s.status),
          (s.status === 'cancelled' || s.status === 'completed' ? '' : App.joinBtn(s, 'Start class') + ' <a href="#" data-act="editClass" data-id="' + s.id + '">Edit</a> · <a href="#" data-act="remind" data-id="' + s.id + '">Remind</a> · <a href="#" data-act="cancelClass" data-id="' + s.id + '">Cancel</a> · ') + '<a href="#" data-act="people" data-id="' + s.id + '">Students</a>'];
      })) : empty('No classes scheduled yet.'));
  });
  App.forms.schedule = function (f, d) { P2P.scheduleClass(App.me(), d); toast('Class scheduled. Students were notified.'); App.render(); };
  App.actions.cancelClass = function (el) { confirmBox('Cancel this class? Enrolled students will be notified.', function () { P2P.updateClass(App.me(), el.dataset.id, { status: 'cancelled' }); toast('Class cancelled.'); App.render(); }, 'Cancel class'); };
  App.actions.remind = function (el) { P2P.remindClass(App.me(), el.dataset.id); toast('Reminder sent to students.'); };
  App.actions.people = function (el) {
    var l = P2P.participants(App.me(), el.dataset.id);
    showModal('<h3>Enrolled students</h3>' + (l.length ? '<ul class="plain">' + l.map(function (p) { return '<li>' + esc(p.name) + ' <span class="mute">' + esc(p.email) + '</span></li>'; }).join('') + '</ul>' : '<p class="mute">No students enrolled yet.</p>'));
  };
  App.actions.editClass = function (el) {
    var s = P2P.classes(App.me()).filter(function (x) { return String(x.id) === el.dataset.id; })[0];
    showModal('<h3>Edit class</h3><form data-form="editClass" class="stack" data-id="' + s.id + '"><label>Title<input name="title" value="' + esc(s.title) + '" required></label><div class="row gap"><label>Date<input type="date" name="date" value="' + s.date + '" required></label><label>Start<input type="time" name="start_time" value="' + s.start_time + '"></label><label>End<input type="time" name="end_time" value="' + s.end_time + '"></label></div><label>Zoom link<input name="zoom_link" value="' + esc(s.zoom_link) + '"></label><p class="err" hidden></p><button class="btn primary">Save changes</button></form>');
  };
  App.forms.editClass = function (f, d) { P2P.updateClass(App.me(), f.dataset.id, d); closeModal(); toast('Class updated. Students were notified.'); App.render(); };

  /* ---------- assignments ---------- */
  App.route('/tutor/assignments', 'tutor', function (c) {
    c.title = 'Assignments';
    var mine = P2P.tutorCourses(c.user.id), list = P2P.tutorAssignments(c.user.id), today = new Date().toISOString().slice(0, 10);
    return '<h1>Assignments</h1>' + (mine.length ? '<form data-form="newAsg" class="stack narrow panel"><h3>New assignment</h3><label>Course<select name="course_id">' + opts(mine.map(function (x) { return { v: x.id, t: x.title }; })) + '</select></label><label>Title<input name="title" required></label><label>Instructions<textarea name="instructions" rows="3"></textarea></label>' +
      '<div class="row gap"><label>Deadline<input type="date" name="due_date" min="' + today + '" required></label><label>Maximum marks<input type="number" name="max_marks" value="100" min="1" max="1000"></label></div><p class="err" hidden></p><button class="btn primary">Create assignment</button></form>' : empty('Create a course first.', '#/tutor/courses/new', 'Create course')) +
      (list.length ? list.map(function (a) {
        return '<div class="panel"><div class="row between"><div><strong>' + esc(a.title) + '</strong><div class="mute">' + esc(a.course) + ' · due ' + fmtDate(a.due_date) + ' · ' + a.submissions.length + ' submissions</div></div></div>' +
          (a.submissions.length ? a.submissions.map(function (s) {
            return '<div class="sub"><div class="row between"><strong>' + esc(s.student) + '</strong>' + badge(s.status) + '</div><p>' + esc(s.content) + '</p><form data-form="evaluate" class="row gap wrap" data-id="' + s.id + '"><input type="number" name="marks" min="0" max="' + a.max_marks + '" placeholder="Marks / ' + a.max_marks + '" value="' + (s.marks == null ? '' : s.marks) + '"><input name="feedback" placeholder="Feedback" value="' + esc(s.feedback) + '"><button class="btn sm primary" value="grade">Save marks</button><button class="btn sm" value="review">Mark under review</button></form><p class="err" hidden></p></div>';
          }).join('') : '<p class="mute">No submissions yet.</p>') + '</div>';
      }).join('') : empty('No assignments created yet.'));
  });
  App.forms.newAsg = function (f, d) { P2P.createAssignment(App.me(), d); toast('Assignment created. Students were notified.'); App.render(); };
  App.forms.evaluate = function (f, d) {
    P2P.evaluateAssignment(App.me(), f.dataset.id, { marks: d.marks, feedback: d.feedback, review_only: d._action === 'review' });
    toast(d._action === 'review' ? 'Marked under review.' : 'Marks saved.'); App.render();
  };

  App.route('/tutor/students', 'tutor', function (c) {
    c.title = 'Students';
    var l = P2P.tutorStudents(c.user.id);
    return '<h1>Students</h1>' + (l.length ? table(['Student', 'Course', 'Progress', 'Enrolled', ''], l.map(function (s) { return [esc(s.name) + '<div class="mute">' + esc(s.email) + '</div>', esc(s.course), '<div class="bar-bg sm"><i style="width:' + s.progress + '%"></i></div> ' + s.progress + '%', fmtDate(s.created_at), '<a href="#/messages?u=' + s.id + '">Message</a>']; })) : empty('No students have enrolled yet.'));
  });
  App.route('/tutor/reviews', 'tutor', function (c) {
    c.title = 'Reviews';
    var l = P2P.tutorReviews(c.user.id);
    return '<h1>Student feedback</h1>' + (l.length ? l.map(function (r) { return '<div class="review">' + stars(r.rating) + ' <strong>' + esc(r.student) + '</strong> <span class="mute">on ' + esc(r.course) + '</span><p>' + esc(r.review || 'No written review.') + '</p></div>'; }).join('') : empty('No feedback received yet.'));
  });
  App.route('/tutor/earnings', 'tutor', function (c) {
    c.title = 'Earnings';
    var l = P2P.tutorPayments(c.user.id), total = l.filter(function (p) { return p.status === 'Success'; }).reduce(function (a, p) { return a + p.amount; }, 0);
    return '<h1>Earnings</h1><div class="kpis"><div><b>₹' + total + '</b><span>Total (simulated)</span></div><div><b>' + l.filter(function (p) { return p.status === 'Success'; }).length + '</b><span>Payments</span></div></div>' +
      (l.length ? table(['Date', 'Student', 'Course', 'Amount', 'Status'], l.map(function (p) { return [fmtDate(p.created_at), esc(p.student), esc(p.course), money(p.amount), badge(p.status)]; })) : empty('No payments received yet.'));
  });
})();
