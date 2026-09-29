const MAX_CANVAS_PX = 16000;

/**
 * Render the chart's header + body SVGs into one PNG and download it.
 * Both SVGs use presentation attributes only (no CSS classes), so they
 * serialise faithfully.
 */
export async function exportChartPng(headerSvg, bodySvg, filename) {
  const width = Number(bodySvg.getAttribute('width'));
  const headH = Number(headerSvg.getAttribute('height'));
  const bodyH = Number(bodySvg.getAttribute('height'));
  const height = headH + bodyH;
  const xml =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `font-family="Noto Sans, Inter, Arial, sans-serif">` +
    `<rect width="100%" height="100%" fill="#ffffff"/>${headerSvg.innerHTML}` +
    `<g transform="translate(0,${headH})">${bodySvg.innerHTML}</g></svg>`;

  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not render the chart image'));
      el.src = url;
    });
    const scale = Math.max(0.5, Math.min(2, MAX_CANVAS_PX / Math.max(width, height)));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
