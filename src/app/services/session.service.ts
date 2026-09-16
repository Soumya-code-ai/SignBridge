import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { TranscriptEntry } from '../models/gesture.model';

/**
 * Shared session state between the Citizen Terminal and Official Console.
 * Keeps a live transcript and session timing so both sides of the split
 * screen stay in strict, predictable sync.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private transcriptSubject = new BehaviorSubject<TranscriptEntry[]>([]);
  transcript$ = this.transcriptSubject.asObservable();

  private sessionStartedAt: number | null = null;

  addEntry(source: TranscriptEntry['source'], text: string): void {
    const entry: TranscriptEntry = { source, text, timestamp: Date.now() };
    this.transcriptSubject.next([...this.transcriptSubject.value, entry]);
  }

  startSession(): void {
    this.sessionStartedAt = Date.now();
    this.transcriptSubject.next([]);
  }

  /** Ends the session and returns its duration in milliseconds. */
  endSession(): number {
    const duration = this.sessionStartedAt ? Date.now() - this.sessionStartedAt : 0;
    this.sessionStartedAt = null;
    return duration;
  }

  get isActive(): boolean {
    return this.sessionStartedAt !== null;
  }
}
