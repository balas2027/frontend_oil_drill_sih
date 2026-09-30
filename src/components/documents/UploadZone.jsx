import { useRef, useState } from 'react';
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { documentsApi } from '../../api/documents';
import { apiErrorMessage } from '../../api/client';

const MAX_MB = 25;

/** Drag-and-drop multi-file PDF upload (Section 10.8). */
export default function UploadZone({ wellIds = [], onUploaded, disabled }) {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [wellId, setWellId] = useState('');
  const [uploads, setUploads] = useState([]);

  const update = (key, patch) =>
    setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    for (const file of files) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const entry = {
        key,
        name: file.name,
        size: file.size,
        progress: 0,
        state: 'uploading',
        message: '',
      };
      setUploads((u) => [entry, ...u].slice(0, 12));
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        update(key, { state: 'error', message: t('docs.upload.only_pdf') });
        continue;
      }
      if (file.size > MAX_MB * 1024 * 1024) {
        update(key, { state: 'error', message: t('docs.upload.too_large', { mb: MAX_MB }) });
        continue;
      }
      try {
        const res = await documentsApi.upload(file, {
          wellId: wellId || undefined,
          onProgress: (p) => update(key, { progress: p }),
        });
        update(key, {
          state: res.data.duplicate ? 'duplicate' : 'done',
          progress: 1,
          message: res.data.duplicate
            ? t('docs.upload.duplicate')
            : `${res.data.doc_type} · ${t('docs.upload.pages', { n: res.data.pages })} · ${
                res.data.pdf_kind
              } · ${res.data.well_id || t('docs.upload.no_well')}`,
          docId: res.data.doc_id,
        });
        onUploaded?.(res.data);
      } catch (err) {
        update(key, { state: 'error', message: apiErrorMessage(err, t('docs.upload.failed')) });
      }
    }
  };

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={t('docs.upload.aria')}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) =>
          !disabled && (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()
        }
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
        className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-royal-600 ${
          disabled
            ? 'border-line bg-slate-50 cursor-not-allowed opacity-60'
            : dragging
              ? 'border-royal-600 bg-royal-100 cursor-copy'
              : 'border-line bg-royal-50/50 hover:border-royal-500 cursor-pointer'
        }`}
      >
        <UploadCloud className="w-9 h-9 mx-auto text-royal-600 mb-2" aria-hidden="true" />
        <p className="text-sm font-semibold text-royal-900">
          {t('docs.upload.drop')}
        </p>
        <p className="text-[11px] text-ink-600 mt-1">
          {t('docs.upload.hint', { mb: MAX_MB })}
        </p>
        {disabled && (
          <p className="text-[11px] text-red-700 mt-1">
            {t('docs.upload.viewer')}
          </p>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      <label className="flex items-center gap-2 text-xs">
        <span className="text-ink-600">{t('docs.upload.link_well')}</span>
        <select
          value={wellId}
          onChange={(e) => setWellId(e.target.value)}
          className="text-xs border border-line rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-royal-600 focus:outline-none"
        >
          <option value="">{t('docs.upload.auto_detect')}</option>
          {wellIds.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </label>

      {uploads.length > 0 && (
        <ul className="space-y-1.5" aria-live="polite">
          {uploads.map((u) => {
            const Icon =
              u.state === 'error'
                ? AlertCircle
                : u.state === 'duplicate'
                  ? Copy
                  : u.state === 'done'
                    ? CheckCircle2
                    : FileText;
            return (
              <li
                key={u.key}
                className="flex items-center gap-2 text-xs bg-white border border-line rounded-lg px-2.5 py-1.5"
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    u.state === 'error'
                      ? 'text-red-600'
                      : u.state === 'uploading'
                        ? 'text-royal-600'
                        : 'text-emerald-600'
                  }`}
                  aria-hidden="true"
                />
                <span className="font-medium text-royal-900 truncate max-w-[40%]">{u.name}</span>
                {u.state === 'uploading' ? (
                  <div className="flex-1 h-1.5 bg-royal-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-royal-600 transition-all"
                      style={{ width: `${u.progress * 100}%` }}
                    />
                  </div>
                ) : (
                  <span
                    className={`flex-1 truncate ${u.state === 'error' ? 'text-red-700' : 'text-ink-600'}`}
                  >
                    {u.message}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
