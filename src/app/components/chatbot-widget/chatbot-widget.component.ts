import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatbotService } from '../../services/chatbot.service';
import { AnalyticsService } from '../../services/analytics.service';
import { ChatMessage } from '../../models/gesture.model';

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot-widget.component.html',
  styleUrl: './chatbot-widget.component.css'
})
export class ChatbotWidgetComponent {
  messages: ChatMessage[] = [
    { role: 'bot', text: 'Hi. Ask me a question, or tap a quick option below.', timestamp: Date.now() }
  ];
  draft = '';

  constructor(private chatbot: ChatbotService, private analytics: AnalyticsService) {}

  get quickPrompts(): string[] {
    return this.chatbot.quickPrompts;
  }

  send(text?: string): void {
    const query = (text ?? this.draft).trim();
    if (!query) return;

    this.messages.push({ role: 'user', text: query, timestamp: Date.now() });
    const { answer, category } = this.chatbot.respond(query);
    this.messages.push({ role: 'bot', text: answer, timestamp: Date.now() });

    this.analytics.record(category ? 'chat_query' : 'unresolved_query', category ?? query);
    this.draft = '';
  }
}
