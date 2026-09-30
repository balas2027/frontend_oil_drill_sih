import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Save, Send } from 'lucide-react';
import { adminApi } from '../../api/admin';
import { apiErrorMessage } from '../../api/client';
import { alertLevel } from '../risk/riskUtils';

const input =
  'text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none';
const when = (iso) =>
  iso ? new Date(iso).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '—';

/** Alert e-mail settings (Gmail API): who receives which alert levels, test send, delivery log. */
export default function NotificationsTab() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState(null);
  const [form, setForm] = useState(null);
  const [log, setLog] = useState([]);
  const [testTo, setTestTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const [c, l] = await Promise.all([adminApi.notifications(), adminApi.emailLog()]);
      setCfg(c.data);
      setForm({ ...c.data, recipients: c.data.recipients.join('\n') });
      setLog(l.data.entries);
      setError(null);
    } catch (err) {
      setError(apiErrorMessage(err, t('admin.request_failed')));
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await adminApi.saveNotifications({
        enabled: form.enabled,
        min_level: form.min_level,
        roles: form.roles,
        cooldown_minutes: Number(form.cooldown_minutes) || 0,
        recipients: form.recipients.split(/[\s,;]+/).filter(Boolean),
      });
      setMsg(t('admin.mail.saved'));
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t('admin.request_failed')));
    } finally {
      setBusy(false);
    }
  };

  const sendTest = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminApi.testEmail(testTo.split(/[\s,;]+/).filter(Boolean));
      setMsg(
        res.data.status === 'sent'
          ? t('admin.mail.test_sent', { to: res.data.recipients.join(', ') })
          : t('admin.mail.test_failed', { error: res.data.error })
      );
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t('admin.request_failed')));
    } finally {
      setBusy(false);
    }
  };

  if (error && !cfg) return <p className="text-xs text-red-700">{error}</p>;
  if (!form) return <p className="text-xs text-ink-600 animate-pulse">{t('common.loading')}</p>;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const toggleRole = (r) =>
    set('roles', form.roles.includes(r) ? form.roles.filter((x) => x !== r) : [...form.roles, r]);

  return (
    <div className="space-y-4 text-xs">
      <p
        className={`p-2 rounded border ${cfg.configured ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-gold-100 border-gold-500/40 text-[#6B5310]'}`}
      >
        <Mail className="w-3.5 h-3.5 inline mr-1" aria-hidden="true" />
        {cfg.configured
          ? t('admin.mail.configured', { sender: cfg.sender })
          : t('admin.mail.not_configured')}
        {!cfg.master_switch && ` · ${t('admin.mail.master_off')}`}
      </p>
      {error && <p className="text-red-700">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-royal-50 border border-royal-100 rounded-lg p-3 space-y-3">
          <label className="flex items-center gap-2 font-semibold text-royal-900">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set('enabled', e.target.checked)}
              className="accent-royal-700"
            />
            {t('admin.mail.enabled')}
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-600">{t('admin.mail.min_level')}</span>
            <select
              value={form.min_level}
              onChange={(e) => set('min_level', e.target.value)}
              className={input}
            >
              {cfg.levels.map((l) => (
                <option key={l} value={l}>
                  {alertLevel(l).label}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend className="text-ink-600 mb-1">{t('admin.mail.roles')}</legend>
            <div className="flex flex-wrap gap-3">
              {cfg.all_roles.map((r) => (
                <label key={r} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={form.roles.includes(r)}
                    onChange={() => toggleRole(r)}
                    className="accent-royal-700"
                  />
                  {t(`common.role.${r}`)}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-600">{t('admin.mail.recipients')}</span>
            <textarea
              rows={3}
              value={form.recipients}
              onChange={(e) => set('recipients', e.target.value)}
              placeholder="name@oil.in"
              className={input}
            />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-ink-600">{t('admin.mail.cooldown')}</span>
            <input
              type="number"
              min="0"
              max="1440"
              value={form.cooldown_minutes}
              onChange={(e) => set('cooldown_minutes', e.target.value)}
              className={`${input} w-24`}
            />
          </label>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white font-medium disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" /> {t('common.save')}
          </button>
        </section>

        <section className="space-y-3">
          <div>
            <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
              {t('admin.mail.resolved')} ({cfg.resolved_recipients.length})
            </h3>
            <p className="text-ink-900 break-words">
              {cfg.resolved_recipients.join(', ') || t('admin.mail.nobody')}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 flex-1">
              <span className="text-ink-600">{t('admin.mail.test_to')}</span>
              <input
                type="email"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                placeholder="name@oil.in"
                className={input}
              />
            </label>
            <button
              type="button"
              onClick={sendTest}
              disabled={busy || !cfg.configured || !testTo.trim()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-royal-700 text-royal-700 hover:bg-royal-100 font-medium disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" /> {t('admin.mail.send_test')}
            </button>
          </div>
          {msg && (
            <p role="status" className="text-royal-900">
              {msg}
            </p>
          )}
        </section>
      </div>

      <section>
        <h3 className="text-[10px] uppercase font-bold tracking-wider text-royal-700 mb-1">
          {t('admin.mail.log')}
        </h3>
        {log.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <tbody>
                {log.map((e) => (
                  <tr key={e._id} className="border-b border-line/60">
                    <td className="py-1 pr-2 whitespace-nowrap text-ink-600">{when(e.ts)}</td>
                    <td className="py-1 pr-2">
                      <span
                        className={`px-1.5 rounded text-[10px] font-semibold ${
                          e.status === 'sent'
                            ? 'bg-emerald-50 text-emerald-800'
                            : e.status === 'failed'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-100 text-ink-600'
                        }`}
                      >
                        {t(`admin.mail.status.${e.status}`, { defaultValue: e.status })}
                      </span>
                    </td>
                    <td className="py-1 pr-2">
                      {e.kind === 'test' ? t('admin.mail.test') : `${e.well_id} · ${e.level}`}
                    </td>
                    <td className="py-1 text-ink-600 break-words">
                      {(e.recipients || []).join(', ') || e.reason || e.error || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-ink-600">{t('admin.mail.no_log')}</p>
        )}
      </section>
    </div>
  );
}
