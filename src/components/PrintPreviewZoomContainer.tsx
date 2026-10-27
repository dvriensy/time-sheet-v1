import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Minimize2, RotateCcw, ChevronDown, Check, Sliders } from 'lucide-react';

interface PrintPreviewZoomContainerProps {
  children: React.ReactNode;
  /** Initial mode: defaults to 'fit-screen' on mobile/tablets and 'fit-screen' or 'fit-width' on desktop */
  initialMode?: 'fit-screen' | 'fit-width' | '100%';
  /** Base document layout width in unscaled pixels (standard 8.5" sheet layout) */
  baseWidth?: number;
}

const ZOOM_PRESETS = [
  { label: '🎯 Fit to Screen (Entire Page)', value: 'fit-screen' },
  { label: '↔️ Fit to Width', value: 'fit-width' },
  { label: '35%', value: 35 },
  { label: '50%', value: 50 },
  { label: '65%', value: 65 },
  { label: '75%', value: 75 },
  { label: '85%', value: 85 },
  { label: '100% (Actual Size)', value: 100 },
  { label: '125%', value: 125 },
  { label: '150%', value: 150 },
  { label: '200%', value: 200 }
];

export const PrintPreviewZoomContainer: React.FC<PrintPreviewZoomContainerProps> = ({
  children,
  initialMode = 'fit-screen',
  baseWidth = 850
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<number>(100);
  const [zoomMode, setZoomMode] = useState<'fit-screen' | 'fit-width' | 'manual'>('fit-screen');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSlider, setShowSlider] = useState(false);
  const [contentHeight, setContentHeight] = useState<number>(1050);

  // Measure content natural unscaled height
  const updateContentHeight = useCallback(() => {
    if (contentRef.current) {
      const h = contentRef.current.offsetHeight || contentRef.current.scrollHeight;
      if (h > 200) {
        setContentHeight(h);
      }
    }
  }, []);

  // Compute zoom required to fit the entire timesheet onto the current viewport screen (both width and height)
  const computeFitScreenZoom = useCallback((): number => {
    if (!viewportRef.current) return 100;
    const vp = viewportRef.current;
    // Available viewport space with generous margin padding
    const availWidth = Math.max(260, vp.clientWidth - 24);
    const availHeight = Math.max(260, vp.clientHeight - 24);

    const docHeight = contentHeight > 200 ? contentHeight : 1050;
    const scaleX = availWidth / baseWidth;
    const scaleY = availHeight / docHeight;

    // Both width and height must fit entirely onto the screen
    const fitFactor = Math.min(scaleX, scaleY);
    // Clamp between 20% and 250%
    return Math.min(250, Math.max(20, Math.round(fitFactor * 100)));
  }, [baseWidth, contentHeight]);

  // Compute zoom to fit width
  const computeFitWidthZoom = useCallback((): number => {
    if (!viewportRef.current) return 100;
    const vp = viewportRef.current;
    const availWidth = Math.max(260, vp.clientWidth - 24);
    const scaleX = availWidth / baseWidth;
    return Math.min(250, Math.max(20, Math.round(scaleX * 100)));
  }, [baseWidth]);

  // Recalculate zoom when mode is fit-screen or fit-width
  const recalculateZoom = useCallback(() => {
    updateContentHeight();
    if (zoomMode === 'fit-screen') {
      const target = computeFitScreenZoom();
      setZoom(target);
    } else if (zoomMode === 'fit-width') {
      const target = computeFitWidthZoom();
      setZoom(target);
    }
  }, [zoomMode, computeFitScreenZoom, computeFitWidthZoom, updateContentHeight]);

  // Initial calculation and observer
  useEffect(() => {
    updateContentHeight();
    const timer = setTimeout(() => {
      updateContentHeight();
      if (initialMode === 'fit-screen') {
        const target = computeFitScreenZoom();
        setZoom(target);
        setZoomMode('fit-screen');
      } else if (initialMode === 'fit-width') {
        const target = computeFitWidthZoom();
        setZoom(target);
        setZoomMode('fit-width');
      } else {
        setZoom(100);
        setZoomMode('manual');
      }
    }, 50);

    return () => clearTimeout(timer);
  }, []);

  // Update on window resize
  useEffect(() => {
    const handleResize = () => {
      recalculateZoom();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [recalculateZoom]);

  // ResizeObserver on the content container to detect template switches (Job Time Sheet vs Breakdown)
  useEffect(() => {
    if (!contentRef.current) return;
    const observer = new ResizeObserver(() => {
      updateContentHeight();
      if (zoomMode === 'fit-screen') {
        setZoom(computeFitScreenZoom());
      }
    });
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [zoomMode, computeFitScreenZoom, updateContentHeight]);

  // Close preset dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.zoom-preset-menu')) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, [isDropdownOpen]);

  // Button actions
  const handleZoomIn = () => {
    setZoomMode('manual');
    setZoom(prev => Math.min(250, prev + 10));
  };

  const handleZoomOut = () => {
    setZoomMode('manual');
    setZoom(prev => Math.max(20, prev - 10));
  };

  const handleFitScreen = () => {
    updateContentHeight();
    const target = computeFitScreenZoom();
    setZoom(target);
    setZoomMode('fit-screen');
    setIsDropdownOpen(false);
  };

  const handleFitWidth = () => {
    const target = computeFitWidthZoom();
    setZoom(target);
    setZoomMode('fit-width');
    setIsDropdownOpen(false);
  };

  const handleReset100 = () => {
    setZoom(100);
    setZoomMode('manual');
    setIsDropdownOpen(false);
  };

  const handleSelectPreset = (val: string | number) => {
    if (val === 'fit-screen') {
      handleFitScreen();
    } else if (val === 'fit-width') {
      handleFitWidth();
    } else if (typeof val === 'number') {
      setZoom(val);
      setZoomMode('manual');
      setIsDropdownOpen(false);
    }
  };

  // Pinch-to-zoom gesture handling on mobile touch devices
  const touchStartDistRef = useRef<number | null>(null);
  const touchStartZoomRef = useRef<number>(zoom);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDistRef.current = Math.hypot(dx, dy);
      touchStartZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const ratio = dist / touchStartDistRef.current;
      const newZoom = Math.min(250, Math.max(20, Math.round(touchStartZoomRef.current * ratio)));
      setZoom(newZoom);
      setZoomMode('manual');
    }
  };

  const handleTouchEnd = () => {
    touchStartDistRef.current = null;
  };

  // Ctrl/Cmd + wheel zoom handling
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoomMode('manual');
      setZoom(prev => {
        const delta = e.deltaY < 0 ? 5 : -5;
        return Math.min(250, Math.max(20, prev + delta));
      });
    }
  };

  // Layout calculations
  const scale = zoom / 100;
  const scaledWidth = Math.round(baseWidth * scale);
  const scaledHeight = Math.round(contentHeight * scale);

  return (
    <div className="flex flex-col flex-1 w-full min-h-0 relative select-none print:block print:w-full print:h-auto">
      {/* ZOOM CONTROLS TOOLBAR (PRINT-HIDDEN) */}
      <div className="print:hidden w-full max-w-4xl mx-auto mb-3 bg-card-bg/90 backdrop-blur-md border border-main-border rounded-2xl p-2 sm:px-3 sm:py-2.5 shadow-sm transition-all duration-200">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {/* Left: Quick Fit Modes */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            {/* Fit to Screen (Entire Page) */}
            <button
              type="button"
              onClick={handleFitScreen}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                zoomMode === 'fit-screen'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                  : 'bg-card-bg text-main-text border-main-border hover:bg-main-border/30'
              }`}
              title="Scale timesheet so it fits entirely on your screen (both width and height)"
            >
              <Minimize2 className="h-3.5 w-3.5 shrink-0" />
              <span>Fit Entire Screen</span>
              {zoomMode === 'fit-screen' && (
                <span className="hidden sm:inline-block text-[10px] bg-white/20 px-1 rounded font-mono">
                  {zoom}%
                </span>
              )}
            </button>

            {/* Fit to Width */}
            <button
              type="button"
              onClick={handleFitWidth}
              className={`min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
                zoomMode === 'fit-width'
                  ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                  : 'bg-card-bg text-main-text border-main-border hover:bg-main-border/30'
              }`}
              title="Scale timesheet to match full screen width"
            >
              <Maximize2 className="h-3.5 w-3.5 shrink-0" />
              <span>Fit Width</span>
              {zoomMode === 'fit-width' && (
                <span className="hidden sm:inline-block text-[10px] bg-white/20 px-1 rounded font-mono">
                  {zoom}%
                </span>
              )}
            </button>

            {/* 100% Reset */}
            <button
              type="button"
              onClick={handleReset100}
              className={`min-h-[36px] px-2 sm:px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition cursor-pointer border ${
                zoom === 100 && zoomMode === 'manual'
                  ? 'bg-blue-600/20 text-blue-500 border-blue-500/40'
                  : 'bg-card-bg text-muted-text border-main-border hover:text-main-text hover:bg-main-border/30'
              }`}
              title="Reset to 100% actual size"
            >
              <RotateCcw className="h-3.5 w-3.5 shrink-0" />
              <span className="hidden xs:inline">100%</span>
            </button>
          </div>

          {/* Right: Stepper Zoom Controls & Dropdown */}
          <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
            {/* Zoom Out Button */}
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 20}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-main-border bg-card-bg text-main-text hover:bg-main-border/30 disabled:opacity-30 transition cursor-pointer"
              title="Zoom Out (Ctrl + Scroll Down)"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            {/* Zoom Preset Selector Dropdown */}
            <div className="relative zoom-preset-menu">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="min-h-[36px] px-2.5 py-1 rounded-xl border border-main-border bg-card-bg text-main-text text-xs font-mono font-semibold flex items-center gap-1.5 hover:bg-main-border/30 transition cursor-pointer"
                title="Select zoom preset or fit mode"
              >
                <span>{zoom}%</span>
                <ChevronDown className="h-3 w-3 text-muted-text" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 bg-card-bg/95 backdrop-blur-lg border border-main-border rounded-xl shadow-2xl py-1.5 z-50 text-xs font-sans">
                  <div className="px-3 py-1 text-[10px] font-bold text-muted-text uppercase tracking-wider border-b border-main-border/60 mb-1">
                    Display & Zoom Modes
                  </div>
                  {ZOOM_PRESETS.map((preset) => {
                    const isSelected =
                      (preset.value === 'fit-screen' && zoomMode === 'fit-screen') ||
                      (preset.value === 'fit-width' && zoomMode === 'fit-width') ||
                      (typeof preset.value === 'number' && zoom === preset.value && zoomMode === 'manual');

                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleSelectPreset(preset.value)}
                        className={`w-full text-left px-3 py-1.5 flex items-center justify-between text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-600/15 text-blue-500 font-semibold'
                            : 'text-main-text hover:bg-main-border/20'
                        }`}
                      >
                        <span>{preset.label}</span>
                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Zoom In Button */}
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 250}
              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border border-main-border bg-card-bg text-main-text hover:bg-main-border/30 disabled:opacity-30 transition cursor-pointer"
              title="Zoom In (Ctrl + Scroll Up)"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            {/* Toggle Continuous Slider */}
            <button
              type="button"
              onClick={() => setShowSlider(!showSlider)}
              className={`min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl border transition cursor-pointer ${
                showSlider
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-card-bg text-muted-text border-main-border hover:text-main-text hover:bg-main-border/30'
              }`}
              title="Toggle Zoom Slider"
            >
              <Sliders className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Optional Smooth Zoom Slider */}
        {showSlider && (
          <div className="mt-2.5 pt-2 border-t border-main-border/60 flex items-center gap-3 px-1 animate-fadeIn">
            <span className="text-[11px] font-mono text-muted-text shrink-0">20%</span>
            <input
              type="range"
              min="20"
              max="200"
              step="1"
              value={zoom}
              onChange={(e) => {
                setZoom(Number(e.target.value));
                setZoomMode('manual');
              }}
              className="w-full accent-blue-600 cursor-pointer h-1.5 bg-main-border rounded-lg"
            />
            <span className="text-[11px] font-mono text-muted-text shrink-0">200%</span>
            <span className="text-xs font-mono font-bold text-main-text min-w-[42px] text-right">
              {zoom}%
            </span>
          </div>
        )}
      </div>

      {/* SCROLLABLE VIEWPORT CONTAINER */}
      <div
        ref={viewportRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="w-full flex-1 overflow-auto touch-pan-x touch-pan-y overscroll-contain relative rounded-xl print:overflow-visible print:p-0 print:m-0 print:block"
        style={{
          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x pan-y pinch-zoom'
        }}
      >
        <div
          className="print-zoom-outer flex items-start justify-center min-w-full p-1 sm:p-3 print:p-0 print:m-0 print:block"
          style={{
            minHeight: '100%',
            paddingBottom: '3rem'
          }}
        >
          {/* Fixed dimensions sizer box so parent flex/overflow perfectly tracks scaled content */}
          <div
            className="print-zoom-sizer relative transition-[width,height] duration-150 ease-out print:!static print:!w-full print:!h-auto print:!transform-none"
            style={{
              width: `${scaledWidth}px`,
              height: `${scaledHeight}px`
            }}
          >
            {/* The scaled document content */}
            <div
              ref={contentRef}
              className="print-zoom-content absolute top-0 left-0 origin-top-left print:!static print:!w-full print:!h-auto print:!transform-none"
              style={{
                width: `${baseWidth}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                transition: 'transform 0.15s ease-out'
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPreviewZoomContainer;
