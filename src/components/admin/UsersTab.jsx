import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, UserPlus } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { apiErrorMessage } from '../../api/client';
import { useAuthStore } from '../../store/authStore';

const ROLES = ['viewer', 'engineer', 'reviewer', 'admin'];
const input =
  'border border-line rounded-md px-2 py-1.5 text-xs bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none';
const EMPTY = { email: '', name: '', role: 'engineer', password: '' };

export default function UsersTab() {
  const { t } = useTranslation();
  const me = useAuthStore((s) => s.user);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = () =>
    adminApi
      .users()
      .then((res) => setUsers(res.data.users))
      .catch((err) => setError(apiErrorMessage(err, 'Could not load users.')));
  useEffect(() => {
    load();
  }, []);

  const run = async (key, fn, okMsg) => {
    setBusy(key);
    setError(null);
    setMsg(null);
    try {
      await fn();
      if (okMsg) setMsg(okMsg);
      await load();
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, 'Request failed.'));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const create = async (e) => {
    e.preventDefault();
    if (await run('new', () => adminApi.createUser(form), t('admin.users.created'))) setForm(EMPTY);
  };

  const resetPassword = (u) => {
    const pw = window.prompt(`${t('admin.users.reset_password')}: ${u.email}`);
    if (pw)
      run(
        u.id,
        () => adminApi.updateUser(u.id, { password: pw }),
        `${t('admin.users.reset_password')} ✓`
      );
  };

  return (
    <div className="space-y-4 text-xs">
      <p className="text-[11px] text-ink-600">{t('admin.users.roles_help')}</p>

      <form
        onSubmit={create}
        className="flex flex-wrap items-end gap-2 bg-royal-50 border border-royal-100 rounded-lg p-3"
      >
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-ink-600">{t('admin.users.email')}</span>
          <input
            type="email"
            required
            value={form.email}
            className={input}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-ink-600">{t('admin.users.name')}</span>
          <input
            required
            minLength={2}
            value={form.name}
            className={input}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-ink-600">{t('admin.users.role')}</span>
          <select
            value={form.role}
            className={input}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`common.role.${r}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-ink-600">{t('admin.users.password')}</span>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            className={input}
            autoComplete="new-password"
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </label>
        <button
          type="submit"
          disabled={busy === 'new'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white font-medium disabled:opacity-50"
        >
          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" /> {t('admin.users.create')}
        </button>
      </form>

      {error && (
        <p role="alert" className="p-2 bg-red-50 border border-red-200 text-red-700 rounded">
          {error}
        </p>
      )}
      {msg && (
        <p
          role="status"
          className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded"
        >
          {msg}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-royal-50 text-royal-700 uppercase text-[10px] tracking-wider text-left">
              <th className="px-3 py-2">{t('admin.users.name')}</th>
              <th className="px-3 py-2">{t('admin.users.email')}</th>
              <th className="px-3 py-2">{t('admin.users.role')}</th>
              <th className="px-3 py-2">{t('admin.users.active')}</th>
              <th className="px-3 py-2">{t('admin.users.last_activity')}</th>
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className={`border-b border-line/60 hover:bg-royal-50/50 ${u.is_active ? '' : 'opacity-60'}`}
              >
                <td className="px-3 py-2 font-medium text-royal-900">
                  {u.name}
                  {u.email === me?.email && (
                    <span className="ml-1 text-[10px] text-ink-600">(you)</span>
                  )}
                </td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    aria-label={`${t('admin.users.role')} ${u.email}`}
                    disabled={busy === u.id}
                    className={input}
                    onChange={(e) =>
                      run(u.id, () => adminApi.updateUser(u.id, { role: e.target.value }))
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`common.role.${r}`)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    disabled={busy === u.id}
                    onClick={() =>
                      run(u.id, () => adminApi.updateUser(u.id, { is_active: !u.is_active }))
                    }
                    className="px-2 py-1 rounded-md border border-line hover:bg-royal-100 disabled:opacity-50"
                  >
                    {u.is_active ? t('admin.users.deactivate') : t('admin.users.activate')}
                  </button>
                </td>
                <td className="px-3 py-2 tabular-nums text-ink-600">
                  {u.last_activity
                    ? new Date(u.last_activity).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })
                    : '—'}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => resetPassword(u)}
                    className="inline-flex items-center gap-1 text-royal-600 hover:underline"
                  >
                    <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />{' '}
                    {t('admin.users.reset_password')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
