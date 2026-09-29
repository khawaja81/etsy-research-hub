// Login / sign up page. Kept separate from the app bundle so it loads without a session.
const $ = (sel) => document.querySelector(sel);
const form = $('#form');
let mode = 'login';
let signupMode = 'open';

async function post(path, data) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(data),
  });
  let body = {};
  try {
    body = await res.json();
  } catch {
    /* non-json */
  }
  return { ok: res.ok, status: res.status, body };
}

function message(text, kind = 'bad') {
  const box = $('#msg');
  box.innerHTML = '';
  if (!text) return;
  const div = document.createElement('div');
  div.className = `notice ${kind}`;
  div.textContent = text;
  box.appendChild(div);
}

function setMode(next) {
  mode = next;
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  const signup = mode === 'signup';
  $('#confirm-wrap').classList.toggle('hidden', !signup);
  $('#rules').classList.toggle('hidden', !signup);
  form.password.autocomplete = signup ? 'new-password' : 'current-password';
  $('#submit').textContent = signup ? 'Create account' : 'Log in';
  document.title = `${signup ? 'Sign up' : 'Log in'} · Etsy Research Hub`;
  message(signup && signupMode === 'approval' ? 'New accounts need admin approval before they can log in.' : '', 'warn');
  form.username.focus();
}

$('#tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-mode]');
  if (b) setMode(b.dataset.mode);
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = form.username.value.trim().toLowerCase();
  const password = form.password.value;
  if (!username || !password) return message('Enter your username and password');
  if (mode === 'signup' && password !== form.confirm.value) return message('Passwords do not match');

  const btn = $('#submit');
  btn.disabled = true;
  message('');
  try {
    const r = await post(mode === 'signup' ? '/api/auth/signup' : '/api/auth/login', { username, password });
    if (r.ok && r.body.pending) {
      form.reset();
      setMode('login');
      message('Account created. You can log in once the admin approves it.', 'accent');
    } else if (r.ok) {
      location.href = '/';
    } else {
      message(r.body.error || `Something went wrong (${r.status})`);
    }
  } catch {
    message('Server not reachable. Check your connection and try again.');
  }
  btn.disabled = false;
});

(async () => {
  // Already logged in? Go straight to the app.
  try {
    const me = await fetch('/api/auth/me', { headers: { accept: 'application/json' } });
    if (me.ok) return location.replace('/');
    const cfg = await (await fetch('/api/auth/config')).json();
    signupMode = cfg.signup;
  } catch {
    /* offline: the form still works once the server is back */
  }
  if (signupMode === 'closed') $('#tabs').classList.add('hidden');
  setMode(location.hash === '#signup' && signupMode !== 'closed' ? 'signup' : 'login');
})();
