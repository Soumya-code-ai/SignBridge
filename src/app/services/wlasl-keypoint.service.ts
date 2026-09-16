import { Injectable, NgZone } from '@angular/core';
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';

/**
 * Frontend-side down-sampling target. This is the main lever against
 * thermal throttling and latency on the citizen's device: MediaPipe
 * inference (not the WebSocket send) is the expensive step, so capping
 * how often it runs saves far more battery/CPU than anything done on
 * the backend. 10-12fps is enough temporal resolution for isolated
 * word-level signs, and is far below the 30fps a naive rAF loop would
 * otherwise demand from the model on every video frame.
 */
const TARGET_FPS = 12;
const FRAME_INTERVAL_MS = 1000 / TARGET_FPS;

export const NUM_POSE_POINTS = 33;
export const NUM_HAND_POINTS = 21;
/** 33 pose + 21 left hand + 21 right hand = 75 keypoints, x/y only. */
export const TOTAL_KEYPOINTS = NUM_POSE_POINTS + NUM_HAND_POINTS * 2;

@Injectable({ providedIn: 'root' })
export class WlaslKeypointService {
  private poseLandmarker: PoseLandmarker | null = null;
  private handLandmarker: HandLandmarker | null = null;
  private rafId: number | null = null;
  private lastSentAt = 0;

  constructor(private zone: NgZone) {}

  async initialize(): Promise<void> {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
    );

    this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numPoses: 1
    });

    this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath:
          'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 2
    });
  }

  /**
   * Runs pose + two-hand detection at TARGET_FPS and hands a combined,
   * flattened keypoint frame to onFrame. Frames where no person is
   * detected are skipped rather than sent as zeros, so the backend
   * window only ever fills with real signal.
   */
  start(video: HTMLVideoElement, onFrame: (points: Float32Array) => void): void {
    const loop = (now: number) => {
      if (!this.poseLandmarker || !this.handLandmarker || video.readyState < 2) {
        this.rafId = requestAnimationFrame(loop);
        return;
      }
      if (now - this.lastSentAt < FRAME_INTERVAL_MS) {
        this.rafId = requestAnimationFrame(loop);
        return;
      }
      this.lastSentAt = now;

      const ts = performance.now();
      const poseResult = this.poseLandmarker.detectForVideo(video, ts);
      const handResult = this.handLandmarker.detectForVideo(video, ts);

      const combined = this.combine(poseResult, handResult);
      if (combined) this.zone.run(() => onFrame(combined));

      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.lastSentAt = 0;
  }

  private combine(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    poseResult: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handResult: any
  ): Float32Array | null {
    const poseLm = poseResult.landmarks?.[0];
    if (!poseLm) return null; // no person in frame -- don't send a garbage/zeroed frame

    const zeroHand = Array.from({ length: NUM_HAND_POINTS }, () => ({ x: 0, y: 0 }));
    // Note: with a mirrored (selfie-view) video feed, MediaPipe's own
    // Left/Right handedness label is already mirror-corrected relative
    // to the citizen's actual hands -- no extra flip needed here.
    const leftIdx = handResult.handednesses?.findIndex(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (h: any) => h[0]?.categoryName === 'Left'
    );
    const rightIdx = handResult.handednesses?.findIndex(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (h: any) => h[0]?.categoryName === 'Right'
    );
    const left = leftIdx >= 0 ? handResult.landmarks[leftIdx] : zeroHand;
    const right = rightIdx >= 0 ? handResult.landmarks[rightIdx] : zeroHand;

    const out = new Float32Array(TOTAL_KEYPOINTS * 2);
    let i = 0;
    for (const p of [...poseLm, ...left, ...right]) {
      out[i++] = p.x;
      out[i++] = p.y;
    }
    return out;
  }
}
