export interface AlbertaHoliday {
  date: string; // YYYY-MM-DD
  name: string;
}

export function getAlbertaHoliday(dateStr: string): string | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-');
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;

  // 1. New Year's Day: Jan 1
  if (month === 1 && day === 1) return "New Year's Day";

  // 2. Family Day: 3rd Monday in February
  const familyDayVal = getNthWeekdayOfMonth(year, 2, 1, 3);
  if (month === 2 && day === familyDayVal) return "Alberta Family Day";

  // 3. Good Friday: Friday before Easter Sunday
  const goodFriday = getGoodFriday(year);
  if (month === goodFriday.month && day === goodFriday.day) return "Good Friday";

  // 4. Victoria Day: Monday preceding May 25
  const victoriaDayVal = getVictoriaDay(year);
  if (month === 5 && day === victoriaDayVal) return "Victoria Day";

  // 5. Canada Day: July 1
  if (month === 7 && day === 1) return "Canada Day";

  // 6. Heritage Day: 1st Monday in August
  const heritageDayVal = getNthWeekdayOfMonth(year, 8, 1, 1);
  if (month === 8 && day === heritageDayVal) return "Alberta Heritage Day";

  // 7. Labour Day: 1st Monday in September
  const labourDayVal = getNthWeekdayOfMonth(year, 9, 1, 1);
  if (month === 9 && day === labourDayVal) return "Labour Day";

  // 8. National Day for Truth and Reconciliation: September 30
  if (month === 9 && day === 30) return "National Day for Truth and Reconciliation";

  // 9. Thanksgiving Day: 2nd Monday in October
  const thanksgivingVal = getNthWeekdayOfMonth(year, 10, 1, 2);
  if (month === 10 && day === thanksgivingVal) return "Thanksgiving Day";

  // 10. Remembrance Day: November 11
  if (month === 11 && day === 11) return "Remembrance Day";

  // 11. Christmas Day: December 25
  if (month === 12 && day === 25) return "Christmas Day";

  // 12. Boxing Day: December 26
  if (month === 12 && day === 26) return "Boxing Day";

  return null;
}

function getNthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): number {
  let count = 0;
  for (let d = 1; d <= 31; d++) {
    const dateObj = new Date(year, month - 1, d);
    if (dateObj.getMonth() !== month - 1) break;
    if (dateObj.getDay() === weekday) {
      count++;
      if (count === n) return d;
    }
  }
  return 1;
}

function getVictoriaDay(year: number): number {
  for (let d = 24; d >= 18; d--) {
    const dateObj = new Date(year, 4, d); // May is index 4
    if (dateObj.getDay() === 1) return d; // 1 = Monday
  }
  return 24;
}

function getGoodFriday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const L = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * L) / 451);
  const month = Math.floor((h + L - 7 * m + 114) / 31);
  const day = ((h + L - 7 * m + 114) % 31) + 1;
  
  const easterDate = new Date(year, month - 1, day);
  const goodFridayDate = new Date(easterDate.getTime() - 2 * 24 * 60 * 60 * 1000);
  return {
    month: goodFridayDate.getMonth() + 1,
    day: goodFridayDate.getDate()
  };
}
