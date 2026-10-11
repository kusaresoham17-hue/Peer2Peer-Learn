'use strict';
/* Pages shared by every role: messages, notifications, profile */
(function () {
  App.route('/messages', 'auth', function (c) {
    c.title = 'Messages';
    var convs = P2P.conversations(c.user.id), sel = Number(c.q.u) || (convs[0] && convs[0].id) || 0, th = '';
    if (sel && !P2P.canMessage(c.user.id, sel)) sel = 0;
    var other = sel ? P2P.userById(sel) : null;
    if (other) {
      var msgs = P2P.thread(c.user.id, sel);
      th = '<div class="thread-head"><strong>' + esc(other.name) + '</strong> <span class="mute">' + esc(other.role) + '</span></div><div class="thread" id="thread">' +
        (msgs.length ? msgs.map(function (m) { return '<div class="msg ' + (m.from_id === c.user.id ? 'me' : '') + '"><p>' + esc(m.body) + '</p><small>' + ago(m.created_at) + '</small></div>'; }).join('') : empty('No messages yet. Say hello!')) +
        '</div><form data-form="msg" class="msgform"><input type="hidden" name="to_id" value="' + sel + '"><input name="body" placeholder="Write a message" maxlength="1000" autocomplete="off"><button class="btn primary">Send</button></form><p class="err" hidden></p>';
    }
    return '<h1>Messages</h1>' + (convs.length ? '<div class="chat"><div class="convs">' + convs.map(function (v) {
      return '<a href="#/messages?u=' + v.id + '" class="conv' + (v.id === sel ? ' on' : '') + '">' + avatar(v) + '<span><strong>' + esc(v.name) + '</strong>' + (v.unread ? ' <b class="dot">' + v.unread + '</b>' : '') + '<small>' + esc(v.last || 'Start a conversation') + '</small></span></a>';
    }).join('') + '</div><div class="pane">' + (th || empty('Select a conversation.')) + '</div></div>' : empty('No conversations yet. Enroll in a course to message its tutor.', '#/courses', 'Browse courses'));
  });
  App.forms.msg = function (f, d) { P2P.sendMessage(App.me().id, d); App.render(); var i = document.querySelector('.msgform input[name=body]'); if (i) i.focus(); };
  App.afterRender.push(function () { var t = document.getElementById('thread'); if (t) t.scrollTop = t.scrollHeight; });

  App.route('/notifications', 'auth', function (c) {
    c.title = 'Notifications';
    var list = P2P.notifications(c.user.id);
    return '<div class="row between"><h1>Notifications</h1>' + (list.some(function (n) { return !n.is_read; }) ? '<button class="btn sm" data-act="markRead">Mark all as read</button>' : '') + '</div>' +
      (list.length ? '<ul class="notes">' + list.map(function (n) { return '<li class="' + (n.is_read ? '' : 'unread') + '"><span>' + esc(n.text) + '</span><small>' + ago(n.created_at) + '</small></li>'; }).join('') + '</ul>' : empty('You have no notifications.'));
  });
  App.actions.markRead = function () { P2P.markNotificationsRead(App.me().id); App.render(); };

  App.route('/profile', 'auth', function (c) {
    c.title = 'Profile';
    var u = c.user, st = P2P.profileStats(u.id);
    return '<h1>My profile</h1><div class="two"><form data-form="profile" class="stack"><div class="row gap">' + avatar(u, true) + '<label>Change picture (max 150 KB)<input type="file" name="avatar" accept="image/*"></label></div>' +
      '<label>Full name<input name="name" value="' + esc(u.name) + '" required></label><label>Email<input value="' + esc(u.email) + '" disabled></label><label>Role<input value="' + esc(u.role) + '" disabled></label>' +
      '<label>Skills<input name="skills" value="' + esc(u.skills) + '"></label><label>Interests<input name="interests" value="' + esc(u.interests) + '"></label><label>About me<textarea name="bio" rows="3" maxlength="500">' + esc(u.bio) + '</textarea></label>' +
      '<h3>Change password</h3><label>Current password<input type="password" name="current_password" autocomplete="current-password"></label><label>New password<input type="password" name="new_password" autocomplete="new-password"></label>' +
      '<p class="err" hidden></p><button class="btn primary">Save changes</button></form><div><h3>Summary</h3>' +
      (u.role === 'tutor' ? '<p>Average rating: ' + (st.rating ? stars(st.rating) + ' ' + st.rating : 'no ratings yet') + '</p><p>Teaching: ' + (st.teaching.length ? esc(st.teaching.join(', ')) : '–') + '</p>' : '') +
      (u.role === 'student' ? '<p>Learning: ' + (st.learning.length ? esc(st.learning.join(', ')) : '–') + '</p>' : '') + '<p class="mute">Member since ' + fmtDate(u.created_at) + '</p></div></div>';
  });
  App.forms.profile = function (f, d) {
    return readImage(f.avatar).then(function (img) { d.avatar = img; P2P.updateProfile(App.me().id, d); toast('Profile updated successfully.'); App.render(); });
  };
})();
