import { $, esc, send, toast, errorBox } from '../ui.js';

export async function render(view, ctx) {
  const user = ctx.user;
  const isAdmin = user.role === 'admin';
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>My Account</h1>
      <p>Logged in as <b>${esc(user.username)}</b>${isAdmin ? ' <span class="badge accent">Admin</span>' : ''}.</p>
    </div></div>
    <div class="card" style="max-width:480px">
      <h2 style="margin-bottom:12px">Change password</h2>
      <form class="auth-form" id="pw-form">
        <label class="field">Current password<input class="input" type="password" name="current" autocomplete="current-password" required /></label>
        <label class="field">New password<input class="input" type="password" name="password" autocomplete="new-password" minlength="8" required /></label>
        <label class="field">Confirm new password<input class="input" type="password" name="confirm" autocomplete="new-password" required /></label>
        <div id="pw-msg"></div>
        <button class="btn" type="submit">Update password</button>
      </form>
      ${
        isAdmin
          ? `<p class="small muted" style="margin-top:12px">Forgot the admin password? Change the <code>ADMIN_PASSWORD</code> variable (Railway → Variables or <code>.env</code>) and restart. The new value becomes the admin password.</p>`
          : ''
      }
    </div>`;

  const form = $('#pw-form', view);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#pw-msg', view);
    if (form.password.value !== form.confirm.value) {
      msg.innerHTML = '<div class="notice bad">New passwords do not match</div>';
      return;
    }
    msg.innerHTML = '';
    try {
      await send('POST', '/api/auth/password', { current: form.current.value, password: form.password.value });
      form.reset();
      toast('Password updated — other devices were logged out');
    } catch (err) {
      msg.innerHTML = errorBox(err);
    }
  });
}
