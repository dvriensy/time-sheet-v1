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
  // Process entries into direct vs admin hours & regular vs overtime hours
  const processedRows = entries.map(entry => {
    const isAdmin = /admin|office|paperwork|meeting|overhead|training/i.test(`${entry.project} ${entry.notes}`);
    const direct = isAdmin ? 0 : entry.totalHours;
    const admin = isAdmin ? entry.totalHours : 0;

    const ot = (entry as any).overtimeHours !== undefined 
      ? Number((entry as any).overtimeHours) 
      : (entry.isOvertime ? entry.totalHours : 0);
    const reg = (entry as any).regularHours !== undefined 
      ? Number((entry as any).regularHours) 
      : (entry.isOvertime ? 0 : entry.totalHours);

    let jobTypeStr = 'Regular';
    if (ot > 0 && reg > 0) {
      jobTypeStr = 'Reg / OT';
    } else if (ot > 0) {
      jobTypeStr = 'Overtime';
    }

    return {
      date: entry.date,
      startTime: entry.startTime,
      stopTime: entry.endTime,
      jobType: jobTypeStr,
      task: entry.project,
      client: entry.locationName || 'Client Project',
      directHours: direct,
      adminHours: admin,
      regHours: reg,
      otHours: ot,
      totalHours: entry.totalHours,
      notes: entry.notes
    };
  });

  // Calculate totals
  const totalDirectHours = processedRows.reduce((sum, r) => sum + r.directHours, 0);
  const totalAdminHours = processedRows.reduce((sum, r) => sum + r.adminHours, 0);
  const totalRegularHours = processedRows.reduce((sum, r) => sum + r.regHours, 0);
  const totalOvertimeHours = processedRows.reduce((sum, r) => sum + r.otHours, 0);
  const grandTotalHours = totalRegularHours + totalOvertimeHours;

  // Fill up to 14 rows to mirror the reference template image layout
  const MIN_ROWS = 14;
  const emptyRowsCount = Math.max(0, MIN_ROWS - processedRows.length);

  return (
    <div 
      id="payperiod-printout" 
      className="w-full max-w-4xl mx-auto bg-white text-slate-950 p-8 md:p-10 rounded-xl border border-slate-300 shadow-2xl print:shadow-none print:border-none print:p-0 print:m-0 print:bg-white font-sans text-xs select-none"
    >
      {/* HEADER SECTION */}
      <div className="text-center mb-6">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-black uppercase font-sans">
          Job Time Sheet
        </h1>
      </div>

      <div className="flex justify-between items-end mb-4 font-sans text-xs md:text-sm text-black px-1">
        <div>
          <span className="font-bold">Employee:</span>{' '}
          <span className="ml-1 border-b border-black/60 min-w-[220px] inline-block font-mono text-slate-900 pb-0.5">
            {employeeName || '________________________'}
          </span>
        </div>
        <div>
          <span className="font-bold">Date Range:</span>{' '}
          <span className="ml-1 border-b border-black/60 min-w-[160px] inline-block font-mono text-slate-900 text-right pb-0.5">
            {dateRange || '________________'}
          </span>
        </div>
      </div>

      {/* MAIN TABLE */}
      <div className="overflow-x-auto mb-8">
        <table className="w-full border-collapse border border-slate-600 text-xs text-black">
          <thead>
            <tr className="bg-slate-200 border-b border-slate-600 font-bold text-center text-[11px]">
              <th className="border border-slate-500 py-2 px-1.5 w-[13%]">Date</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[10%]">Start time</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[10%]">Stop time</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[12%]">Job type</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[23%]">Task</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[14%]">Client</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[9%]">Direct hrs</th>
              <th className="border border-slate-500 py-2 px-1.5 w-[9%]">Admin hrs</th>
            </tr>
          </thead>
          <tbody>
            {processedRows.map((row, idx) => (
              <tr key={idx} className="h-8 border-b border-slate-400 text-center">
                <td className="border border-slate-400 py-1.5 px-1.5 font-mono text-[11px] whitespace-nowrap">{row.date}</td>
                <td className="border border-slate-400 py-1.5 px-1.5 font-mono whitespace-nowrap">{row.startTime}</td>
                <td className="border border-slate-400 py-1.5 px-1.5 font-mono whitespace-nowrap">{row.stopTime}</td>
                <td className="border border-slate-400 py-1.5 px-1.5">{row.jobType}</td>
                <td className="border border-slate-400 py-1.5 px-1.5 text-left font-medium truncate max-w-[170px]">{row.task}</td>
                <td className="border border-slate-400 py-1.5 px-1.5 text-left truncate max-w-[130px]">{row.client}</td>
                <td className="border border-slate-400 py-1.5 px-1.5 font-mono font-semibold">{row.directHours > 0 ? row.directHours.toFixed(2) : ''}</td>
                <td className="border border-slate-400 py-1.5 px-1.5 font-mono font-semibold">{row.adminHours > 0 ? row.adminHours.toFixed(2) : ''}</td>
              </tr>
            ))}

            {/* Blank Filler Rows matching reference image */}
            {Array.from({ length: emptyRowsCount }).map((_, idx) => (
              <tr key={`empty-${idx}`} className="h-7 border-b border-slate-300">
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
                <td className="border border-slate-300"></td>
              </tr>
            ))}

            {/* TOTAL SUMMARY ROW */}
            <tr className="bg-slate-200 font-bold border-t-2 border-slate-600 text-center text-xs h-9">
              <td colSpan={5} className="border border-slate-500 py-2 px-3 text-left font-bold text-black font-sans">
                Direct / Admin Total
              </td>
              <td className="border border-slate-500 py-2 px-2 text-center font-bold text-black font-sans">
                Total
              </td>
              <td className="border border-slate-500 py-2 px-2 font-mono text-black font-extrabold text-xs">
                {totalDirectHours > 0 ? totalDirectHours.toFixed(2) : '0.00'}
              </td>
              <td className="border border-slate-500 py-2 px-2 font-mono text-black font-extrabold text-xs">
                {totalAdminHours > 0 ? totalAdminHours.toFixed(2) : '0.00'}
              </td>
            </tr>
            {/* REGULAR / OVERTIME / GRAND TOTAL BREAKDOWN ROW */}
            <tr className="bg-slate-100 font-bold border-t border-slate-500 text-xs h-9">
              <td colSpan={3} className="border border-slate-500 py-2 px-3 text-right font-sans text-slate-900">
                Total Regular Hours: <span className="font-mono font-black text-black ml-1.5 text-xs">{totalRegularHours.toFixed(2)}</span>
              </td>
              <td colSpan={3} className="border border-slate-500 py-2 px-3 text-right font-sans text-amber-950 bg-amber-50/80">
                Total Overtime Hours: <span className="font-mono font-black text-amber-900 ml-1.5 text-xs">{totalOvertimeHours.toFixed(2)}</span>
              </td>
              <td colSpan={2} className="border border-slate-500 py-2 px-3 text-center font-sans text-slate-950 bg-blue-50/80">
                Grand Total: <span className="font-mono font-black text-blue-900 ml-1.5 text-xs">{grandTotalHours.toFixed(2)} hrs</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* SUMMARY HIGHLIGHT CARDS FOR PRINT / REVIEW */}
      <div className="grid grid-cols-3 gap-3 mb-6 p-3 bg-slate-50 border border-slate-300 rounded-lg text-black font-sans text-xs">
        <div className="p-2.5 bg-white border border-slate-300 rounded-md text-center">
          <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Regular Hours</span>
          <span className="block text-base font-black text-slate-900 font-mono mt-0.5">{totalRegularHours.toFixed(2)} hrs</span>
        </div>
        <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-md text-center">
          <span className="block text-[10px] font-bold text-amber-800 uppercase tracking-wider">Total Overtime Hours</span>
          <span className="block text-base font-black text-amber-950 font-mono mt-0.5">{totalOvertimeHours.toFixed(2)} hrs</span>
        </div>
        <div className="p-2.5 bg-blue-50 border border-blue-300 rounded-md text-center">
          <span className="block text-[10px] font-bold text-blue-800 uppercase tracking-wider">Grand Total Hours</span>
          <span className="block text-base font-black text-blue-950 font-mono mt-0.5">{grandTotalHours.toFixed(2)} hrs</span>
        </div>
      </div>

      {/* SIGNATURES SECTION */}
      <div className="flex justify-between items-end pt-12 pb-6 px-4">
        <div className="text-left space-y-1">
          <div className="w-56 md:w-64 border-b border-black mb-1.5" />
          <p className="text-xs font-semibold text-black">Employee signature</p>
        </div>
        <div className="text-right space-y-1">
          <div className="w-56 md:w-64 border-b border-black mb-1.5 ml-auto" />
          <p className="text-xs font-semibold text-black">Approved by signature</p>
        </div>
      </div>

      {/* FOOTER */}
      <div className="flex justify-between items-center text-[10px] text-slate-500 pt-8 border-t border-slate-200 mt-6 font-mono">
        <span>{footerCopyright}</span>
        <span>{version}</span>
      </div>
    </div>
  );
};

export default JobTimeSheetPrintout;
