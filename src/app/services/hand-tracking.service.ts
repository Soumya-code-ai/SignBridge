import { Injectable, NgZone } from '@angular/core';
import { Subject } from 'rxjs';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { GestureDefinition } from '../models/gesture.model';

/**
 * Prototype gesture vocabulary for PS16.
 *
 * Each entry is a geometric rule over MediaPipe's 21 hand landmarks rather
 * than a trained classifier — this keeps inference at true zero-latency
 * entirely in the browser and needs no labelled dataset to demo. It is
 * intentionally small; the README explains how to swap this rule engine
 * for a trained ISL/ASL classifier (e.g. a TensorFlow.js model trained on
 * the INCLUDE ISL dataset) without touching any other part of the app.
 */
export const GESTURE_VOCABULARY: GestureDefinition[] = [
  { id: 'hello', label: 'Hello', spokenPhrase: 'Hello, can I get a physical assistance from a sign language interpreter?', fingerPattern: [true, true, true, true, true] },
  { id: 'yes', label: 'Yes', spokenPhrase: 'Yes.', fingerPattern: [true, false, false, false, false] },
  { id: 'no', label: 'No', spokenPhrase: 'No.', fingerPattern: [true, false, true, false, false] },
  { id: 'help', label: 'Help', spokenPhrase: 'I need help, please.', fingerPattern: [true, true, false, false, false] },
  { id: 'thanks', label: 'Thank you', spokenPhrase: 'Thank you.', fingerPattern: [true, true, true, false, false] },
  { id: 'washroom', label: 'Washroom', spokenPhrase: 'Could you direct me to the washroom?', fingerPattern: [true, true, true, true, false] },
  { id: 'emergency', label: 'Emergency', spokenPhrase: 'This is an emergency, I need urgent assistance.', fingerPattern: [true, true, false, false, false] }
];

const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [0, 9], [9, 10], [10, 11], [11, 12],
  [0, 13], [13, 14], [14, 15], [15, 16],
  [0, 17], [17, 18], [18, 19], [19, 20],
  [5, 9], [9, 13], [13, 17]
];

@Injectable({ providedIn: 'root' })
export class HandTrackingService {
  private landmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private lastGestureId: string | null = null;
  private candidateGestureId: string | null = null;
  private candidateSince = 0;
  private readonly HOLD_MS = 550; // sign must be held this long to confirm — avoids flicker

  readonly connections = HAND_CONNECTIONS;

  gesture$ = new Subject<GestureDefinition>();
  landmarks$ = new Subject<{ x: number; y: number; z: number }[] | null>();
  ready$ = new Subject<boolean>();
  error$ = new Subject<string>();

  constructor(private zone: NgZone) {}

  async initialize(): Promise<void> {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
      );
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numHands: 1
      });
      this.ready$.next(true);
    } catch (err) {
      this.error$.next('Could not load the hand-tracking model. Check your connection and reload.');
      throw err;
    }
  }

  start(video: HTMLVideoElement): void {
    const loop = () => {
      if (!this.landmarker || video.readyState < 2) {
        this.rafId = requestAnimationFrame(loop);
        return;
      }
      const result: HandLandmarkerResult = this.landmarker.detectForVideo(video, performance.now());
      this.zone.run(() => this.processResult(result));
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.landmarks$.next(null);
    this.candidateGestureId = null;
  }

  resetLastGesture(): void {
    this.lastGestureId = null;
  }

  private processResult(result: HandLandmarkerResult): void {
    if (!result.landmarks || result.landmarks.length === 0) {
      this.landmarks$.next(null);
      this.candidateGestureId = null;
      return;
    }
    const points = result.landmarks[0];
    this.landmarks$.next(points);

    const match = this.classify(points);
    const now = performance.now();

    if (!match) {
      this.candidateGestureId = null;
      return;
    }
    if (match.id !== this.candidateGestureId) {
      this.candidateGestureId = match.id;
      this.candidateSince = now;
      return;
    }
    if (now - this.candidateSince >= this.HOLD_MS && match.id !== this.lastGestureId) {
      this.lastGestureId = match.id;
      this.gesture$.next(match);
    }
  }

  /**
   * Rule-based classifier: a finger counts as "extended" when its tip sits
   * further from the wrist than its base joint does. Using relative
   * distance (rather than raw y-position) keeps this robust to the hand
   * being tilted, since a citizen at a counter rarely signs perfectly
   * upright.
   */
  private classify(points: { x: number; y: number; z: number }[]): GestureDefinition | null {
    const wrist = points[0];
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const tips = [4, 8, 12, 16, 20];
    const bases = [2, 6, 10, 14, 18];

    const states = tips.map((tipIdx, i) => {
      const tip = points[tipIdx];
      const base = points[bases[i]];
      return dist(tip, wrist) > dist(base, wrist) * 1.15;
    }) as [boolean, boolean, boolean, boolean, boolean];

    return GESTURE_VOCABULARY.find((g) => g.fingerPattern.every((v, i) => v === states[i])) ?? null;
  }
}
