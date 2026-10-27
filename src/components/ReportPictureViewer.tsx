import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FileText, Image as ImageIcon, Copy, Download, 
  Check, AlertCircle, RefreshCw, ZoomIn, ZoomOut, 
  Maximize2, RotateCcw, ExternalLink, Smartphone, Monitor,
  MessageCircle
} from 'lucide-react';
import { 
  captureReportToImage, 
  shareReportImage, 
  copyImageToClipboard, 
  downloadImage, 
  isMobileDevice,
  GeneratedReportImage 
} from '../utils/reportImageExporter';

interface ReportPictureViewerProps {
  reportElementId?: string;
  filename?: string;
  reportTitle?: string;
  employeeName?: string;
  dateRange?: string;
  captureKey?: string;
  children: React.ReactNode;
  /** Initial format: defaults to 'picture' on mobile phone for Messenger, 'pdf' on desktop */
  defaultFormat?: 'pdf' | 'picture';
  onPrint?: () => void;
  onClose?: () => void;
}

export const ReportPictureViewer: React.FC<ReportPictureViewerProps> = ({
  reportElementId = 'payperiod-printout',
  filename = 'Timesheet_Report.png',
  reportTitle = 'Pay Period Timesheet Report',
  employeeName = 'Employee',
  dateRange = '',
  captureKey,
  children,
  defaultFormat,
  onPrint,
  onClose
}) => {
  // Device detection
  const isMobile = isMobileDevice();
  const initialFormat = defaultFormat || (isMobile ? 'picture' : 'pdf');

  const [activeFormat, setActiveFormat] = useState<'pdf' | 'picture'>(initialFormat);
  const [capturedImage, setCapturedImage] = useState<GeneratedReportImage | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'info' | 'error'>('info');

  // Invalidate cached image when captureKey changes (e.g. template mode switched)
  useEffect(() => {
    if (captureKey) {
      setCapturedImage(null);
      setGenerateError(null);
    }
  }, [captureKey]);

  // Zoom state for picture mode
  const [picZoom, setPicZoom] = useState<number>(100);
  const [picFitMode, setPicFitMode] = useState<'screen' | 'width' | 'manual'>('screen');
  const picContainerRef = useRef<HTMLDivElement>(null);
  const picImageRef = useRef<HTMLImageElement>(null);

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'info', durationMs: number = 3500) => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(prev => prev === msg ? null : prev);
    }, durationMs);
  };

  // Convert DOM to image with robust element location and multi-engine capture
  const generateImageFromDom = useCallback(async (forced: boolean = false): Promise<GeneratedReportImage | null> => {
    if (capturedImage && !forced) return capturedImage;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      // Find the element by ID or fall back to .print-sheet
      let targetEl = document.getElementById(reportElementId);
      if (!targetEl) {
        targetEl = document.querySelector('.print-sheet') as HTMLElement;
      }

      // If still mounting, wait a brief tick
      if (!targetEl) {
        await new Promise(resolve => setTimeout(resolve, 150));
        targetEl = document.getElementById(reportElementId) || (document.querySelector('.print-sheet') as HTMLElement);
      }

      if (!targetEl) {
        throw new Error('Timesheet report document is currently preparing. Please tap "Try Again".');
      }

      const generated = await captureReportToImage(targetEl, filename);
      setCapturedImage(generated);
      setIsGenerating(false);
      setGenerateError(null);
      return generated;
    } catch (err: any) {
      console.error('Error generating report picture:', err);
      const rawMsg = err?.message || '';
      const msg = rawMsg && !rawMsg.includes('parse@') && !rawMsg.includes('CSSParsedDeclaration')
        ? rawMsg
        : 'Could not create picture preview. Please tap "Try Again" or switch to PDF view.';
      setGenerateError(msg);
      setIsGenerating(false);
      return null;
    }
  }, [reportElementId, filename, capturedImage]);

  // When switching to picture mode, auto-generate if not available
  useEffect(() => {
    if (activeFormat === 'picture' && !capturedImage && !isGenerating && !generateError) {
      const timer = setTimeout(() => {
        generateImageFromDom();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [activeFormat, capturedImage, isGenerating, generateError, generateImageFromDom]);

  // Reset picture zoom to fit screen
  const handleFitScreen = useCallback(() => {
    if (!picContainerRef.current) return;
    const vp = picContainerRef.current;
    const availW = vp.clientWidth - 24;
    const availH = vp.clientHeight - 24;

    // Standard report aspect ratio approx 850w x 1100h
    const scaleX = availW / 850;
    const scaleY = availH / 1100;
    const fitFactor = Math.min(scaleX, scaleY);
    const calculated = Math.min(200, Math.max(25, Math.round(fitFactor * 100)));

    setPicZoom(calculated);
    setPicFitMode('screen');
  }, []);

  const handleFitWidth = useCallback(() => {
    if (!picContainerRef.current) return;
    const vp = picContainerRef.current;
    const availW = vp.clientWidth - 24;
    const scaleX = availW / 850;
    const calculated = Math.min(200, Math.max(25, Math.round(scaleX * 100)));

    setPicZoom(calculated);
    setPicFitMode('width');
  }, []);

  useEffect(() => {
    if (activeFormat === 'picture' && capturedImage) {
      handleFitScreen();
    }
  }, [activeFormat, capturedImage, handleFitScreen]);

  // Share via Messenger / Native Share
  const handleShareMessenger = async () => {
    let img = capturedImage;
    if (!img) {
      img = await generateImageFromDom(true);
    }
    if (!img) {
      showToast('Could not generate picture to share. Please tap Try Again.', 'error');
      return;
    }

    const shareTitle = `${reportTitle} - ${employeeName}`;
    const shareText = `Pay Period Timesheet Report (${dateRange || 'Current'}) for ${employeeName}`;

    showToast('Opening Messenger / Share Drawer...', 'info', 2000);

    const result = await shareReportImage(img.blob, img.filename, shareTitle, shareText);

    if (result.method === 'native-share') {
      showToast('Report opened in share sheet! Select Messenger or your contact.', 'success');
    } else if (result.method === 'clipboard') {
      showToast('Picture copied to clipboard! Paste (Ctrl+V) directly into Facebook Messenger or chat.', 'success', 5000);
    } else if (result.method === 'download') {
      showToast('Picture downloaded! Ready to attach and send in Messenger.', 'success');
    }
  };

  // Copy Image to Clipboard
  const handleCopyImage = async () => {
    let img = capturedImage;
    if (!img) {
      img = await generateImageFromDom(true);
    }
    if (!img) {
      showToast('Failed to create picture. Please tap Try Again.', 'error');
      return;
    }

    const copied = await copyImageToClipboard(img.blob);
    if (copied) {
      showToast('📋 Picture copied to clipboard! You can paste (Ctrl+V) directly into Messenger, WhatsApp, or Slack.', 'success', 4500);
    } else {
      // Fallback download if browser blocks clipboard image
      downloadImage(img.blob, img.filename);
      showToast('Clipboard blocked by browser. Picture saved to downloads instead!', 'info');
    }
  };

  // Download Image
  const handleDownloadImage = async () => {
    let img = capturedImage;
    if (!img) {
      img = await generateImageFromDom(true);
    }
    if (!img) {
      showToast('Failed to create picture. Please tap Try Again.', 'error');
      return;
    }
    downloadImage(img.blob, img.filename);
    showToast('💾 Picture downloaded to your device!', 'success');
  };

  // Regenerate picture
  const handleRefresh = async () => {
    setCapturedImage(null);
    setGenerateError(null);
    showToast('Regenerating high-resolution picture...', 'info', 1500);
    await generateImageFromDom(true);
  };

  return (
    <div className="flex flex-col flex-1 w-full h-full min-h-0 select-none">
      {/* FORMAT SELECTOR & CONTEXT BAR (PRINT-HIDDEN) */}
      <div className="print:hidden w-full max-w-4xl mx-auto mb-2.5">
        <div className="bg-card-bg/95 backdrop-blur-md border border-main-border rounded-2xl p-2 sm:px-3 sm:py-2.5 shadow-sm">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Format Switcher: PDF vs Picture */}
            <div className="flex items-center gap-1 bg-app-bg/80 p-1 border border-main-border rounded-xl">
              <button
                type="button"
                onClick={() => setActiveFormat('pdf')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeFormat === 'pdf'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-muted-text hover:text-main-text hover:bg-main-border/30'
                }`}
                title="View as traditional printable PDF document"
              >
                <FileText className="h-3.5 w-3.5" />
                <span>PDF / Document</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveFormat('picture');
                  if (!capturedImage) {
                    generateImageFromDom();
                  }
                }}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                  activeFormat === 'picture'
                    ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 text-white shadow-xs'
                    : 'text-muted-text hover:text-main-text hover:bg-main-border/30'
                }`}
                title="View as high-resolution picture that can be sent in Messenger or saved to photos"
              >
                <ImageIcon className="h-3.5 w-3.5" />
                <span>Picture (for Messenger)</span>
                <span className="hidden sm:inline-flex bg-white/20 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                  PNG
                </span>
              </button>
            </div>

            {/* Quick Actions for Picture / Messenger */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
              {/* Send in Messenger / Share Button */}
              <button
                type="button"
                onClick={handleShareMessenger}
                disabled={isGenerating}
                className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white shadow-sm disabled:opacity-50"
                title="Send picture directly via Messenger, WhatsApp, or phone share drawer"
              >
                <MessageCircle className="h-4 w-4 shrink-0" />
                <span>Send in Messenger</span>
              </button>

              {/* Copy Image Button */}
              <button
                type="button"
                onClick={handleCopyImage}
                disabled={isGenerating}
                className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer bg-card-bg text-main-text border border-main-border hover:bg-main-border/30 disabled:opacity-50"
                title="Copy picture to clipboard (Ctrl+V into Messenger, WhatsApp, or Slack)"
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden xs:inline">Copy Picture</span>
              </button>

              {/* Save/Download Picture Button */}
              <button
                type="button"
                onClick={handleDownloadImage}
                disabled={isGenerating}
                className="min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition cursor-pointer bg-card-bg text-main-text border border-main-border hover:bg-main-border/30 disabled:opacity-50"
                title="Save picture to camera roll or downloads"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span className="hidden md:inline">Save Image</span>
              </button>

              {/* Refresh Picture */}
              {activeFormat === 'picture' && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isGenerating}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl border border-main-border bg-card-bg text-muted-text hover:text-main-text hover:bg-main-border/30 transition cursor-pointer"
                  title="Regenerate picture from updated report data"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* Device helper banner */}
          <div className="mt-2 pt-2 border-t border-main-border/50 flex items-center justify-between text-[11px] text-muted-text flex-wrap gap-1">
            <div className="flex items-center gap-1.5">
              {isMobile ? (
                <>
                  <Smartphone className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span>
                    <strong>Phone View:</strong> Tap <strong>"Send in Messenger"</strong> to share this picture directly into Facebook Messenger, Messages, or WhatsApp!
                  </span>
                </>
              ) : (
                <>
                  <Monitor className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                  <span>
                    <strong>Computer View:</strong> Click <strong>"Copy Picture"</strong> to paste (Ctrl+V) directly into web Messenger, Slack, or email — or switch to <strong>PDF</strong> for paper printouts.
                  </span>
                </>
              )}
            </div>

            {/* Quick links for web messenger */}
            <div className="hidden sm:flex items-center gap-2 text-[10px] text-muted-text font-mono">
              <span className="opacity-70">Quick Web Chat:</span>
              <a
                href="https://www.messenger.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline flex items-center gap-0.5"
                title="Open Messenger web in a new tab"
              >
                Messenger.com <ExternalLink className="h-2.5 w-2.5" />
              </a>
              <span>•</span>
              <a
                href="https://web.whatsapp.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-500 hover:underline flex items-center gap-0.5"
                title="Open WhatsApp web in a new tab"
              >
                WhatsApp Web <ExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* TOAST FEEDBACK */}
      {toastMessage && (
        <div className="w-full max-w-4xl mx-auto mb-2 px-1">
          <div
            className={`p-2.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-medium flex items-center gap-2 shadow-md animate-fadeIn ${
              toastType === 'success'
                ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
                : toastType === 'error'
                ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
                : 'bg-blue-500/15 border border-blue-500/30 text-blue-300'
            }`}
          >
            {toastType === 'success' ? (
              <Check className="h-4 w-4 shrink-0 text-emerald-400" />
            ) : toastType === 'error' ? (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-blue-400" />
            )}
            <span className="flex-1">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* VIEWPORT AREA */}
      <div className="flex-1 min-h-0 w-full relative flex flex-col items-center">
        {/* PDF VIEW:
            When activeFormat === 'pdf': Mounted normally in relative flow.
            When activeFormat === 'picture': Mounted at fixed (0, 0) with width 850px, z-index -50,
            opacity 1, so layout and styles remain intact for capture, but hidden from the user behind
            the picture view. In print mode, print CSS takes precedence.
        */}
        <div
          aria-hidden={activeFormat === 'picture'}
          className={`w-full flex-1 min-h-0 flex flex-col ${
            activeFormat === 'pdf'
              ? 'relative'
              : 'fixed top-0 left-0 w-[850px] -z-50 pointer-events-none opacity-100 overflow-hidden print:relative print:top-auto print:left-auto print:w-full print:z-auto print:opacity-100 print:pointer-events-auto'
          }`}
        >
          {children}
        </div>

        {/* PICTURE VIEW: Render crisp high-res picture with zoom controls */}
        {activeFormat === 'picture' && (
          <div className="print:hidden w-full flex-1 min-h-0 flex flex-col relative z-10 bg-app-bg">
            {/* Picture Controls Toolbar */}
            <div className="w-full max-w-4xl mx-auto mb-2 flex items-center justify-between gap-1.5 flex-wrap px-1">
              <div className="flex items-center gap-1 sm:gap-1.5">
                <button
                  type="button"
                  onClick={handleFitScreen}
                  className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer border ${
                    picFitMode === 'screen'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-card-bg text-main-text border-main-border hover:bg-main-border/30'
                  }`}
                  title="Fit entire picture onto your screen"
                >
                  <Maximize2 className="h-3 w-3" />
                  <span>Fit Screen</span>
                </button>

                <button
                  type="button"
                  onClick={handleFitWidth}
                  className={`min-h-[34px] px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer border ${
                    picFitMode === 'width'
                      ? 'bg-blue-600 text-white border-blue-500'
                      : 'bg-card-bg text-main-text border-main-border hover:bg-main-border/30'
                  }`}
                  title="Fit picture to screen width"
                >
                  <span>Fit Width</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setPicZoom(100);
                    setPicFitMode('manual');
                  }}
                  className="min-h-[34px] px-2 py-1 rounded-xl text-xs font-medium bg-card-bg text-muted-text border border-main-border hover:text-main-text transition cursor-pointer"
                  title="Reset to 100% natural resolution"
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>

              <div className="flex items-center gap-1 ml-auto">
                <button
                  type="button"
                  onClick={() => {
                    setPicFitMode('manual');
                    setPicZoom(prev => Math.max(20, prev - 10));
                  }}
                  className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl border border-main-border bg-card-bg text-main-text hover:bg-main-border/30 cursor-pointer"
                  title="Zoom Out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs font-mono font-bold text-main-text min-w-[44px] text-center">
                  {picZoom}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPicFitMode('manual');
                    setPicZoom(prev => Math.min(200, prev + 10));
                  }}
                  className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-xl border border-main-border bg-card-bg text-main-text hover:bg-main-border/30 cursor-pointer"
                  title="Zoom In"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Scrollable Picture Canvas Viewport */}
            <div
              ref={picContainerRef}
              className="w-full flex-1 overflow-auto rounded-2xl border border-main-border/60 bg-slate-900/60 p-2 sm:p-4 flex items-center justify-center relative touch-pan-x touch-pan-y"
              style={{
                touchAction: 'pan-x pan-y pinch-zoom'
              }}
            >
              {isGenerating ? (
                <div className="flex flex-col items-center justify-center p-8 space-y-3 text-center">
                  <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-main-text">
                    Formatting Timesheet for Messenger...
                  </p>
                  <p className="text-xs text-muted-text max-w-sm">
                    Creating a crisp, high-resolution picture ready to send in Messenger, WhatsApp, or text messages.
                  </p>
                </div>
              ) : generateError ? (
                <div className="flex flex-col items-center justify-center p-6 space-y-3 text-center bg-card-bg rounded-2xl border border-rose-500/30 max-w-md shadow-xl">
                  <div className="p-3 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                    <AlertCircle className="h-7 w-7" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-main-text">Picture Generation Paused</p>
                    <p className="text-xs text-muted-text mt-1 leading-relaxed">
                      {generateError}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => generateImageFromDom(true)}
                      className="min-h-[38px] px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition cursor-pointer flex items-center gap-1.5 shadow-sm"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      <span>Try Again</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormat('pdf')}
                      className="min-h-[38px] px-4 py-1.5 rounded-xl bg-card-bg hover:bg-main-border/30 text-main-text border border-main-border text-xs font-medium transition cursor-pointer"
                    >
                      Switch to PDF View
                    </button>
                  </div>
                </div>
              ) : capturedImage ? (
                <div
                  className="flex items-center justify-center transition-all duration-150"
                  style={{
                    width: `${Math.round((850 * picZoom) / 100)}px`,
                    maxWidth: 'none'
                  }}
                >
                  <img
                    ref={picImageRef}
                    src={capturedImage.dataUrl}
                    alt={reportTitle}
                    className="w-full h-auto rounded-lg shadow-2xl border border-slate-300 bg-white"
                    style={{
                      imageRendering: 'auto'
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 space-y-3 text-center">
                  <button
                    type="button"
                    onClick={() => generateImageFromDom(true)}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span>Generate Timesheet Picture</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportPictureViewer;
