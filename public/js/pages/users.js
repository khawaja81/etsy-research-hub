import { $, esc, api, send, toast, errorBox, loading, date } from '../ui.js';

const SIGNUP_MODES = [
  ['open', 'Open — anyone can sign up and use the app right away'],
  ['approval', 'Approval — new accounts wait until you approve them'],
  ['closed', 'Closed — only you can create accounts'],
];
const STATUS_BADGE = { active: 'good', pending: 'warn', disabled: 'bad' };

export async function render(view, ctx) {
  if (ctx.user.role !== 'admin') {
    view.innerHTML = '<div class="notice bad"><div>⚠️</div><div>This page is for the admin only.</div></div>';
    return;
  }
  view.innerHTML = `
    <div class="page-head"><div>
      <h1>Users</h1>
      <p>Manage who can log in. The admin account (<b>${esc(ctx.user.username)}</b>) is set with environment variables and is not listed here.</p>
    </div></div>
    <div class="grid split-wide">
      <div class="card"><div class="card-head"><h2>Accounts</h2><span class="muted small" id="count"></span></div><div id="list">${loading()}</div></div>
      <div class="stack">
        <div class="card stack">
          <h3>Sign up</h3>
          <label class="field">Who can create an account?
            <select class="input" id="signup-mode">${SIGNUP_MODES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
          </label>
        </div>
        <div class="card">
          <h3 style="margin-bottom:12px">Add a user</h3>
          <form class="auth-form" id="add-form">
            <label class="field">Username<input class="input" name="username" autocapitalize="none" spellcheck="false" autocomplete="off" required /></label>
            <label class="field">Password<input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required /></label>
            <div id="add-msg"></div>
            <button class="btn" type="submit">Create user</button>
          </form>
        </div>
      </div>
    </div>`;

  async function load() {
    let data;
    try {
      data = await api('/api/admin/users');
    } catch (err) {
      if (ctx.alive()) $('#list', view).innerHTML = errorBox(err);
      return;
    }
    if (!ctx.alive()) return;
    $('#signup-mode', view).value = data.settings.signup;
    $('#count', view).textContent = `${data.users.length} user${data.users.length === 1 ? '' : 's'}`;
    $('#list', view).innerHTML = data.users.length
      ? `<div class="table-wrap"><table class="data"><thead><tr><th>Username</th><th>Status</th><th>Joined</th><th>Last login</th><th></th></tr></thead><tbody>
        ${data.users
          .map(
            (u) => `<tr data-user="${esc(u.username)}">
              <td><b>${esc(u.username)}</b></td>
              <td><span class="badge ${STATUS_BADGE[u.status] || ''}">${esc(u.status)}</span></td>
              <td class="nowrap">${date(u.created_at)}</td>
              <td class="nowrap">${u.last_login ? date(u.last_login) : '<span class="muted">never</span>'}</td>
              <td class="nowrap" style="text-align:right">
                ${u.status === 'active' ? '<button class="btn xs secondary" data-act="disable">Disable</button>' : `<button class="btn xs" data-act="enable">${u.status === 'pending' ? 'Approve' : 'Enable'}</button>`}
                <button class="btn xs secondary" data-act="reset">Reset password</button>
                <button class="btn xs ghost bad-text" data-act="delete">Delete</button>
              </td></tr>`
          )
          .join('')}
        </tbody></table></div>`
      : '<div class="empty"><h2>No users yet</h2><p>Share the site link — people can sign up from the login page, or add them here.</p></div>';
  }

  $('#list', view).addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const row = btn.closest('tr');
    const name = row.dataset.user;
    const path = `/api/admin/users/${encodeURIComponent(name)}`;
    const act = btn.dataset.act;
    if (act === 'reset') return showReset(row, name, path);
    if (act === 'delete' && btn.dataset.armed !== '1') {
      // two-step delete instead of a browser confirm() dialog
      btn.dataset.armed = '1';
      btn.textContent = 'Click again to delete';
      return;
    }
    try {
      if (act === 'delete') await send('DELETE', path);
      else await send('PATCH', path, { status: act === 'enable' ? 'active' : 'disabled' });
      toast(act === 'delete' ? `Deleted ${name}` : `Updated ${name}`);
      load();
    } catch (err) {
      toast(err.message);
    }
  });

  // Inline row for typing a new password.
  function showReset(row, name, path) {
    if (row.nextElementSibling?.classList.contains('reset-row')) return;
    const tr = document.createElement('tr');
    tr.className = 'reset-row';
    tr.innerHTML = `<td colspan="5"><form class="row">
      <input class="input" type="password" autocomplete="new-password" minlength="8" placeholder="New password for ${esc(name)}" style="max-width:260px" required />
      <button class="btn sm" type="submit">Save</button><button class="btn sm ghost" type="button">Cancel</button></form></td>`;
    row.after(tr);
    const input = $('input', tr);
    input.focus();
    $('button[type=button]', tr).addEventListener('click', () => tr.remove());
    $('form', tr).addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await send('PATCH', path, { password: input.value });
        toast(`Password reset for ${name}`);
        tr.remove();
      } catch (err) {
        toast(err.message);
      }
    });
  }

  $('#signup-mode', view).addEventListener('change', async (e) => {
    try {
      await send('PUT', '/api/admin/settings', { signup: e.target.value });
      toast('Sign up setting saved');
    } catch (err) {
      toast(err.message);
      load();
    }
  });

  const form = $('#add-form', view);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#add-msg', view);
    const username = form.username.value.trim().toLowerCase();
    msg.innerHTML = '';
    try {
      await send('POST', '/api/admin/users', { username, password: form.password.value });
      toast(`Created ${username}`);
      form.reset();
      load();
    } catch (err) {
      msg.innerHTML = errorBox(err);
    }
  });

  await load();
}
