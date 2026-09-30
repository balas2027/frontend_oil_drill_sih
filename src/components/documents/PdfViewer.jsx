import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import i18n from '../../i18n';
import { useTranslation } from 'react-i18next';
import { documentsApi } from '../../api/documents';
import { apiErrorMessage } from '../../api/client';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

// One cached pdf.js document per docId (the viewer re-renders on page/zoom changes)
const cache = new Map();

async function loadPdf(docId) {
  if (!cache.has(docId)) {
    cache.set(
      docId,
      documentsApi.file(docId).then((res) => pdfjsLib.getDocument({ data: res.data }).promise)
    );
  }
  try {
    return await cache.get(docId);
  } catch (err) {
    cache.delete(docId);
    throw err;
  }
}

/**
 * Renders one page of a stored PDF with evidence highlights.
 * Highlight bboxes are PDF points, top-left origin: [x0, top, x1, bottom].
 * @param {{ docId: string, page: number, onPageChange?: (p: number) => void,
 *   highlights?: {bbox: number[], label?: string, tone?: 'primary'|'muted', page?: number}[] }} props
 */
export default function PdfViewer({ docId, page, onPageChange, highlights = [] }) {
  const { t } = useTranslation();
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [numPages, setNumPages] = useState(null);
  const [scale, setScale] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let task = null;
    setRendering(true);
    setError(null);
    (async () => {
      try {
        const pdf = await loadPdf(docId);
        if (cancelled) return;
        setNumPages(pdf.numPages);
        const pdfPage = await pdf.getPage(Math.min(Math.max(1, page), pdf.numPages));
        const base = pdfPage.getViewport({ scale: 1 });
        const fit = (wrapRef.current?.clientWidth || 600) / base.width;
        const s = fit * zoom;
        const viewport = pdfPage.getViewport({ scale: s * (window.devicePixelRatio || 1) });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${base.width * s}px`;
        canvas.style.height = `${base.height * s}px`;
        task = pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport });
        await task.promise;
        if (!cancelled) setScale(s);
      } catch (err) {
        if (!cancelled && err?.name !== 'RenderingCancelledException') {
          setError(apiErrorMessage(err, err?.message || i18n.t('docs.pdf.render_error')));
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [docId, page, zoom]);

  const visible = highlights.filter((h) => h.bbox && (h.page == null || h.page === page));

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between gap-2 px-2 py-1.5 border-b border-line bg-royal-50 text-[11px]">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange?.(page - 1)}
            disabled={page <= 1}
            className="p-1 rounded hover:bg-royal-100 disabled:opacity-40"
            aria-label={t('docs.pdf.prev')}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="tabular-nums">
            {t('docs.pdf.page_of', { page, total: numPages ?? '…' })}
          </span>
          <button
            type="button"
            onClick={() => onPageChange?.(page + 1)}
            disabled={numPages != null && page >= numPages}
            className="p-1 rounded hover:bg-royal-100 disabled:opacity-40"
            aria-label={t('docs.pdf.next')}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))}
            className="p-1 rounded hover:bg-royal-100"
            aria-label={t('docs.pdf.zoom_out')}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="tabular-nums w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
            className="p-1 rounded hover:bg-royal-100"
            aria-label={t('docs.pdf.zoom_in')}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div ref={wrapRef} className="flex-1 min-h-0 overflow-auto bg-slate-100 p-2">
        {error && (
          <p className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </p>
        )}
        <div className="relative inline-block shadow-sm bg-white">
          <canvas ref={canvasRef} aria-label={t('docs.pdf.canvas', { page })} role="img" />
          {scale &&
            !rendering &&
            visible.map((h, i) => {
              const [x0, y0, x1, y1] = h.bbox;
              const pad = 3;
              return (
                <div
                  key={i}
                  className={`absolute rounded-sm pointer-events-none ${
                    h.tone === 'muted'
                      ? 'border border-royal-500/60 bg-royal-500/10'
                      : 'border-2 border-gold-500 bg-gold-500/20 nwis-evidence-pulse'
                  }`}
                  style={{
                    left: x0 * scale - pad,
                    top: y0 * scale - pad,
                    width: (x1 - x0) * scale + pad * 2,
                    height: (y1 - y0) * scale + pad * 2,
                  }}
                  title={h.label}
                />
              );
            })}
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center text-xs text-royal-700 animate-pulse min-h-[200px] min-w-[200px]">
              {t('docs.pdf.rendering')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
