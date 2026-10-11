'use strict';
/* Public pages: home, course catalogue, course details, login, registration, forgot password */
(function () {
  var CF = { sort: 'popular' };

  function card(c) {
    return '<a class="card course" href="#/course/' + c.id + '">' + thumb(c) + '<div class="card-b"><div class="meta">' + esc(c.category) + ' · ' + esc(c.difficulty) + '</div><h3>' + esc(c.title) + '</h3><div class="meta">by ' + esc(c.tutor_name) + '</div>' +
      '<div class="foot"><span>' + (c.rating ? stars(c.rating) + ' ' + c.rating : '<span class="mute">No ratings yet</span>') + '</span><strong>' + money(c.price) + '</strong></div></div></a>';
  }
  App.card = card;

  App.route('/', 'public', function (c) {
    c.wide = true; c.title = '';
    var s = P2P.stats(), feat = P2P.courses({ sort: 'rating' }).slice(0, 4);
    return '<section class="hero"><div class="container"><h1>Learn from peers.<br>Teach what you know.</h1><p class="lead">Peer2Peer Learn connects students with peer tutors for courses, live Zoom classes, assignments and feedback – in one quiet, simple place.</p>' +
      '<div class="row"><a class="btn primary" href="#/courses">Browse courses</a>' + (c.user ? '<a class="btn" href="#' + App.homeFor(c.user) + '">Open dashboard</a>' : '<a class="btn" href="#/register">Create free account</a>') + '</div></div></section>' +
      '<section class="container stats"><div><b>' + s.learners + '</b><span>Learners</span></div><div><b>' + s.tutors + '</b><span>Peer tutors</span></div><div><b>' + s.courses + '</b><span>Courses</span></div><div><b>' + s.sessions + '</b><span>Live classes</span></div></section>' +
      '<section class="container"><h2>How it works</h2><div class="grid3"><div class="step"><span>1</span><h3>Find a course</h3><p>Search by topic, level or tutor and pick what fits your goals.</p></div><div class="step"><span>2</span><h3>Join live classes</h3><p>Classes run on Zoom. One click on Join Class opens the meeting in a new tab.</p></div><div class="step"><span>3</span><h3>Learn and share</h3><p>Finish lessons, submit assignments, rate tutors – or teach a course yourself.</p></div></div></section>' +
      '<section class="container"><div class="row between"><h2>Top rated courses</h2><a href="#/courses">View all</a></div><div class="grid4">' + (feat.length ? feat.map(card).join('') : empty('No courses yet.')) + '</div></section>';
  }, 'public');

  function results(f) {
    var list = P2P.courses(f);
    return list.length ? '<p class="mute">' + list.length + ' course' + (list.length > 1 ? 's' : '') + ' found</p><div class="grid3">' + list.map(card).join('') + '</div>' : empty('No courses match your search. Try different keywords or clear the filters.');
  }
  App.filter = function (form) {
    CF = formData(form);
    var r = document.getElementById('results'); if (r) r.innerHTML = results(CF);
  };

  App.route('/courses', 'public', function (c) {
    c.title = 'Courses';
    var cats = P2P.categories().map(function (x) { return x.name; });
    return '<h1>Courses</h1><form class="filters" data-filter onsubmit="return false"><input type="search" name="q" placeholder="Search courses, topics or tutors" value="' + esc(CF.q || '') + '" aria-label="Search">' +
      '<select name="category" aria-label="Category">' + opts(cats, CF.category, 'All categories') + '</select>' +
      '<select name="difficulty" aria-label="Level">' + opts(['Beginner', 'Intermediate', 'Advanced'], CF.difficulty, 'All levels') + '</select>' +
      '<select name="price" aria-label="Price">' + opts([{ v: 'free', t: 'Free' }, { v: 'paid', t: 'Paid' }], CF.price, 'Any price') + '</select>' +
      '<select name="rating" aria-label="Rating">' + opts([{ v: 4, t: '4 stars & up' }, { v: 3, t: '3 stars & up' }], CF.rating, 'Any rating') + '</select>' +
      '<select name="sort" aria-label="Sort">' + opts([{ v: 'popular', t: 'Most popular' }, { v: 'rating', t: 'Highest rated' }, { v: 'latest', t: 'Newest' }], CF.sort) + '</select></form><div id="results">' + results(CF) + '</div>';
  });

  function lessonList(d) {
    var mods = {}, order = [];
    d.lessons.forEach(function (l) { if (!mods[l.module]) { mods[l.module] = []; order.push(l.module); } mods[l.module].push(l); });
    if (!order.length) return empty('No lessons have been added yet.');
    return order.map(function (m) { return '<div class="module"><h4>' + esc(m) + '</h4><ul class="plain">' + mods[m].map(function (l) { return '<li>' + (d.enrolled ? (l.done ? '✓ ' : '· ') : '· ') + esc(l.title) + '</li>'; }).join('') + '</ul></div>'; }).join('');
  }

  App.route('/course/:id', 'public', function (c) {
    var d = P2P.courseDetail(c.params[0], c.user), u = c.user; c.title = d.title;
    var action;
    if (!u) action = '<a class="btn primary block" href="#/login">Log in to enroll</a>';
    else if (u.role !== 'student') action = u.id === d.tutor_id ? '<a class="btn block" href="#/tutor/courses/' + d.id + '/edit">Edit course</a>' : '<p class="mute">Only students can enroll.</p>';
    else if (d.enrolled) action = '<a class="btn primary block" href="#/learn/' + d.id + '">Continue learning</a><a class="btn block" href="#/messages?u=' + d.tutor_id + '">Message tutor</a>';
    else if (d.price > 0) action = '<a class="btn primary block" href="#/checkout/' + d.id + '">Enroll – ' + money(d.price) + '</a>';
    else action = '<button class="btn primary block" data-act="enroll" data-id="' + d.id + '">Enroll for free</button>';
    var fb = '';
    if (d.enrolled && u.role === 'student') {
      fb = '<h3>Rate this course</h3><form data-form="feedback" class="stack" data-course="' + d.id + '"><label>Rating<select name="rating">' + opts([5, 4, 3, 2, 1].map(function (n) { return { v: n, t: n + ' – ' + ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'][n] }; }), d.mine ? d.mine.rating : 5) + '</select></label>' +
        '<label>Review (optional)<textarea name="review" rows="3" maxlength="500">' + esc(d.mine ? d.mine.review : '') + '</textarea></label><p class="err" hidden></p><button class="btn">' + (d.mine ? 'Update feedback' : 'Submit feedback') + '</button></form>';
    }
    return '<div class="detail"><div><div class="meta">' + esc(d.category) + ' · ' + esc(d.difficulty) + (d.status !== 'published' ? ' · ' + badge(d.status) : '') + '</div><h1>' + esc(d.title) + '</h1>' +
      '<p class="mute">' + (d.rating ? stars(d.rating) + ' ' + d.rating + ' (' + d.reviews + ' reviews) · ' : '') + d.students + ' students · ' + d.duration + ' hours</p><p>' + esc(d.description) + '</p>' +
      (d.objectives ? '<h3>What you will learn</h3><ul class="plain">' + d.objectives.split('\n').filter(Boolean).map(function (o) { return '<li>✓ ' + esc(o) + '</li>'; }).join('') + '</ul>' : '') +
      '<h3>Lessons</h3>' + lessonList(d) +
      '<h3>Your tutor</h3><div class="row gap">' + avatar(d.tutor, true) + '<div><strong>' + esc(d.tutor.name) + '</strong><div class="mute">' + esc(d.tutor.skills) + '</div><p>' + esc(d.tutor.bio) + '</p></div></div>' + fb +
      '<h3>Reviews</h3>' + (d.review_list.length ? d.review_list.map(function (r) { return '<div class="review">' + stars(r.rating) + ' <strong>' + esc(r.name) + '</strong><p>' + esc(r.review || 'No written review.') + '</p></div>'; }).join('') : empty('No reviews yet.')) + '</div>' +
      '<aside class="buy">' + thumb(d) + '<div class="price">' + money(d.price) + '</div>' + action + '</aside></div>';
  });

  App.actions.enroll = function (el) { P2P.enrollCourse(App_user().id, el.dataset.id); toast('Enrollment successful.'); go('/learn/' + el.dataset.id); };
  function App_user() { var u = P2P.current(); if (!u) throw new Error('Please log in first.'); return u; }
  App.me = App_user;
  App.forms.feedback = function (f, d) { P2P.submitFeedback(App_user().id, f.dataset.course, d); toast('Thank you for your feedback.'); App.render(); };

  /* ---------- login / register ---------- */
  App.route('/login', 'guest', function (c) {
    c.title = 'Log in';
    return '<div class="auth"><h1>Log in</h1><form data-form="login" class="stack"><label>Email<input type="email" name="email" required autocomplete="username"></label>' +
      '<label>Password<input type="password" name="password" required autocomplete="current-password"></label><label class="check"><input type="checkbox" name="remember"> Remember me</label>' +
      '<p class="err" hidden></p><button class="btn primary block">Log in</button></form><p><a href="#/forgot">Forgot password?</a> · <a href="#/register">Create an account</a></p>' +
      '<div class="demo"><h4>Demo accounts</h4><p class="mute">Password for all: <code>Demo@1234</code></p><div class="row wrap"><button class="btn sm" data-act="fillDemo" data-email="student@demo.com">Student</button><button class="btn sm" data-act="fillDemo" data-email="tutor@demo.com">Tutor</button><button class="btn sm" data-act="fillDemo" data-email="admin@demo.com">Admin</button></div></div>' +
      '<p class="mute small"><a href="#" data-act="resetDemo">Reset demo data</a></p></div>';
  });
  App.actions.fillDemo = function (el) { var f = document.querySelector('form[data-form=login]'); f.email.value = el.dataset.email; f.password.value = 'Demo@1234'; };
  App.actions.resetDemo = function () { confirmBox('Reset all data back to the original demo data? Your changes will be lost.', function () { P2P.resetDemo(); P2P.endSession(); toast('Demo data restored.'); go('/login'); }, 'Reset'); };
  App.forms.login = function (f, d) {
    var u = P2P.loginUser(d.email, d.password, d.remember);
    var to = App.after || App.homeFor(u); App.after = null; toast('Welcome back, ' + u.name.split(' ')[0] + '.'); go(to);
  };

  App.route('/register', 'guest', function (c) {
    c.title = 'Sign up';
    return '<div class="auth"><h1>Create your account</h1><form data-form="register" class="stack"><label>Full name<input name="name" required></label><label>Email<input type="email" name="email" required></label>' +
      '<label>Password<input type="password" name="password" required><small class="mute">At least 8 characters with a letter and a number.</small></label><label>Confirm password<input type="password" name="confirm" required></label>' +
      '<fieldset><legend>I want to</legend><label class="check"><input type="radio" name="role" value="student" checked> Learn (student)</label><label class="check"><input type="radio" name="role" value="tutor"> Teach (peer tutor)</label></fieldset>' +
      '<label>Skills (optional)<input name="skills" placeholder="e.g. Python, SQL"></label><label>Interests (optional)<input name="interests" placeholder="e.g. Web development"></label>' +
      '<label>Profile picture (optional, max 150 KB)<input type="file" name="avatar" accept="image/*"></label><p class="err" hidden></p><button class="btn primary block">Sign up</button></form><p>Already registered? <a href="#/login">Log in</a></p></div>';
  });
  App.forms.register = function (f, d) {
    return readImage(f.avatar).then(function (img) {
      d.avatar = img; P2P.registerUser(d); P2P.loginUser(d.email, d.password, false); toast('Registration successful. Welcome!'); go(App.homeFor(P2P.current()));
    });
  };

  App.route('/forgot', 'guest', function (c) {
    c.title = 'Forgot password';
    return '<div class="auth"><h1>Reset password</h1><form data-form="forgot" class="stack"><label>Email<input type="email" name="email" required></label><p class="err" hidden></p><button class="btn primary block">Send reset link</button></form><p><a href="#/login">Back to log in</a></p></div>';
  });
  App.forms.forgot = function (f, d) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email || '')) throw new Error('Please enter a valid email address.');
    f.innerHTML = '<p>If this email is registered, a reset link has been sent. <span class="mute">(Demo: no email is actually sent.)</span></p>';
  };
})();
