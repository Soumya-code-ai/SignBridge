import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

export interface GlossPrediction {
  gloss: string;
  confidence: number;
}

export type SocketState = 'connecting' | 'open' | 'closed' | 'error';

/**
 * Manages the WebSocket connection to the FastAPI WLASL backend.
 *
 * Frontend half of the frame-dropping strategy: sendFrame() refuses to
 * send (and the caller simply skips that frame) if the socket isn't
 * open or a previous frame hasn't actually left the browser's send
 * buffer yet. That means a slow network or a slow backend degrades to
 * a lower effective frame rate instead of an ever-growing backlog of
 * queued frames -- which is what would actually cause runaway latency
 * on a real counter device.
 */
@Injectable({ providedIn: 'root' })
export class KeypointStreamService {
  private socket: WebSocket | null = null;
  private readonly backendUrl = this.getBackendUrl();

  prediction$ = new Subject<GlossPrediction>();
  /** Fires when the backend reports no active signing -- lets the UI clear a stale word. */
  idle$ = new Subject<void>();
  connectionState$ = new Subject<SocketState>();

  connect(url = `${this.backendUrl}/ws/translate`, languageCode = 'isl'): void {
    if (this.socket) return;
    this.connectionState$.next('connecting');
    this.socket = new WebSocket(`${url}?language=${encodeURIComponent(languageCode)}`);

    this.socket.onopen = () => this.connectionState$.next('open');
    this.socket.onclose = () => {
      this.connectionState$.next('closed');
      this.socket = null;
    };
    this.socket.onerror = () => this.connectionState$.next('error');
    this.socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'prediction') {
          this.prediction$.next({ gloss: msg.gloss, confidence: msg.confidence });
        } else if (msg.type === 'idle') {
          this.idle$.next();
        }
      } catch {
        /* ignore malformed message */
      }
    };
  }

  /** Sends one flattened [x, y, x, y, ...] keypoint frame. Returns false
   * (frame dropped) if the socket isn't ready to accept it. */
  sendFrame(keypoints: Float32Array): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return false;
    if (this.socket.bufferedAmount > 0) return false; // previous frame not yet flushed -- drop this one
    this.socket.send(JSON.stringify({ type: 'frame', ts: Date.now(), keypoints: Array.from(keypoints) }));
    return true;
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  private getBackendUrl(): string {
    const runtime = globalThis as typeof globalThis & { __SIGNBRIDGE_BACKEND_URL__?: string };
    const configuredUrl = runtime.__SIGNBRIDGE_BACKEND_URL__?.trim();
    return (configuredUrl || 'ws://localhost:8000').replace(/\/+$/, '');
  }
}
