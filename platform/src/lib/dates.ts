/**
 * Calendar-day math for streaks / heatmaps.
 *
 * Everything is keyed on the *local* calendar day as 'YYYY-MM-DD' text so a
 * session logged at 23:58 counts toward the day the learner actually studied,
 * regardless of server timezone or DST.
 */

export type DayKey = string;

export function toDayKey(date: Date): DayKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDayKey(key: DayKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DayKey, n: number): DayKey {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

/** Today's local calendar day. */
export function todayKey(now: Date = new Date()): DayKey {
  return toDayKey(now);
}

/** Ascending list of day keys covering the last `n` days, ending today. */
export function lastNDays(n: number, now: Date = new Date()): DayKey[] {
  const end = todayKey(now);
  const out: DayKey[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

export function dayOfWeek(key: DayKey): number {
  return fromDayKey(key).getDay(); // 0 = Sunday
}

export function prettyDay(key: DayKey): string {
  return fromDayKey(key).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export type Streak = {
  current: number;
  longest: number;
  todayActive: boolean;
};

/**
 * Current streak counts back from today; if today is empty the streak is still
 * alive as long as *yesterday* was studied (the day isn't over yet).
 */
export function computeStreak(dayKeys: DayKey[], now: Date = new Date()): Streak {
  const set = new Set(dayKeys);
  const today = todayKey(now);

  const longest = longestRun(dayKeys);

  let current = 0;
  let cursor = set.has(today) ? today : addDays(today, -1);
  if (set.has(cursor)) {
    while (set.has(cursor)) {
      current++;
      cursor = addDays(cursor, -1);
    }
  }

  return { current, longest, todayActive: set.has(today) };
}

function longestRun(dayKeys: DayKey[]): number {
  const unique = [...new Set(dayKeys)].sort();
  let best = 0;
  let run = 0;
  let prev: DayKey | null = null;
  for (const key of unique) {
    run = prev !== null && addDays(prev, 1) === key ? run + 1 : 1;
    best = Math.max(best, run);
    prev = key;
  }
  return best;
}

export type HeatCell = {
  day: DayKey;
  minutes: number;
  /** 0 = nothing, 1..4 = increasing intensity (LeetCode greens). */
  level: 0 | 1 | 2 | 3 | 4;
  future: boolean;
};

export function levelFor(minutes: number): 0 | 1 | 2 | 3 | 4 {
  if (minutes <= 0) return 0;
  if (minutes < 30) return 1;
  if (minutes < 60) return 2;
  if (minutes < 120) return 3;
  return 4;
}

/**
 * GitHub-style contribution grid: columns = weeks (oldest → newest),
 * rows = Sunday → Saturday. Cells after today are marked `future`.
 */
export function buildHeatmap(
  totals: Record<DayKey, number>,
  weeks = 26,
  now: Date = new Date(),
): HeatCell[][] {
  const today = todayKey(now);
  const todayDow = dayOfWeek(today);
  // Last column ends on the Saturday of this week.
  const endOfWeek = addDays(today, 6 - todayDow);
  const startOfWeek = addDays(endOfWeek, -7 * (weeks - 1));

  const grid: HeatCell[][] = [];
  for (let w = 0; w < weeks; w++) {
    const col: HeatCell[] = [];
    for (let d = 0; d < 7; d++) {
      const day = addDays(startOfWeek, w * 7 + d);
      const minutes = totals[day] ?? 0;
      col.push({
        day,
        minutes,
        level: minutes > 0 ? levelFor(minutes) : 0,
        future: day > today,
      });
    }
    grid.push(col);
  }
  return grid;
}

/** Minutes studied per local day, from raw session rows. */
export function toDayTotals(
  rows: Array<{ day: string; minutes: number }>,
): Record<DayKey, number> {
  const totals: Record<DayKey, number> = {};
  for (const r of rows) totals[r.day] = (totals[r.day] ?? 0) + r.minutes;
  return totals;
}
