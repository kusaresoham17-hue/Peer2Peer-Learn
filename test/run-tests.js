// Simple API test suite: `npm test`. Uses a temporary database and runs the main workflows.
process.env.DB_FILE = require('path').join(require('os').tmpdir(), 'p2p-test-' + Date.now() + '.db');
const { server } = require('../server');
const assert = require('assert');
let passed = 0;
async function main() {
  await new Promise((r) => server.listen(0, r));
  const base = 'http://localhost:' + server.address().port;
  const call = async (method, p, body, token) => {
    const r = await fetch(base + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() };
  };
  const test = async (name, fn) => { try { await fn(); passed++; console.log('  PASS', name); } catch (e) { console.log('  FAIL', name, '\n      ', e.message); process.exitCode = 1; } };
  const login = async (email) => (await call('POST', '/api/login', { email, password: 'Demo@1234' })).data.token;
  const reg = { name: 'Test User', email: 'test@x.com', password: 'Test@1234', confirm: 'Test@1234', role: 'student' };
  let tok, ctok, atok, tut;

  await test('UAT-01 register: validation errors', async () => {
    assert.equal((await call('POST', '/api/register', { ...reg, email: 'bad' })).status, 400);
    assert.equal((await call('POST', '/api/register', { ...reg, password: 'short', confirm: 'short' })).status, 400);
    assert.equal((await call('POST', '/api/register', { ...reg, confirm: 'x' })).status, 400);
  });
  await test('UAT-01 register: success and duplicate email', async () => {
    const r = await call('POST', '/api/register', reg); assert.equal(r.status, 200); tok = r.data.token;
    assert.ok(!('password_hash' in r.data.user));
    assert.equal((await call('POST', '/api/register', reg)).status, 409);
  });
  await test('UAT-02 login: wrong password / correct password', async () => {
    assert.equal((await call('POST', '/api/login', { email: 'test@x.com', password: 'nope' })).status, 401);
    assert.equal((await call('POST', '/api/login', { email: 'test@x.com', password: 'Test@1234' })).status, 200);
  });
  ctok = await login('tutor@demo.com'); atok = await login('admin@demo.com'); const stok = await login('student@demo.com');
  await test('role-based access: student cannot use tutor/admin APIs', async () => {
    assert.equal((await call('GET', '/api/admin/users', null, tok)).status, 403);
    assert.equal((await call('POST', '/api/courses', {}, tok)).status, 403);
    assert.equal((await call('GET', '/api/me')).status, 401);
  });
  await test('UAT-03 search courses and enroll in free course', async () => {
    const list = await call('GET', '/api/courses?q=python'); assert.ok(list.data.length >= 1);
    const free = (await call('GET', '/api/courses')).data.find((c) => c.price === 0);
    assert.equal((await call('POST', `/api/courses/${free.id}/enroll`, {}, tok)).status, 200);
    assert.equal((await call('POST', `/api/courses/${free.id}/enroll`, {}, tok)).status, 409);
  });
  await test('paid course: enroll blocked, failed payment, successful payment + receipt', async () => {
    const paid = (await call('GET', '/api/courses')).data.find((c) => c.price > 0);
    assert.equal((await call('POST', `/api/courses/${paid.id}/enroll`, {}, tok)).status, 402);
    assert.equal((await call('POST', '/api/payments', { course_id: paid.id, method: 'Card', card: '4111 1111 1111 0000' }, tok)).status, 402);
    const ok = await call('POST', '/api/payments', { course_id: paid.id, method: 'UPI' }, tok);
    assert.equal(ok.status, 200); assert.match(ok.data.receipt_no, /^RCPT-/); assert.equal(ok.data.status, 'Success');
  });
  await test('UAT-04 course content visible only to enrolled users', async () => {
    const courses = (await call('GET', '/api/courses')).data;
    const mine = (await call('GET', '/api/my/courses', null, tok)).data[0];
    assert.ok((await call('GET', `/api/courses/${mine.id}`, null, tok)).data.lessons[0].content);
    const other = courses.find((c) => !(c.id === mine.id));
    const d = (await call('GET', `/api/courses/${other.id}`, null, stok)).data;
    if (!d.enrolled) assert.equal(d.lessons[0].content, undefined);
  });
  await test('classes: zoom link validation, schedule, join, cancel', async () => {
    const mineT = (await call('GET', '/api/tutor/courses', null, ctok)).data[0];
    const body = { course_id: mineT.id, title: 'Test class', date: '2099-01-01', start_time: '10:00', end_time: '11:00', zoom_link: 'https://evil.com/j/1' };
    assert.equal((await call('POST', '/api/classes', body, ctok)).status, 400);
    assert.equal((await call('POST', '/api/classes', { ...body, zoom_link: 'http://zoom.us/j/1' }, ctok)).status, 400);
    assert.equal((await call('POST', '/api/classes', { ...body, end_time: '09:00', zoom_link: 'https://zoom.us/j/123' }, ctok)).status, 400);
    const ok = await call('POST', '/api/classes', { ...body, zoom_link: 'https://zoom.us/j/123456789' }, ctok); assert.equal(ok.status, 200);
    const enrolled = (await call('GET', '/api/my/courses', null, stok)).data.find((c) => c.id === mineT.id);
    if (enrolled) { const j = await call('GET', `/api/classes/${ok.data.id}/join`, null, stok); assert.equal(j.data.zoom_link, 'https://zoom.us/j/123456789'); }
    assert.equal((await call('GET', `/api/classes/${ok.data.id}/join`, null, await login('priya@demo.com'))).status, 403);
    assert.equal((await call('PUT', `/api/classes/${ok.data.id}`, { status: 'cancelled' }, ctok)).status, 200);
    assert.equal((await call('GET', `/api/classes/${ok.data.id}/join`, null, ctok)).status, 410);
  });
  await test('UAT-07/08 submit and evaluate assignment', async () => {
    const a = (await call('GET', '/api/assignments', null, tok)).data[0];
    assert.equal((await call('POST', `/api/assignments/${a.id}/submit`, { content: '' }, tok)).status, 400);
    assert.equal((await call('POST', `/api/assignments/${a.id}/submit`, { content: 'My answer' }, tok)).status, 200);
    assert.equal((await call('POST', `/api/assignments/${a.id}/submit`, { content: 'again' }, tok)).status, 409);
    const tutorOfA = (await call('GET', `/api/courses/${a.course_id}`, null, tok)).data.tutor.id;
    const email = (await call('GET', '/api/admin/users?role=tutor', null, atok)).data.find((u) => u.id === tutorOfA).email;
    tut = await login(email);
    const sub = (await call('GET', '/api/tutor/assignments', null, tut)).data.find((x) => x.id === a.id).submissions.find((s) => s.content === 'My answer');
    assert.equal((await call('PUT', `/api/submissions/${sub.id}`, { marks: 500, feedback: 'x' }, tut)).status, 400);
    assert.equal((await call('PUT', `/api/submissions/${sub.id}`, { marks: 85, feedback: 'Well done' }, tut)).status, 200);
    assert.equal((await call('GET', '/api/assignments', null, tok)).data.find((x) => x.id === a.id).marks, 85);
  });
  await test('messages: allowed for tutor of enrolled course, blocked otherwise', async () => {
    const c = (await call('GET', '/api/my/courses', null, tok)).data[0];
    const tutorId = (await call('GET', `/api/courses/${c.id}`, null, tok)).data.tutor.id;
    assert.equal((await call('POST', '/api/messages', { to_id: tutorId, body: 'Hello' }, tok)).status, 200);
    assert.equal((await call('POST', '/api/messages', { to_id: tutorId, body: '' }, tok)).status, 400);
    const other = (await call('GET', '/api/admin/users?role=student', null, atok)).data.find((u) => u.email === 'rohan@demo.com');
    assert.equal((await call('POST', '/api/messages', { to_id: other.id, body: 'Hi' }, tok)).status, 403);
  });
  await test('UAT-09 feedback and rating', async () => {
    const c = (await call('GET', '/api/my/courses', null, tok)).data[0];
    assert.equal((await call('POST', `/api/courses/${c.id}/feedback`, { rating: 9 }, tok)).status, 400);
    assert.equal((await call('POST', `/api/courses/${c.id}/feedback`, { rating: 5, review: 'Great' }, tok)).status, 200);
  });
  await test('UAT-10 admin manages users and courses', async () => {
    const u = (await call('GET', '/api/admin/users?q=test@x.com', null, atok)).data[0];
    assert.equal((await call('PUT', `/api/admin/users/${u.id}`, { action: 'deactivate' }, atok)).status, 200);
    assert.equal((await call('POST', '/api/login', { email: 'test@x.com', password: 'Test@1234' })).status, 403);
    assert.equal((await call('PUT', `/api/admin/users/${u.id}`, { action: 'activate' }, atok)).status, 200);
    const me = (await call('GET', '/api/me', null, atok)).data;
    assert.equal((await call('PUT', `/api/admin/users/${me.id}`, { action: 'delete' }, atok)).status, 400);
    const c = (await call('GET', '/api/admin/courses', null, atok)).data[0];
    assert.equal((await call('PUT', `/api/admin/courses/${c.id}`, { action: 'archive' }, atok)).status, 200);
    assert.equal((await call('PUT', `/api/admin/courses/${c.id}`, { action: 'approve' }, atok)).status, 200);
    for (const t of ['users', 'courses', 'enrollments', 'classes', 'assignments', 'feedback', 'payments']) assert.ok(Array.isArray((await call('GET', `/api/admin/report/${t}`, null, atok)).data));
    assert.ok((await call('GET', '/api/admin/monitor', null, atok)).data.requests > 0);
  });
  await test('tutor creates and publishes a course', async () => {
    const bad = await call('POST', '/api/courses', { title: 'x' }, ctok); assert.equal(bad.status, 400);
    const ok = await call('POST', '/api/courses', { title: 'Git for Beginners', description: 'Version control basics for teams.', category: 'Programming', difficulty: 'Beginner', duration: 4, publish: true, lessons: [{ module: 'Module 1', title: 'What is Git?', description: 'Intro' }] }, ctok);
    assert.equal(ok.status, 200);
    assert.ok((await call('GET', '/api/courses?q=Git')).data.some((c) => c.title === 'Git for Beginners'));
  });
  console.log(`\n${passed} test groups passed`);
  server.close();
}
main();
