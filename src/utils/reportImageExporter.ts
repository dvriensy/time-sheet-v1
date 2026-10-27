import html2canvas from 'html2canvas';

export interface GeneratedReportImage {
  blob: Blob;
  dataUrl: string;
  filename: string;
}

/**
 * Capture an HTML DOM element and convert it into a high-resolution PNG image Blob & DataURL.
 */
export async function captureReportToImage(
  element: HTMLElement,
  filename: string = 'Timesheet_Report.png'
): Promise<GeneratedReportImage> {
  // Use scale 2 for crisp typography and lines
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#ffffff',
    useCORS: true,
    logging: false,
    windowWidth: element.scrollWidth || 850,
  });

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Failed to generate image blob from canvas'));
        return;
      }
      const dataUrl = canvas.toDataURL('image/png');
      resolve({
        blob,
        dataUrl,
        filename
      });
    }, 'image/png', 0.95);
  });
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
      // If native share fails, fallback to clipboard or download below
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
