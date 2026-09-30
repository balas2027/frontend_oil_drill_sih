import { useState } from 'react';
import { ThumbsUp, ThumbsDown, ShieldCheck, BookmarkPlus, FileText, Database } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { knowledgeApi, splitCitations } from '../../api/knowledge';
import { formatEventType } from '../map/eventStyles';

const CONF = {
  high: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  medium: 'bg-gold-100 text-[#6B5310] border-gold-500/40',
  low: 'bg-orange-50 text-orange-800 border-orange-200',
  none: 'bg-slate-100 text-ink-600 border-line',
};

/** One Ask-NWIS answer: sentences with clickable [n] citations, sources, feedback. */
export default function AnswerCard({ result, activeCitation, onCite, onSaveLesson, canCurate }) {
  const { t } = useTranslation();
  const [feedback, setFeedback] = useState(null);
  const conf = result.confidence || {};

  const send = async (useful) => {
    setFeedback(useful);
    try {
      await knowledgeApi.feedback(result.answer_id, useful);
    } catch {
      setFeedback(null);
    }
  };

  const eventIds = result.citations.filter((c) => c.kind === 'event').map((c) => c.event_id);

  return (
    <article
      className="bg-white border border-line rounded-xl shadow-sm p-4 space-y-3"
      aria-label={t('kn.answer.aria')}
    >
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span
          className={`px-1.5 py-0.5 rounded border font-semibold capitalize ${CONF[conf.level] || CONF.none}`}
        >
          {t('confidence.label', { level: t(`confidence.${conf.level || 'none'}`) })}
        </span>
        <span className="text-ink-600 tabular-nums">
          {t('kn.answer.based_on', { events: conf.events ?? 0, wells: conf.wells ?? 0 })}
          {conf.report_passages
            ? ` + ${t('kn.answer.passages', { n: conf.report_passages })}`
            : ''}
        </span>
        <span className="text-ink-600 capitalize">
          · {t('kn.answer.intent', { intent: result.parsed?.intent })}
        </span>
      </div>

      <div className="space-y-1.5 text-sm leading-relaxed text-ink-900">
        {result.sentences.map((s, i) => (
          <p key={i}>
            {splitCitations(s).map((part, j) =>
              part.cite ? (
                <button
                  key={j}
                  type="button"
                  onClick={() => onCite(result.citations.find((c) => c.n === part.cite))}
                  className={`mx-0.5 px-1 rounded text-[10px] font-bold align-super tabular-nums ${
                    activeCitation?.n === part.cite && activeCitation?._answer === result.answer_id
                      ? 'bg-gold-500 text-royal-900'
                      : 'bg-royal-100 text-royal-700 hover:bg-royal-600 hover:text-white'
                  }`}
                  aria-label={t('kn.answer.open_citation', { n: part.cite })}
                >
                  {part.cite}
                </button>
              ) : (
                <span key={j}>{part.text}</span>
              )
            )}
          </p>
        ))}
      </div>

      {result.citations.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-royal-700 font-semibold">
            {t('kn.answer.sources', { n: result.citations.length })}
          </summary>
          <ol className="mt-1.5 space-y-1">
            {result.citations.map((c) => (
              <li key={c.n}>
                <button
                  type="button"
                  onClick={() => onCite(c)}
                  className="w-full text-left flex gap-2 items-start px-2 py-1 rounded hover:bg-royal-50"
                >
                  <span className="text-royal-700 font-bold tabular-nums">[{c.n}]</span>
                  {c.doc_id ? (
                    <FileText
                      className="w-3.5 h-3.5 mt-0.5 text-royal-600 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <Database
                      className="w-3.5 h-3.5 mt-0.5 text-ink-600 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span className="text-ink-900">
                    {c.kind === 'event'
                      ? `${c.well_id} · ${formatEventType(c.type)} · ${c.depth_from_md}–${c.depth_to_md} m`
                      : c.filename}
                    {c.doc_id && <span className="text-ink-600">
                        {' '}
                        · {t('docs.review.page_short', { page: c.page })}
                      </span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </details>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
        <p className="text-[10px] text-ink-600 flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
          {t('kn.answer.checked')} · {result.disclaimer}
        </p>
        <div className="flex items-center gap-1">
          {canCurate && eventIds.length > 0 && (
            <button
              type="button"
              onClick={() => onSaveLesson?.(eventIds)}
              className="flex items-center gap-1 text-[11px] border border-royal-700 text-royal-700 hover:bg-royal-100 px-2 py-1 rounded-md"
            >
              <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" /> {t('kn.answer.save_lesson')}
            </button>
          )}
          <span className="text-[10px] text-ink-600 ml-1">{t('kn.answer.useful_q')}</span>
          <button
            type="button"
            onClick={() => send(true)}
            aria-pressed={feedback === true}
            className={`p-1 rounded ${feedback === true ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-royal-50 text-ink-600'}`}
            aria-label={t('kn.answer.useful')}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => send(false)}
            aria-pressed={feedback === false}
            className={`p-1 rounded ${feedback === false ? 'bg-red-100 text-red-700' : 'hover:bg-royal-50 text-ink-600'}`}
            aria-label={t('kn.answer.not_useful')}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
}
