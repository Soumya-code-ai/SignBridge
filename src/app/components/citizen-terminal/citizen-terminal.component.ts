import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HandTrackingService, GESTURE_VOCABULARY } from '../../services/hand-tracking.service';
import { SpeechService } from '../../services/speech.service';
import { SessionService } from '../../services/session.service';
import { AnalyticsService } from '../../services/analytics.service';
import { ChatbotWidgetComponent } from '../chatbot-widget/chatbot-widget.component';
import { WlaslTranslatorComponent } from '../wlasl-translator/wlasl-translator.component';
import { GestureDefinition } from '../../models/gesture.model';
import { SIGN_LANGUAGES, SignLanguage } from '../../models/sign-language.model';

type CameraState = 'idle' | 'loading' | 'active' | 'error';

@Component({
  selector: 'app-citizen-terminal',
  standalone: true,
  imports: [CommonModule, FormsModule, ChatbotWidgetComponent, WlaslTranslatorComponent],
  templateUrl: './citizen-terminal.component.html',
  styleUrl: './citizen-terminal.component.css'
})
export class CitizenTerminalComponent implements OnInit, OnDestroy {
  @ViewChild('video') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('overlay') overlayRef!: ElementRef<HTMLCanvasElement>;

  state: CameraState = 'idle';
  errorMessage = '';
  currentGesture: GestureDefinition | null = null;
  officialCaption = '';
  showChatbot = false;
  showWlasl = false;
  vocabulary = GESTURE_VOCABULARY;
  languageOptions = SIGN_LANGUAGES;
  selectedLanguage: SignLanguage = SIGN_LANGUAGES[0];

  private stream: MediaStream | null = null;

  constructor(
    private hands: HandTrackingService,
    private speech: SpeechService,
    private session: SessionService,
    private analytics: AnalyticsService
  ) {}

  ngOnInit(): void {
    this.session.startSession();
    this.analytics.record('session', 'session_start');

    this.hands.gesture$.subscribe((g) => this.onGesture(g));
    this.hands.landmarks$.subscribe((points) => this.drawOverlay(points));
    this.hands.error$.subscribe((msg) => {
      this.state = 'error';
      this.errorMessage = msg;
    });

    this.speech.transcript$.subscribe((text) => {
      this.officialCaption = text;
      this.session.addEntry('official', text);
    });
  }

  async startCamera(): Promise<void> {
    this.state = 'loading';
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      const video = this.videoRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      await this.hands.initialize();
      this.hands.start(video);
      this.state = 'active';
    } catch {
      this.state = 'error';
      this.errorMessage = 'Camera access was blocked. Please allow camera permissions and try again.';
    }
  }

  toggleChatbot(): void {
    this.showChatbot = !this.showChatbot;
  }

  toggleWlasl(): void {
    this.showWlasl = !this.showWlasl;
  }

  private onGesture(gesture: GestureDefinition): void {
    this.currentGesture = gesture;
    this.speech.speak(gesture.spokenPhrase, this.selectedLanguage.locale);
    this.session.addEntry('citizen', gesture.spokenPhrase);
    this.analytics.record('gesture', gesture.label);
  }

  private drawOverlay(points: { x: number; y: number }[] | null): void {
    const canvas = this.overlayRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!points) return;

    ctx.strokeStyle = 'rgba(107, 143, 113, 0.55)';
    ctx.fillStyle = 'rgba(107, 143, 113, 0.9)';
    ctx.lineWidth = 2;

    this.hands.connections.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(points[a].x * canvas.width, points[a].y * canvas.height);
      ctx.lineTo(points[b].x * canvas.width, points[b].y * canvas.height);
      ctx.stroke();
    });

    points.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x * canvas.width, p.y * canvas.height, 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  ngOnDestroy(): void {
    this.hands.stop();
    this.stream?.getTracks().forEach((t) => t.stop());
    const duration = this.session.endSession();
    this.analytics.record('session', 'session_end', duration);
  }
}
