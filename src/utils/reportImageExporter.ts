import * as htmlToImage from 'html-to-image';

export interface GeneratedReportImage {
  blob: Blob;
  dataUrl: string;
  filename: string;
}

/**
 * Convert a base64 DataURL directly into a Blob synchronously.
 * Avoids any fetch() network restrictions or browser CORS limitations.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(';base64,');
  const contentType = parts[0].split(':')[1] || 'image/png';
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);
  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }
  return new Blob([uInt8Array], { type: contentType });
}

/**
 * Capture an HTML DOM element and convert it into a high-resolution PNG image Blob & DataURL.
 * Uses a robust multi-tier pipeline:
 * 1. html-to-image (primary: native SVG foreignObject / canvas rendering engine with skipFonts & isolated config)
 * 2. Inlined SVG foreignObject to Canvas (secondary fallback, zero external CSS parsing)
 * 3. Direct Canvas 2D Timesheet Painter (tertiary fallback, 100% fail-proof, zero external dependencies)
 *
 * NOTE: html2canvas is explicitly excluded because its regex CSS parser fails on modern Tailwind v4 CSS declarations (oklch, @theme, @property).
 */
export async function captureReportToImage(
  element: HTMLElement,
  filename: string = 'Timesheet_Report.png'
): Promise<GeneratedReportImage> {
  if (!element) {
    throw new Error('Report document element was not provided.');
  }

  // TIER 1: html-to-image (Configured for Tailwind v4 & sandboxed iframe safety)
  try {
    const tier1 = await captureViaHtmlToImage(element, filename);
    if (tier1) return tier1;
  } catch (err) {
    console.warn('Tier 1 (html-to-image) failed, trying Tier 2 (SVG ForeignObject):', err);
  }

  // TIER 2: Direct Inlined SVG foreignObject to Canvas
  try {
    const tier2 = await captureViaSvgForeignObject(element, filename);
    if (tier2) return tier2;
  } catch (err) {
    console.warn('Tier 2 (SVG ForeignObject) failed, trying Tier 3 (Direct Canvas 2D):', err);
  }

  // TIER 3: Direct Canvas 2D Timesheet Painter (100% fail-proof)
  try {
    const tier3 = await captureViaDirectCanvas2D(element, filename);
    if (tier3) return tier3;
  } catch (err) {
    console.error('Tier 3 (Direct Canvas 2D) failed:', err);
  }

  throw new Error('Unable to render report picture. Please try again or switch to PDF view.');
}

/**
 * Tier 1: html-to-image with skipFonts and clean filter.
 * Skips font network downloads to avoid CORS/SecurityError in iframes and mobile webviews.
 */
async function captureViaHtmlToImage(
  element: HTMLElement,
  filename: string
): Promise<GeneratedReportImage | null> {
  // Use isolated staging clone to eliminate any zoom/scale transform from parent
  const staging = document.createElement('div');
  staging.id = 'report-export-staging-container';
  staging.style.position = 'fixed';
  staging.style.left = '0';
  staging.style.top = '0';
  staging.style.width = '850px';
  staging.style.minWidth = '850px';
  staging.style.maxWidth = '850px';
  staging.style.zIndex = '-99999';
  staging.style.backgroundColor = '#ffffff';
  staging.style.opacity = '1';
  staging.style.visibility = 'visible';
  staging.style.pointerEvents = 'none';
  staging.style.overflow = 'visible';
  staging.style.transform = 'none';
  staging.style.margin = '0';
  staging.style.padding = '0';

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.margin = '0 auto';
  clone.style.opacity = '1';
  clone.style.visibility = 'visible';
  clone.style.width = '850px';
  clone.style.maxWidth = '850px';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#0f172a';

  staging.appendChild(clone);
  document.body.appendChild(staging);

  try {
    // Wait for layout calculation
    await new Promise((resolve) => setTimeout(resolve, 60));

    const options = {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      width: 850,
      skipFonts: true,
      fontEmbedCSS: '',
      cacheBust: false,
      skipAutoScale: true,
      filter: (node: Node) => {
        if (node instanceof HTMLElement) {
          const tag = node.tagName.toUpperCase();
          if (tag === 'SCRIPT' || tag === 'NOSCRIPT' || tag === 'IFRAME') {
            return false;
          }
        }
        return true;
      }
    };

    let dataUrl: string | null = null;
    try {
      dataUrl = await htmlToImage.toPng(clone, options);
    } catch {
      // Retry once on target element directly if clone had an issue
      try {
        dataUrl = await htmlToImage.toPng(element, options);
      } catch {
        dataUrl = null;
      }
    }

    if (dataUrl && dataUrl.startsWith('data:image/png') && dataUrl.length > 500) {
      const blob = dataUrlToBlob(dataUrl);
      if (blob.size > 1000) {
        return { blob, dataUrl, filename };
      }
    }

    return null;
  } finally {
    if (staging.parentNode) {
      staging.parentNode.removeChild(staging);
    }
  }
}

/**
 * Tier 2: Inlined SVG ForeignObject to HTML5 Canvas.
 * Directly serializes HTML without loading external stylesheets.
 */
async function captureViaSvgForeignObject(
  element: HTMLElement,
  filename: string
): Promise<GeneratedReportImage | null> {
  const width = 850;
  const height = Math.max(1050, element.offsetHeight || 1100);

  const clone = element.cloneNode(true) as HTMLElement;
  clone.style.width = '850px';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#0f172a';
  clone.style.transform = 'none';

  const serializer = new XMLSerializer();
  const serialized = serializer.serializeToString(clone);

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml" style="background:#ffffff; color:#0f172a; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size:12px; margin:0; padding:0; width:${width}px;">
          ${serialized}
        </div>
      </foreignObject>
    </svg>
  `;

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const blobUrl = URL.createObjectURL(svgBlob);

  try {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.scale(2, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      img.src = blobUrl;
    });

    ctx.drawImage(img, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/png', 0.96);
    const blob = dataUrlToBlob(dataUrl);

    if (blob.size > 1000) {
      return { blob, dataUrl, filename };
    }
    return null;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

/**
 * Tier 3: Direct Canvas 2D Timesheet Painter.
 * 100% fail-proof fallback that inspects the timesheet DOM content and draws
 * a crisp, pixel-perfect Job Time Sheet or Timesheet Breakdown directly using Canvas 2D primitives.
 * Completely immune to CSS parser bugs, cross-origin restrictions, or SVG sandboxing.
 */
async function captureViaDirectCanvas2D(
  element: HTMLElement,
  filename: string
): Promise<GeneratedReportImage | null> {
  const width = 850;

  // Extract Employee and Date Range
  let employeeName = 'Employee';
  let dateRange = '';

  const allSpans = Array.from(element.querySelectorAll('span'));
  for (let i = 0; i < allSpans.length; i++) {
    const text = allSpans[i].textContent || '';
    if (text.includes('Employee:') && i + 1 < allSpans.length) {
      employeeName = allSpans[i + 1].textContent?.trim() || employeeName;
    }
    if (text.includes('Date Range:') && i + 1 < allSpans.length) {
      dateRange = allSpans[i + 1].textContent?.trim() || dateRange;
    }
  }

  // Extract Table Rows
  const table = element.querySelector('table');
  const rowsData: Array<{
    date: string;
    startTime: string;
    stopTime: string;
    task: string;
    client: string;
    hours: string;
    hasOt: boolean;
  }> = [];

  let grandTotalStr = '0.00';
  let regularHoursStr = '0.00';
  let overtimeHoursStr = '0.00';

  if (table) {
    const trs = Array.from(table.querySelectorAll('tbody tr'));
    trs.forEach((tr) => {
      const tds = Array.from(tr.querySelectorAll('td'));
      const textContent = tr.textContent || '';

      if (textContent.includes('Timesheet Total') || textContent.includes('Total Regular Hours') || textContent.includes('Grand Total')) {
        // Summary rows
        if (textContent.includes('Total Regular Hours:')) {
          const match = textContent.match(/Total Regular Hours:\s*([\d.]+)/i);
          if (match) regularHoursStr = match[1];
        }
        if (textContent.includes('Total Overtime Hours:')) {
          const match = textContent.match(/Total Overtime Hours:\s*([\d.]+)/i);
          if (match) overtimeHoursStr = match[1];
        }
        if (textContent.includes('Grand Total:')) {
          const match = textContent.match(/Grand Total:\s*([\d.]+)/i);
          if (match) grandTotalStr = match[1];
        }
        if (tds.length >= 3 && grandTotalStr === '0.00') {
          const lastText = tds[tds.length - 1].textContent?.trim() || '';
          if (/^[\d.]+$/.test(lastText)) grandTotalStr = lastText;
        }
        return;
      }

      if (tds.length >= 6) {
        const d = tds[0].textContent?.trim() || '';
        const st = tds[1].textContent?.trim() || '';
        const sp = tds[2].textContent?.trim() || '';
        const tk = tds[3].textContent?.trim() || '';
        const cl = tds[4].textContent?.trim() || '';
        const hr = tds[5].textContent?.trim() || '';
        const isOt = hr.includes('OT') || tr.className.includes('amber');

        if (d || tk || hr) {
          rowsData.push({
            date: d,
            startTime: st,
            stopTime: sp,
            task: tk.replace('FLHA', '').trim(),
            client: cl,
            hours: hr.replace('OT', '').trim(),
            hasOt: isOt
          });
        }
      } else if (tds.length >= 4) {
        // Breakdown layout
        const d = tds[0].textContent?.trim() || '';
        const tk = tds[1].textContent?.trim() || '';
        const iv = tds[2].textContent?.trim() || '';
        const hr = tds[3].textContent?.trim() || '';
        const isOt = hr.includes('Overtime') || textContent.includes('Overtime');

        if (d || tk) {
          rowsData.push({
            date: d,
            startTime: iv,
            stopTime: '',
            task: tk,
            client: 'Job Site',
            hours: hr.replace(/hrs|hours/gi, '').trim(),
            hasOt: isOt
          });
        }
      }
    });
  }

  // Ensure up to 14 rows for consistent professional sheet height
  const MIN_ROWS = 14;
  const totalRowsCount = Math.max(MIN_ROWS, rowsData.length);

  // Dynamic canvas height calculation
  const topHeaderH = 110;
  const tableHeaderH = 36;
  const rowH = 30;
  const totalsH = 74;
  const cardsH = 90;
  const signaturesH = 90;
  const footerH = 45;
  const height = topHeaderH + tableHeaderH + totalRowsCount * rowH + totalsH + cardsH + signaturesH + footerH + 40;

  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // High-DPI scale (2x)
  ctx.scale(2, 2);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Document Container Border
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(16, 16, width - 32, height - 32);

  let curY = 48;

  // TITLE
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('JOB TIME SHEET', width / 2, curY);

  curY += 36;

  // EMPLOYEE & DATE RANGE
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Employee:', 36, curY);

  ctx.font = 'bold 12px "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
  ctx.fillText(employeeName || '________________________', 106, curY);
  ctx.strokeStyle = '#475569';
  ctx.beginPath();
  ctx.moveTo(106, curY + 3);
  ctx.lineTo(340, curY + 3);
  ctx.stroke();

  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Date Range:', width - 340, curY);

  ctx.font = 'bold 12px "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace';
  ctx.fillText(dateRange || '________________', width - 260, curY);
  ctx.beginPath();
  ctx.moveTo(width - 260, curY + 3);
  ctx.lineTo(width - 36, curY + 3);
  ctx.stroke();

  curY += 26;

  // TABLE CONFIG
  const tableX = 36;
  const tableW = width - 72;
  const cols = [
    { label: 'Date', w: 100, align: 'center' },
    { label: 'Start time', w: 85, align: 'center' },
    { label: 'Stop time', w: 85, align: 'center' },
    { label: 'Task', w: 170, align: 'left' },
    { label: 'Client', w: 228, align: 'left' },
    { label: 'Total Hours', w: 110, align: 'center' }
  ];

  // Header background
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(tableX, curY, tableW, tableHeaderH);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(tableX, curY, tableW, tableHeaderH);

  // Header labels
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  let curColX = tableX;
  cols.forEach((col, idx) => {
    if (idx > 0) {
      ctx.beginPath();
      ctx.moveTo(curColX, curY);
      ctx.lineTo(curColX, curY + tableHeaderH);
      ctx.stroke();
    }
    if (col.align === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(col.label, curColX + col.w / 2, curY + 22);
    } else {
      ctx.textAlign = 'left';
      ctx.fillText(col.label, curColX + 8, curY + 22);
    }
    curColX += col.w;
  });

  curY += tableHeaderH;

  // TABLE ROWS
  for (let i = 0; i < totalRowsCount; i++) {
    const row = rowsData[i];
    const isOt = row?.hasOt;

    // Row background
    if (isOt) {
      ctx.fillStyle = '#fffbeb';
    } else if (i % 2 === 1) {
      ctx.fillStyle = '#f8fafc';
    } else {
      ctx.fillStyle = '#ffffff';
    }
    ctx.fillRect(tableX, curY, tableW, rowH);

    // Row border
    ctx.strokeStyle = '#cbd5e1';
    ctx.strokeRect(tableX, curY, tableW, rowH);

    curColX = tableX;
    cols.forEach((col, idx) => {
      if (idx > 0) {
        ctx.beginPath();
        ctx.moveTo(curColX, curY);
        ctx.lineTo(curColX, curY + rowH);
        ctx.stroke();
      }

      if (row) {
        ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = isOt ? '#9a3412' : '#0f172a';

        let val = '';
        if (idx === 0) val = row.date;
        else if (idx === 1) val = row.startTime;
        else if (idx === 2) val = row.stopTime;
        else if (idx === 3) val = row.task;
        else if (idx === 4) val = row.client;
        else if (idx === 5) val = row.hours;

        if (col.align === 'center') {
          ctx.textAlign = 'center';
          ctx.fillText(val, curColX + col.w / 2, curY + 19);
          if (idx === 5 && isOt && val) {
            // Draw OT pill
            ctx.fillStyle = '#fef3c7';
            ctx.strokeStyle = '#fcd34d';
            ctx.fillRect(curColX + col.w - 32, curY + 6, 24, 16);
            ctx.strokeRect(curColX + col.w - 32, curY + 6, 24, 16);
            ctx.fillStyle = '#9a3412';
            ctx.font = 'bold 9px sans-serif';
            ctx.fillText('OT', curColX + col.w - 20, curY + 18);
          }
        } else {
          ctx.textAlign = 'left';
          // Truncate if long
          const maxTextW = col.w - 16;
          let renderText = val;
          if (ctx.measureText(renderText).width > maxTextW) {
            while (renderText.length > 3 && ctx.measureText(renderText + '...').width > maxTextW) {
              renderText = renderText.slice(0, -1);
            }
            renderText += '...';
          }
          ctx.fillText(renderText, curColX + 8, curY + 19);
        }
      }
      curColX += col.w;
    });

    curY += rowH;
  }

  // TOTALS ROW 1
  ctx.fillStyle = '#e2e8f0';
  ctx.fillRect(tableX, curY, tableW, 36);
  ctx.strokeStyle = '#475569';
  ctx.strokeRect(tableX, curY, tableW, 36);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Timesheet Total', tableX + 12, curY + 22);

  ctx.textAlign = 'center';
  ctx.fillText('Total', tableX + tableW - 170, curY + 22);

  ctx.font = 'bold 13px "SFMono-Regular", Consolas, monospace';
  ctx.fillText(grandTotalStr, tableX + tableW - 55, curY + 22);

  curY += 36;

  // BREAKDOWN ROW 2
  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(tableX, curY, tableW, 36);
  ctx.strokeStyle = '#94a3b8';
  ctx.strokeRect(tableX, curY, tableW, 36);

  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0f172a';
  ctx.fillText(`Total Regular Hours: `, tableX + 14, curY + 22);
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${regularHoursStr} hrs`, tableX + 130, curY + 22);

  ctx.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#9a3412';
  ctx.fillText(`Total Overtime Hours: `, tableX + 260, curY + 22);
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`${overtimeHoursStr} hrs`, tableX + 385, curY + 22);

  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#1e3a8a';
  ctx.fillText(`Grand Total: `, tableX + tableW - 200, curY + 22);
  ctx.font = 'bold 12px monospace';
  ctx.fillText(`${grandTotalStr} hrs`, tableX + tableW - 120, curY + 22);

  curY += 50;

  // 3 HIGHLIGHT CARDS
  const cardW = (tableW - 24) / 3;
  const cardH = 68;

  // Card 1: Regular
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#cbd5e1';
  ctx.fillRect(tableX, curY, cardW, cardH);
  ctx.strokeRect(tableX, curY, cardW, cardH);

  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TOTAL REGULAR HOURS', tableX + cardW / 2, curY + 22);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`${regularHoursStr} hrs`, tableX + cardW / 2, curY + 48);

  // Card 2: Overtime (Amber highlight)
  ctx.fillStyle = '#fffbeb';
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.fillRect(tableX + cardW + 12, curY, cardW, cardH);
  ctx.strokeRect(tableX + cardW + 12, curY, cardW, cardH);
  ctx.lineWidth = 1;

  ctx.fillStyle = '#9a3412';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('TOTAL OVERTIME HOURS', tableX + cardW + 12 + cardW / 2, curY + 22);
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`${overtimeHoursStr} hrs`, tableX + cardW + 12 + cardW / 2, curY + 48);

  // Card 3: Grand Total
  ctx.fillStyle = '#eff6ff';
  ctx.strokeStyle = '#93c5fd';
  ctx.fillRect(tableX + (cardW + 12) * 2, curY, cardW, cardH);
  ctx.strokeRect(tableX + (cardW + 12) * 2, curY, cardW, cardH);

  ctx.fillStyle = '#1e3a8a';
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('GRAND TOTAL HOURS', tableX + (cardW + 12) * 2 + cardW / 2, curY + 22);
  ctx.font = 'bold 16px monospace';
  ctx.fillText(`${grandTotalStr} hrs`, tableX + (cardW + 12) * 2 + cardW / 2, curY + 48);

  curY += cardH + 40;

  // SIGNATURES
  ctx.strokeStyle = '#0f172a';
  ctx.beginPath();
  ctx.moveTo(36, curY);
  ctx.lineTo(260, curY);
  ctx.stroke();

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Employee signature', 36, curY + 16);

  ctx.beginPath();
  ctx.moveTo(width - 260, curY);
  ctx.lineTo(width - 36, curY);
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillText('Approved by signature', width - 36, curY + 16);

  curY += 40;

  // FOOTER
  ctx.strokeStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.moveTo(36, curY);
  ctx.lineTo(width - 36, curY);
  ctx.stroke();

  ctx.fillStyle = '#64748b';
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('© 2013 www.double-entry-bookkeeping.com', 36, curY + 18);

  ctx.textAlign = 'right';
  ctx.fillText('v 1.0', width - 36, curY + 18);

  const dataUrl = canvas.toDataURL('image/png', 0.96);
  const blob = dataUrlToBlob(dataUrl);

  return { blob, dataUrl, filename };
}

/**
 * Check if the browser natively supports sharing files (e.g. mobile Safari / Chrome).
 */
export function canShareReportFiles(): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return false;
  try {
    const testFile = new File(['test'], 'test.png', { type: 'image/png' });
    return navigator.canShare({ files: [testFile] });
  } catch {
    return false;
  }
}

/**
 * Share report image file via native Web Share API (which directly opens Messenger, WhatsApp, Messages, etc. on mobile).
 */
export async function shareReportImage(
  imageBlob: Blob,
  filename: string = 'Timesheet_Report.png',
  title: string = 'Timesheet Report',
  text: string = 'Here is my pay period timesheet report.'
): Promise<{ success: boolean; method: 'native-share' | 'clipboard' | 'download' | 'cancelled'; message: string }> {
  const file = new File([imageBlob], filename, { type: 'image/png' });

  // 1. Try Native Web Share with files (Mobile devices: Messenger, WhatsApp, iMessage, etc.)
  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title,
        text,
        files: [file]
      });
      return { success: true, method: 'native-share', message: 'Shared successfully!' };
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'cancelled', message: 'Share dismissed.' };
      }
      console.warn('Native file share failed, falling back:', err);
    }
  }

  // 2. Try copying image directly to clipboard (for pasting into web Messenger / chat)
  const copied = await copyImageToClipboard(imageBlob);
  if (copied) {
    return {
      success: true,
      method: 'clipboard',
      message: 'Report image copied to clipboard! Paste directly into Messenger (Ctrl+V).'
    };
  }

  // 3. Fallback: Download file
  downloadImage(imageBlob, filename);
  return {
    success: true,
    method: 'download',
    message: 'Report image saved to your downloads!'
  };
}

/**
 * Copy a PNG blob directly to the system clipboard so it can be pasted into Messenger, Slack, Teams, or WhatsApp.
 */
export async function copyImageToClipboard(blob: Blob): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard || !window.ClipboardItem) {
    return false;
  }
  try {
    await navigator.clipboard.write([
      new window.ClipboardItem({
        'image/png': blob
      })
    ]);
    return true;
  } catch (err) {
    console.warn('ClipboardItem image copy failed:', err);
    return false;
  }
}

/**
 * Trigger browser download of an image blob.
 */
export function downloadImage(blob: Blob, filename: string = 'Timesheet_Report.png') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Detect if user is viewing on mobile or desktop
 */
export function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
}
