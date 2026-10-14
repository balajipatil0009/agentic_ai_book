import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMinutes(total: number): string {
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function formatHours(total: number): string {
  const h = total / 60;
  return h >= 100 ? `${Math.round(h)}h` : `${h.toFixed(1)}h`;
}

export function percent(done: number, total: number): number {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}
