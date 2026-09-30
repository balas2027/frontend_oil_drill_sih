import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, Paperclip, Send, X } from 'lucide-react';
import { riskApi } from '../../api/risk';
import { apiErrorMessage } from '../../api/client';
import { fmtPct } from './riskUtils';

const input =
  'w-full text-xs border border-line rounded-md px-2 py-1.5 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none';

/**
 * Send one risk box by e-mail: the server re-computes the look-ahead and mails the
 * alert data plus its source events, with the source report PDFs attached.
 */
export default function RiskEmailDialog({ wellId, risk, depthMd, radiusKm, onClose }) {
  const { t } = useTranslation();
  const [users, setUsers] = useState([]);
  const [configured, setConfigured] = useState(true);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [attach, setAttach] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    riskApi
      .recipients()
      .then((res) => {
        setUsers(res.data.users);
        setConfigured(res.data.configured);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const addresses = to.split(/[\s,;]+/).filter(Boolean);
  const addUser = (email) =>
    !addresses.includes(email) && setTo((cur) => (cur.trim() ? `${cur.trim()}, ${email}` : email));

  const send = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await riskApi.email(wellId, {
        risk_type: risk.type,
        to: addresses,
        depth_md: depthMd,
        radius_km: radiusKm,
        note: note.trim() || undefined,
        attach_sources: attach,
      });
      setResult(res.data);
    } catch (err) {
      setError(apiErrorMessage(err, t('risk.mail.failed')));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-royal-900/40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t('risk.mail.title')}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        onSubmit={send}
        className="bg-white rounded-xl shadow-xl border border-line w-full max-w-lg text-xs"
      >
        <div className="px-4 py-3 border-b border-line bg-royal-50 flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-royal-900 flex items-center gap-1.5">
              <Mail className="w-4 h-4" aria-hidden="true" /> {t('risk.mail.title')}
            </h3>
            <p className="text-ink-600 mt-0.5">
              {wellId} · {t(`risk_types.${risk.type}`, { defaultValue: risk.label })} ·{' '}
              {fmtPct(risk.probability)} · {t('risk.mail.at', { depth: Math.round(depthMd ?? 0) })}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded hover:bg-royal-100"
            aria-label={t('kn.lesson.close')}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="p-4 space-y-2">
            <p className="p-2 rounded bg-emerald-50 border border-emerald-200 text-emerald-800">
              {t('risk.mail.sent', { to: result.recipients.join(', ') })}
            </p>
            <p className="text-ink-600">
              {t('risk.mail.contents', { events: result.events, alerts: result.alerts })}
            </p>
            {result.attachments.length > 0 && (
              <p className="flex items-center gap-1 text-ink-600">
                <Paperclip className="w-3.5 h-3.5" aria-hidden="true" />
                {result.attachments.join(', ')}
              </p>
            )}
            {result.skipped_attachments?.length > 0 && (
              <p className="text-[#6B5310]">
                {t('risk.mail.skipped', { files: result.skipped_attachments.join(', ') })}
              </p>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white font-medium"
              >
                {t('kn.lesson.close')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {!configured && (
              <p className="p-2 rounded bg-gold-100 border border-gold-500/40 text-[#6B5310]">
                {t('admin.mail.not_configured')}
              </p>
            )}
            <label className="block space-y-1">
              <span className="font-semibold text-ink-600">{t('risk.mail.to')}</span>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="name@company.com"
                className={input}
                required
                autoFocus
              />
            </label>
            {users.length > 0 && (
              <div className="flex flex-wrap gap-1" aria-label={t('risk.mail.people')}>
                {users.map((u) => (
                  <button
                    key={u.email}
                    type="button"
                    onClick={() => addUser(u.email)}
                    title={u.email}
                    className={`px-2 py-0.5 rounded-full border text-[11px] ${
                      addresses.includes(u.email)
                        ? 'bg-royal-700 text-white border-royal-700'
                        : 'border-line hover:bg-royal-50 text-royal-900'
                    }`}
                  >
                    {u.name || u.email} · {t(`common.role.${u.role}`, { defaultValue: u.role })}
                  </button>
                ))}
              </div>
            )}
            <label className="block space-y-1">
              <span className="font-semibold text-ink-600">{t('risk.mail.note')}</span>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={1000}
                className={input}
              />
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={attach}
                onChange={(e) => setAttach(e.target.checked)}
                className="accent-royal-700"
              />
              {t('risk.mail.attach')}
            </label>
            <p className="text-[11px] text-ink-600">{t('risk.mail.includes')}</p>
            {error && (
              <p className="p-2 rounded bg-red-50 border border-red-200 text-red-700">{error}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 rounded-lg border border-line hover:bg-royal-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={busy || !addresses.length || !configured}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-royal-700 hover:bg-royal-900 text-white font-medium disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" aria-hidden="true" />
                {busy ? t('risk.mail.sending') : t('risk.mail.send')}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
