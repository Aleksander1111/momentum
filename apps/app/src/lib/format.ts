import type { AutomationName } from '@momentum/contract';

/** "consistency-check" → "Consistency check". */
export function automationLabel(a: AutomationName): string {
  const s = a.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Chat list sub-line kind: "Chat" for chats, "<Automation> run" otherwise. */
export function runKind(a: AutomationName): string {
  return a === 'chat' ? 'Chat' : `${automationLabel(a)} run`;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "just now", "4 min ago", "3 h ago", "yesterday", "Mon", "12 Sep". */
export function relativeTime(iso: string, now = new Date()): string {
  const t = new Date(iso);
  const diff = now.getTime() - t.getTime();
  const min = Math.floor(diff / 60_000);
  const days = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
  if (days <= 0) {
    if (min < 1) return 'just now';
    if (min < 60) return `${min} min ago`;
    return `${Math.floor(min / 60)} h ago`;
  }
  if (days === 1) return 'yesterday';
  if (days < 7) return WEEKDAYS[t.getDay()] ?? '';
  return `${t.getDate()} ${MONTHS[t.getMonth()] ?? ''}`;
}

/** "14 min", "2 h 5 min". */
export function duration(fromIso: string, now = new Date()): string {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(fromIso).getTime()) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/** Usage as percentage points of a rolling limit: "2.3%", "14%", or a dash when unknown. */
export function usagePct(v: number | null): string {
  if (v === null) return '\u2014';
  return `${v < 10 ? Math.round(v * 10) / 10 : Math.round(v)}%`;
}

export function lastSegment(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

/** Entity path without the knowledge-graph/ prefix and .md suffix, split into segments. */
export function pathSegments(path: string): string[] {
  return path
    .replace(/^knowledge-graph\//, '')
    .replace(/\.md$/, '')
    .split('/')
    .filter(Boolean);
}

export function entityKey(v: { workspace: string; path: string }): string {
  return `${v.workspace}\u0000${v.path}`;
}
