import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AnalyticsService } from '../../services/analytics.service';

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics-dashboard.component.html',
  styleUrl: './analytics-dashboard.component.css'
})
export class AnalyticsDashboardComponent {
  @Output() close = new EventEmitter<void>();

  constructor(public analytics: AnalyticsService) {}

  get maxHour(): number {
    return Math.max(...this.analytics.peakHours, 1);
  }

  get topInquiryMax(): number {
    return this.analytics.topInquiries[0]?.count ?? 1;
  }

  formatDuration(ms: number): string {
    const totalSeconds = Math.round(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}m ${s}s`;
  }

  reset(): void {
    this.analytics.clear();
  }
}
