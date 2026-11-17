import React from 'react';
import { TimesheetEntry } from '../types';

interface JobTimeSheetPrintoutProps {
  employeeName: string;
  dateRange: string;
  entries: TimesheetEntry[];
  footerCopyright?: string;
  version?: string;
}

export const JobTimeSheetPrintout: React.FC<JobTimeSheetPrintoutProps> = ({
  employeeName,
  dateRange,
  entries,
  footerCopyright = '© 2013 www.double-entry-bookkeeping.com',
  version = 'v 1.0'
}) => {
  // Process entries into regular vs overtime hours and row structure
  const processedRows = entries.map(entry => {
    const ot = (entry as any).overtimeHours !== undefined 
      ? Number((entry as any).overtimeHours) 
      : (entry.isOvertime ? entry.totalHours : 0);
    const reg = (entry as any).regularHours !== undefined 
      ? Number((entry as any).regularHours) 
      : (entry.isOvertime ? 0 : entry.totalHours);
    const hasOt = ot > 0 || !!entry.isOvertime;

    return {
      date: entry.date,
      startTime: entry.startTime,
      stopTime: entry.endTime,
      task: entry.project,
      client: entry.locationName || 'Client Project',
      regHours: reg,
      otHours: ot,
      totalHours: entry.totalHours,
      notes: entry.notes,
      hasFlha: !!entry.flhaImageUrl,
      hasOvertime: hasOt,
      isOutOfTown: !!entry.isOutOfTown
    };
  });

  // Out of town aggregates (only shown if explicitly inputted on at least one shift)
  const outOfTownRows = processedRows.filter(r => r.isOutOfTown);
  const hasOutOfTown = outOfTownRows.length > 0;
  const outOfTownHours = outOfTownRows.reduce((sum, r) => sum + (r.totalHours || 0), 0);
  const outOfTownDates = Array.from(new Set(outOfTownRows.map(r => r.date))).join(', ');

  // Calculate totals
  const totalRegularHours = processedRows.reduce((sum, r) => sum + r.regHours, 0);
  const totalOvertimeHours = processedRows.reduce((sum, r) => sum + r.otHours, 0);
  const totalHoursSum = processedRows.reduce((sum, r) => sum + (r.totalHours || 0), 0);
  const grandTotalHours = totalHoursSum > 0 ? totalHoursSum : (totalRegularHours + totalOvertimeHours);

  // Fill up to 14 rows to mirror the reference template layout
  const MIN_ROWS = 14;
  const emptyRowsCount = Math.max(0, MIN_ROWS - processedRows.length);

  return (
    <div 
      id="payperiod-printout" 
      className="print-sheet w-full max-w-4xl mx-auto bg-white text-slate-950 p-3 sm:p-6 md:p-10 rounded-xl border border-slate-300 shadow-2xl print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white font-sans text-xs select-none"
    >
      {/* HEADER SECTION */}
      <div className="text-center mb-4 sm:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-slate-950 uppercase font-sans" style={{ color: '#0f172a' }}>
          Job Time Sheet
        </h1>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-2 mb-4 font-sans text-xs md:text-sm text-slate-950 px-1">
        <div className="w-full sm:w-auto">
          <span className="font-bold text-slate-900" style={{ color: '#0f172a' }}>Employee:</span>{' '}
          <span className="ml-1 border-b border-black/60 min-w-[180px] sm:min-w-[220px] inline-block font-mono !text-slate-900 pb-0.5 font-bold" style={{ color: '#0f172a' }}>
            {employeeName || '________________________'}
          </span>
        </div>
        <div className="w-full sm:w-auto sm:text-right">
          <span className="font-bold text-slate-900" style={{ color: '#0f172a' }}>Date Range:</span>{' '}
          <span className="ml-1 border-b border-black/60 min-w-[140px] sm:min-w-[160px] inline-block font-mono !text-slate-900 text-left sm:text-right pb-0.5 font-bold" style={{ color: '#0f172a' }}>
            {dateRange || '________________'}
          </span>
        </div>
      </div>

      {hasOutOfTown && (
        <div
          data-out-of-town-banner="true"
          className="mb-4 px-3.5 py-2.5 rounded-lg border-2 border-sky-700 bg-sky-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sky-950"
          style={{ backgroundColor: '#f0f9ff', borderColor: '#0369a1', color: '#0c4a6e' }}
        >
          <div className="flex items-center gap-2">
            <span
              className="inline-block px-2 py-0.5 rounded bg-sky-700 text-white font-black text-[10px] uppercase tracking-wider shrink-0"
              style={{ backgroundColor: '#0369a1', color: '#ffffff' }}
            >
              OUT OF TOWN WORK
            </span>
            <span className="font-bold text-xs" style={{ color: '#0c4a6e' }}>
              Includes Out of Town Work Shifts
            </span>
          </div>
          <span className="font-mono font-bold text-[11px]" style={{ color: '#0c4a6e' }}>
            {outOfTownRows.length} shift{outOfTownRows.length > 1 ? 's' : ''} • {outOfTownHours.toFixed(2)} hrs ({outOfTownDates})
          </span>
        </div>
      )}

      {/* MAIN TABLE */}
      <div className="overflow-x-auto mb-6 sm:mb-8 w-full touch-pan-x" style={{ WebkitOverflowScrolling: 'touch' }}>
        <table className="w-full min-w-[650px] sm:min-w-[700px] border-collapse border border-slate-600 text-xs text-slate-950">
          <thead>
            <tr className="bg-slate-200 border-b border-slate-600 font-bold text-center text-[11px]">
              <th className="border border-slate-500 py-2 px-1.5 w-[18%] !text-slate-900" style={{ color: '#0f172a' }}>Date</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[13%] !text-slate-900" style={{ color: '#0f172a' }}>Start time</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[13%] !text-slate-900" style={{ color: '#0f172a' }}>Stop time</th>
              <th className="border border-slate-500 py-2 px-1.5 w-28 max-w-[110px] !text-slate-900" style={{ color: '#0f172a' }}>Task</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[34%] !text-slate-900" style={{ color: '#0f172a' }}>Client</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[12%] !text-slate-900" style={{ color: '#0f172a' }}>Total Hours</th>
            </tr>
          </thead>
          <tbody>
            {processedRows.map((row, idx) => (
              <tr
                key={idx}
                data-out-of-town={row.isOutOfTown ? 'true' : undefined}
                className={`h-8 border-b border-slate-400 text-center ${row.isOutOfTown && !row.hasOvertime ? 'bg-sky-50/50' : ''}`}
                style={row.isOutOfTown && !row.hasOvertime ? { backgroundColor: '#f0f9ff' } : undefined}
              >
                <td className="border border-slate-400 py-1.5 px-1.5 font-mono text-[11px] whitespace-nowrap !text-slate-900 font-medium" style={{ color: '#0f172a' }}>
                  {row.date}
                </td>
                <td className="border border-slate-400 py-1.5 px-1.5 font-mono whitespace-nowrap !text-slate-900 font-medium" style={{ color: '#0f172a' }}>
                  {row.startTime}
                </td>
                <td className="border border-slate-400 py-1.5 px-1.5 font-mono whitespace-nowrap !text-slate-900 font-medium" style={{ color: '#0f172a' }}>
                  {row.stopTime}
                </td>
                <td className="border border-slate-400 py-1.5 px-1.5 text-left font-medium truncate w-28 max-w-[110px] !text-slate-900" style={{ color: '#0f172a' }}>
                  {row.task}
                  {row.hasFlha && (
                    <span className="ml-1.5 inline-block text-[9px] font-bold text-emerald-800 bg-emerald-100 px-1 py-0.2 rounded border border-emerald-400 uppercase tracking-tighter">
                      FLHA
                    </span>
                  )}
                </td>
                <td className="border border-slate-400 py-1.5 px-1.5 text-left !text-slate-900" style={{ color: '#0f172a' }}>
                  {row.isOutOfTown ? (
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate">{row.client}</span>
                      <span
                        className="inline-block shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider border border-sky-600 bg-sky-100 text-sky-900"
                        style={{ backgroundColor: '#e0f2fe', borderColor: '#0284c7', color: '#0c4a6e' }}
                      >
                        OUT OF TOWN
                      </span>
                    </div>
                  ) : (
                    <span className="block truncate">{row.client}</span>
                  )}
                </td>
                <td 
                  className={`border border-slate-400 py-1.5 px-1.5 font-mono font-semibold whitespace-nowrap ${
                    row.hasOvertime 
                      ? 'bg-amber-50 text-amber-900 border-l-2 border-amber-500 !text-amber-900' 
                      : '!text-slate-900'
                  }`}
                  style={
                    row.hasOvertime 
                      ? { color: '#9a3412', backgroundColor: '#fffbeb', borderLeftColor: '#f59e0b' } 
                      : { color: '#0f172a' }
                  }
                >
                  {row.totalHours > 0 ? (
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="font-bold">{row.totalHours.toFixed(2)}</span>
                      {row.hasOvertime && (
                        <span 
                          className="bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] px-1 rounded inline-block tracking-tight shrink-0"
                          style={{ color: '#9a3412', borderColor: '#fcd34d', backgroundColor: '#fef3c7' }}
                        >
                          OT
                        </span>
                      )}
                    </div>
                  ) : ''}
                </td>
              </tr>
            ))}

            {/* Blank Filler Rows matching reference layout */}
            {Array.from({ length: emptyRowsCount }).map((_, idx) => (
              <tr key={`empty-${idx}`} className="h-7 border-b border-slate-300">
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300 w-28 max-w-[110px]"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
              </tr>
            ))}

            {/* TOTAL SUMMARY ROW */}
            <tr className="bg-slate-200 font-bold border-t-2 border-slate-600 text-center text-xs h-9">
              <td colSpan={4} className="border border-slate-500 py-2 px-3 text-left font-bold !text-slate-900 font-sans" style={{ color: '#0f172a' }}>
                Timesheet Total
              </td>
              <td className="border border-slate-500 py-2 px-2 text-center font-bold !text-slate-900 font-sans" style={{ color: '#0f172a' }}>
                Total
              </td>
              <td className="border border-slate-500 py-2 px-2 font-mono !text-slate-900 font-extrabold text-xs" style={{ color: '#0f172a' }}>
                {grandTotalHours > 0 ? grandTotalHours.toFixed(2) : '0.00'}
              </td>
            </tr>
            {/* REGULAR / OVERTIME / GRAND TOTAL BREAKDOWN ROW */}
            <tr className="bg-slate-100 font-bold border-t border-slate-500 text-xs h-9">
              <td colSpan={2} className="border border-slate-500 py-2 px-3 text-right font-sans !text-slate-900" style={{ color: '#0f172a' }}>
                Total Regular Hours: <span className="font-mono font-black ml-1.5 text-xs !text-slate-900" style={{ color: '#0f172a' }}>{totalRegularHours.toFixed(2)}</span>
              </td>
              <td colSpan={2} className="border border-slate-500 py-2 px-3 text-right font-sans text-amber-900 bg-amber-50" style={{ color: '#9a3412', backgroundColor: '#fffbeb' }}>
                Total Overtime Hours: <span className="font-mono font-black text-amber-900 ml-1.5 text-xs" style={{ color: '#9a3412' }}>{totalOvertimeHours.toFixed(2)}</span>
              </td>
              <td colSpan={2} className="border border-slate-500 py-2 px-3 text-center font-sans text-slate-950 bg-blue-50/80">
                Grand Total: <span className="font-mono font-black text-blue-900 ml-1.5 text-xs">{grandTotalHours.toFixed(2)} hrs</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SUMMARY HIGHLIGHT CARDS FOR PRINT / REVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 mb-6 p-3 bg-slate-50 border border-slate-300 rounded-lg text-slate-950 font-sans text-xs">
        <div className="p-2.5 bg-white border border-slate-300 rounded-md text-center">
          <span className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider">Total Regular Hours</span>
          <span className="block text-base font-black !text-slate-900 font-mono mt-0.5" style={{ color: '#0f172a' }}>{totalRegularHours.toFixed(2)} hrs</span>
        </div>
        <div 
          className="p-2.5 bg-amber-50 border-2 border-amber-500 rounded-md text-center shadow-sm"
          style={{ borderColor: '#f59e0b', backgroundColor: '#fffbeb' }}
        >
          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-amber-900" style={{ color: '#9a3412' }}>
            TOTAL OVERTIME HOURS
          </span>
          <div className="flex items-center justify-center gap-1.5 mt-0.5">
            <span className="text-base font-black font-mono text-amber-900" style={{ color: '#9a3412' }}>
              {totalOvertimeHours.toFixed(2)} hrs
            </span>
            {totalOvertimeHours > 0 && (
              <span 
                className="bg-amber-100 text-amber-800 border border-amber-300 font-bold text-[10px] px-1 rounded inline-block tracking-tight"
                style={{ color: '#9a3412', borderColor: '#fcd34d', backgroundColor: '#fef3c7' }}
              >
                OT
              </span>
            )}
          </div>
        </div>
        <div className="p-2.5 bg-blue-50 border border-blue-300 rounded-md text-center">
          <span className="block text-[10px] font-bold text-blue-900 uppercase tracking-wider">Grand Total Hours</span>
          <span className="block text-base font-black text-blue-950 font-mono mt-0.5">{grandTotalHours.toFixed(2)} hrs</span>
        </div>
      </div>

      {hasOutOfTown && (
        <div
          className="mb-6 p-3 rounded-lg border-2 border-sky-600 bg-sky-50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
          style={{ backgroundColor: '#f0f9ff', borderColor: '#0284c7', color: '#0c4a6e' }}
        >
          <div>
            <span className="font-extrabold uppercase tracking-wider block text-[10px]" style={{ color: '#0369a1' }}>
              Out of Town Work Confirmation
            </span>
            <span className="font-semibold" style={{ color: '#0c4a6e' }}>
              Out-of-town shift dates: <strong className="font-mono">{outOfTownDates}</strong>
            </span>
          </div>
          <div className="font-mono font-black text-sm" style={{ color: '#0369a1' }}>
            {outOfTownHours.toFixed(2)} hrs ({outOfTownRows.length} shift{outOfTownRows.length > 1 ? 's' : ''})
          </div>
        </div>
      )}

      {/* SIGNATURES SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 pt-6 sm:pt-12 pb-4 sm:pb-6 px-1 sm:px-4">
        <div className="w-full sm:w-auto text-left space-y-1">
          <div className="w-full sm:w-56 md:w-64 border-b border-black mb-1.5" />
          <p className="text-xs font-semibold text-slate-900" style={{ color: '#0f172a' }}>Employee signature</p>
        </div>
        <div className="w-full sm:w-auto text-left sm:text-right space-y-1">
          <div className="w-full sm:w-56 md:w-64 border-b border-black mb-1.5 sm:ml-auto" />
          <p className="text-xs font-semibold text-slate-900" style={{ color: '#0f172a' }}>Approved by signature</p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 text-[10px] text-slate-500 pt-4 sm:pt-8 border-t border-slate-200 mt-4 sm:mt-6 font-mono">
        <span>{footerCopyright}</span>
        <span>{version}</span>
      </div>
    </div>
  );
};

export default JobTimeSheetPrintout;
