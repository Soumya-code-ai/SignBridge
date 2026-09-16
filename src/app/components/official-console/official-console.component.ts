import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { SessionService } from '../../services/session.service';
import { SpeechService } from '../../services/speech.service';
import { AnalyticsService } from '../../services/analytics.service';
import { AnalyticsDashboardComponent } from '../analytics-dashboard/analytics-dashboard.component';
import { TranscriptEntry } from '../../models/gesture.model';

@Component({
  selector: 'app-official-console',
  standalone: true,
  imports: [CommonModule, FormsModule, AnalyticsDashboardComponent],
  templateUrl: './official-console.component.html',
  styleUrl: './official-console.component.css'
})
export class OfficialConsoleComponent implements OnInit {
  transcript$: Observable<TranscriptEntry[]>;

  isListening = false;
  recognitionError = '';
  showPasscodeInput = false;
  passcode = '';
  showAnalytics = false;

  /** Demo-only passcode gating the hidden staff analytics panel. */
  private readonly STAFF_CODE = '2026';

  constructor(
    private session: SessionService,
    private speech: SpeechService,
    public analytics: AnalyticsService
  ) {
    this.transcript$ = this.session.transcript$;
  }

  ngOnInit(): void {
    this.speech.recognitionError$.subscribe((msg) => (this.recognitionError = msg));
  }

  toggleMic(): void {
    if (this.isListening) {
      this.speech.stopListening();
      this.isListening = false;
    } else {
      this.recognitionError = '';
      this.speech.startListening();
      this.isListening = true;
    }
  }

  revealStaffPanel(): void {
    this.showPasscodeInput = true;
  }

  submitPasscode(): void {
    if (this.passcode === this.STAFF_CODE) {
      this.showAnalytics = true;
      this.showPasscodeInput = false;
      this.recognitionError = '';
    } else {
      this.recognitionError = 'Incorrect passcode.';
    }
    this.passcode = '';
  }

  closeAnalytics(): void {
    this.showAnalytics = false;
  }
}
