// Username/password accounts with signed session cookies.
// - Admin account comes from ADMIN_USERNAME / ADMIN_PASSWORD. The admin can change the password in the
//   app; that hash is stored in users.json and wins until ADMIN_PASSWORD itself is changed (= reset).
// - Other users sign up themselves; they are stored in DATA_DIR/users.json with scrypt hashes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const COOKIE = 'erh_session';
const SESSION_DAYS = 30;

export const ADMIN_USERNAME = (process.env.ADMIN_USERNAME || 'admin').trim().toLowerCase();
const ENV_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

let SECRET = process.env.SESSION_SECRET || '';
if (!SECRET) {
  SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('WARNING: SESSION_SECRET not set. Everyone will be logged out whenever the server restarts.');
}

// ---------- storage ----------

let db = { users: {}, settings: { signup: 'open' }, admin: null };
try {
  const loaded = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  db = { users: loaded.users || {}, settings: { ...db.settings, ...(loaded.settings || {}) }, admin: loaded.admin || null };
} catch (err) {
  if (err.code !== 'ENOENT') console.error('Could not read users file:', err.message);
}

function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = USERS_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, USERS_FILE);
}

// ---------- passwords ----------

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function checkPassword(user, password) {
  return safeEqual(hashPassword(password, user.salt).hash, user.hash);
}

// ---------- admin password ----------

const fingerprint = (text) => crypto.createHash('sha256').update(text).digest('hex').slice(0, 12);
const ENV_FP = ENV_ADMIN_PASSWORD ? fingerprint(ENV_ADMIN_PASSWORD) : '';

// A password saved from the app is dropped when ADMIN_PASSWORD is changed: that is the "forgot password" reset.
if (db.admin && ENV_FP && db.admin.env !== ENV_FP) {
  db.admin = null;
  save();
  console.log('ADMIN_PASSWORD changed: admin password reset to the value from the environment.');
}

let ADMIN_PASSWORD = ENV_ADMIN_PASSWORD;
if (!ADMIN_PASSWORD && !db.admin) {
  ADMIN_PASSWORD = crypto.randomBytes(9).toString('base64url');
  console.warn(
    `WARNING: ADMIN_PASSWORD not set. Temporary admin login for this run -> username: ${ADMIN_USERNAME}  password: ${ADMIN_PASSWORD}`
  );
}

const checkAdminPassword = (password) =>
  db.admin ? checkPassword(db.admin, password) : safeEqual(password, ADMIN_PASSWORD);

// Changes whenever the admin password changes, which logs the admin out everywhere else.
const adminVersion = () => (db.admin ? db.admin.sv : fingerprint(ADMIN_PASSWORD));

export const USERNAME_RE = /^[a-z0-9_.-]{3,32}$/;

function validateCredentials(username, password) {
  if (!USERNAME_RE.test(username)) return 'Username must be 3–32 characters: letters, numbers, dot, dash or underscore';
  if (typeof password !== 'string' || password.length < 8) return 'Password must be at least 8 characters';
  if (password.length > 200) return 'Password is too long';
  return null;
}

// ---------- sessions ----------

const sign = (data) => crypto.createHmac('sha256', SECRET).update(data).digest('base64url');

function makeToken(username, version) {
  const payload = Buffer.from(
    JSON.stringify({ u: username, v: version, exp: Date.now() + SESSION_DAYS * 864e5 })
  ).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readToken(token) {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig || !safeEqual(sign(payload), sig)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

function getCookie(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

function setSession(req, res, username, version) {
  res.cookie(COOKIE, makeToken(username, version), {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure,
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  });
}

export function currentUser(req) {
  const data = readToken(getCookie(req, COOKIE));
  if (!data) return null;
  if (data.u === ADMIN_USERNAME) {
    return data.v === adminVersion() ? { username: ADMIN_USERNAME, role: 'admin' } : null;
  }
  const u = db.users[data.u];
  if (!u || u.status !== 'active' || u.sv !== data.v) return null;
  return { username: u.username, role: 'user' };
}

// ---------- brute-force protection ----------

const failures = new Map(); // key -> { count, until }
const MAX_FAILS = 8;
const LOCK_MS = 15 * 60 * 1000;

function isLocked(key) {
  const f = failures.get(key);
  if (!f) return false;
  if (f.until < Date.now()) {
    failures.delete(key);
    return false;
  }
  return f.count >= MAX_FAILS;
}
function noteFailure(key) {
  const f = failures.get(key);
  if (!f || f.until < Date.now()) failures.set(key, { count: 1, until: Date.now() + LOCK_MS });
  else f.count++;
  if (failures.size > 5000) failures.delete(failures.keys().next().value);
}

// ---------- public helpers ----------

const publicUser = (u) => ({
  username: u.username,
  status: u.status,
  created_at: u.created_at,
  last_login: u.last_login || null,
});

const bad = (res, status, error, code = 'BAD_REQUEST') => res.status(status).json({ error, code });

// Paths reachable without logging in.
const OPEN_PATHS = new Set(['/healthz', '/login', '/login.html', '/js/login.js', '/css/styles.css']);
const OPEN_API = new Set(['/api/auth/login', '/api/auth/signup', '/api/auth/config', '/api/auth/me', '/api/auth/logout']);

export function requireLogin(req, res, next) {
  if (OPEN_PATHS.has(req.path) || OPEN_API.has(req.path)) return next();
  const user = currentUser(req);
  if (user) {
    req.user = user;
    return next();
  }
  if (req.path.startsWith('/api/')) return bad(res, 401, 'Please log in', 'UNAUTHORIZED');
  res.redirect('/login');
}

export function requireAdmin(req, res, next) {
  if (req.user?.role === 'admin') return next();
  bad(res, 403, 'Admin only', 'FORBIDDEN');
}

// Only accept JSON bodies on auth routes: blocks cross-site form posts.
function jsonOnly(req, res, next) {
  if (req.method !== 'GET' && !req.is('application/json')) return bad(res, 415, 'JSON body required');
  next();
}

export function mountAuthRoutes(app) {
  app.use(['/api/auth', '/api/admin'], jsonOnly);

  app.get('/api/auth/config', (_req, res) => res.json({ signup: db.settings.signup }));

  app.get('/api/auth/me', (req, res) => {
    const user = currentUser(req);
    if (!user) return bad(res, 401, 'Please log in', 'UNAUTHORIZED');
    res.json({ user });
  });

  app.post('/api/auth/login', (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const key = `${req.ip}|${username}`;
    if (isLocked(key) || isLocked(req.ip)) return bad(res, 429, 'Too many failed attempts. Try again in 15 minutes.', 'RATE_LIMITED');

    if (username === ADMIN_USERNAME && checkAdminPassword(password)) {
      failures.delete(key);
      setSession(req, res, ADMIN_USERNAME, adminVersion());
      return res.json({ user: { username: ADMIN_USERNAME, role: 'admin' } });
    }
    const u = db.users[username];
    if (!u || !checkPassword(u, password)) {
      noteFailure(key);
      noteFailure(req.ip);
      return bad(res, 401, 'Wrong username or password', 'BAD_LOGIN');
    }
    failures.delete(key);
    if (u.status === 'pending') return bad(res, 403, 'Your account is waiting for admin approval', 'PENDING');
    if (u.status !== 'active') return bad(res, 403, 'This account has been disabled', 'DISABLED');
    u.last_login = new Date().toISOString();
    save();
    setSession(req, res, u.username, u.sv);
    res.json({ user: { username: u.username, role: 'user' } });
  });

  app.post('/api/auth/signup', (req, res) => {
    const mode = db.settings.signup;
    if (mode === 'closed') return bad(res, 403, 'Sign up is closed. Ask the admin for an account.', 'SIGNUP_CLOSED');
    if (isLocked(`signup|${req.ip}`)) return bad(res, 429, 'Too many sign ups from your network. Try again later.', 'RATE_LIMITED');
    const username = String(req.body?.username || '').trim().toLowerCase();
    const password = req.body?.password;
    const invalid = validateCredentials(username, password);
    if (invalid) return bad(res, 400, invalid);
    if (username === ADMIN_USERNAME || db.users[username]) return bad(res, 409, 'That username is taken', 'TAKEN');

    noteFailure(`signup|${req.ip}`); // counts sign ups per IP
    const status = mode === 'approval' ? 'pending' : 'active';
    db.users[username] = {
      username,
      ...hashPassword(password),
      status,
      sv: crypto.randomBytes(6).toString('hex'),
      created_at: new Date().toISOString(),
    };
    save();
    if (status === 'pending') return res.status(202).json({ pending: true });
    setSession(req, res, username, db.users[username].sv);
    res.status(201).json({ user: { username, role: 'user' } });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie(COOKIE, { path: '/' });
    res.json({ ok: true });
  });

  app.post('/api/auth/password', (req, res) => {
    const user = currentUser(req);
    if (!user) return bad(res, 401, 'Please log in', 'UNAUTHORIZED');
    if (user.role === 'admin') {
      if (!checkAdminPassword(String(req.body?.current || ''))) return bad(res, 400, 'Current password is wrong');
      const invalid = validateCredentials(ADMIN_USERNAME, req.body?.password);
      if (invalid) return bad(res, 400, invalid);
      db.admin = { ...hashPassword(req.body.password), sv: crypto.randomBytes(6).toString('hex'), env: ENV_FP };
      save();
      setSession(req, res, ADMIN_USERNAME, db.admin.sv);
      return res.json({ ok: true });
    }
    const u = db.users[user.username];
    if (!checkPassword(u, String(req.body?.current || ''))) return bad(res, 400, 'Current password is wrong');
    const invalid = validateCredentials(u.username, req.body?.password);
    if (invalid) return bad(res, 400, invalid);
    Object.assign(u, hashPassword(req.body.password), { sv: crypto.randomBytes(6).toString('hex') });
    save();
    setSession(req, res, u.username, u.sv); // other devices get logged out
    res.json({ ok: true });
  });

  // ---------- admin ----------

  const admin = [requireLogin, requireAdmin];

  app.get('/api/admin/users', admin, (_req, res) => {
    const users = Object.values(db.users)
      .map(publicUser)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json({ users, settings: db.settings, admin: ADMIN_USERNAME });
  });

  app.put('/api/admin/settings', admin, (req, res) => {
    const signup = req.body?.signup;
    if (!['open', 'approval', 'closed'].includes(signup)) return bad(res, 400, 'signup must be open, approval or closed');
    db.settings.signup = signup;
    save();
    res.json({ settings: db.settings });
  });

  app.post('/api/admin/users', admin, (req, res) => {
    const username = String(req.body?.username || '').trim().toLowerCase();
    const invalid = validateCredentials(username, req.body?.password);
    if (invalid) return bad(res, 400, invalid);
    if (username === ADMIN_USERNAME || db.users[username]) return bad(res, 409, 'That username is taken', 'TAKEN');
    db.users[username] = {
      username,
      ...hashPassword(req.body.password),
      status: 'active',
      sv: crypto.randomBytes(6).toString('hex'),
      created_at: new Date().toISOString(),
    };
    save();
    res.status(201).json({ user: publicUser(db.users[username]) });
  });

  app.patch('/api/admin/users/:username', admin, (req, res) => {
    const u = db.users[String(req.params.username).toLowerCase()];
    if (!u) return bad(res, 404, 'User not found', 'NOT_FOUND');
    const { status, password } = req.body || {};
    if (status !== undefined) {
      if (!['active', 'disabled'].includes(status)) return bad(res, 400, 'status must be active or disabled');
      u.status = status;
    }
    if (password !== undefined) {
      const invalid = validateCredentials(u.username, password);
      if (invalid) return bad(res, 400, invalid);
      Object.assign(u, hashPassword(password));
    }
    u.sv = crypto.randomBytes(6).toString('hex'); // log the user out of existing sessions
    save();
    res.json({ user: publicUser(u) });
  });

  app.delete('/api/admin/users/:username', admin, (req, res) => {
    const name = String(req.params.username).toLowerCase();
    if (!db.users[name]) return bad(res, 404, 'User not found', 'NOT_FOUND');
    delete db.users[name];
    save();
    res.json({ ok: true });
  });
}
