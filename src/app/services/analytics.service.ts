import { Injectable } from '@angular/core';

type EventType = 'gesture' | 'chat_query' | 'unresolved_query' | 'session';

interface RawEvent {
  type: EventType;
  label: string;
  timestamp: number;
  durationMs?: number;
}

const STORAGE_KEY = 'signbridge_analytics_v1';

/**
 * Powers the Official Analytics Dashboard. Everything is persisted to
 * localStorage so counter staff can see today's patterns even when the
 * counter has no connectivity -- no backend required for the prototype.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private events: RawEvent[] = this.load();

  private load(): RawEvent[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.events));
    } catch {
      /* storage unavailable -- analytics simply won't persist this session */
    }
  }

  record(type: EventType, label: string, durationMs?: number): void {
    this.events.push({ type, label, timestamp: Date.now(), durationMs });
    this.persist();
  }

  clear(): void {
    this.events = [];
    this.persist();
  }

  get topInquiries(): { label: string; count: number }[] {
    const counts = new Map<string, number>();
    this.events
      .filter((e) => e.type === 'chat_query' || e.type === 'gesture')
      .forEach((e) => counts.set(e.label, (counts.get(e.label) ?? 0) + 1));
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  get peakHours(): number[] {
    const buckets = new Array(24).fill(0);
    this.events.forEach((e) => {
      buckets[new Date(e.timestamp).getHours()]++;
    });
    return buckets;
  }

  get totalSessions(): number {
    return this.events.filter((e) => e.type === 'session' && e.label === 'session_end').length;
  }

  get averageDurationMs(): number {
    const sessions = this.events.filter((e) => e.type === 'session' && e.durationMs);
    if (!sessions.length) return 0;
    return sessions.reduce((sum, e) => sum + (e.durationMs ?? 0), 0) / sessions.length;
  }

  get unresolvedCount(): number {
    return this.events.filter((e) => e.type === 'unresolved_query').length;
  }
}
