import { Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WlaslKeypointService } from '../../services/wlasl-keypoint.service';
import { KeypointStreamService, GlossPrediction, SocketState } from '../../services/keypoint-stream.service';

type Phase = 'idle' | 'starting' | 'live' | 'error';

@Component({
  selector: 'app-wlasl-translator',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './wlasl-translator.component.html',
  styleUrl: './wlasl-translator.component.css'
})
export class WlaslTranslatorComponent implements OnDestroy {
  @ViewChild('wlaslVideo') videoRef!: ElementRef<HTMLVideoElement>;
  @Input() languageCode = 'isl';

  phase: Phase = 'idle';
  errorMessage = '';
  latestGloss: GlossPrediction | null = null;
  connectionState: SocketState = 'closed';

  private stream: MediaStream | null = null;

  constructor(
    private keypoints: WlaslKeypointService,
    private socket: KeypointStreamService
  ) {
    this.socket.connectionState$.subscribe((s) => (this.connectionState = s));
    this.socket.prediction$.subscribe((p) => (this.latestGloss = p));
    this.socket.idle$.subscribe(() => (this.latestGloss = null));
  }

  async start(): Promise<void> {
    this.phase = 'starting';
    this.errorMessage = '';
    try {
      // Resolution is capped deliberately -- a smaller input frame means
      // less work for MediaPipe on every detection, which is the other
      // half of the hardware-optimization strategy alongside TARGET_FPS
      // in WlaslKeypointService.
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 360 } },
        audio: false
      });
      const video = this.videoRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();

      this.socket.connect(undefined, this.languageCode);
      await this.keypoints.initialize();
      this.keypoints.start(video, (frame) => this.socket.sendFrame(frame));
      this.phase = 'live';
    } catch {
      this.phase = 'error';
      this.errorMessage =
        'Could not start the full-vocabulary translator. Check the camera permission and that the backend (uvicorn main:app) is running on port 8000.';
    }
  }

  stop(): void {
    this.keypoints.stop();
    this.socket.disconnect();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.latestGloss = null;
    this.phase = 'idle';
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
