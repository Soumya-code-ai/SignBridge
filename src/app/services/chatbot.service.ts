import { Injectable } from '@angular/core';

interface FaqEntry {
  category: string;
  keywords: string[];
  answer: string;
}

/**
 * Small local FAQ knowledge base for the context-aware assistant. Runs
 * entirely in-browser (no network call), so it keeps working offline
 * alongside the translation engine.
 */
const FAQS: FaqEntry[] = [
  { category: 'documents', keywords: ['document', 'id', 'proof', 'aadhaar', 'papers', 'bring'], answer: 'For most counter services, bring a government photo ID and the specific form for your request. Ask the counter officer if you are unsure which documents apply to you.' },
  { category: 'waiting', keywords: ['wait', 'time', 'long', 'queue', 'token'], answer: 'Average waiting time is shown on the token display. You can also ask the counter officer for today\u2019s estimate.' },
  { category: 'hours', keywords: ['hours', 'open', 'close', 'timing'], answer: 'This counter is open 9:30 AM to 5:00 PM, Monday to Saturday.' },
  { category: 'washroom', keywords: ['washroom', 'restroom', 'toilet', 'bathroom'], answer: 'The washroom is down the corridor to your left, past the water dispenser.' },
  { category: 'accessibility', keywords: ['wheelchair', 'accessible', 'ramp', 'disability'], answer: 'This counter has a ramp entrance and a lowered service window. Please ask any staff member for assistance.' },
  { category: 'fees', keywords: ['fee', 'pay', 'payment', 'cost', 'charge'], answer: 'Fees vary by service. UPI, card, and cash are all accepted at this counter.' },
  { category: 'forms', keywords: ['form', 'fill', 'application', 'filling'], answer: 'A staff member can help you fill your form. Tap "Help" below or show the Help sign to your counter officer.' },
  { category: 'emergency', keywords: ['emergency', 'urgent', 'help now', 'medical'], answer: 'If this is urgent, please show the Emergency sign now \u2014 the counter officer has been alerted.' }
];

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private lastCategory: string | null = null;

  respond(query: string): { answer: string; category: string | null } {
    const q = query.toLowerCase();
    let best: FaqEntry | null = null;
    let bestScore = 0;

    for (const faq of FAQS) {
      const score = faq.keywords.filter((k) => q.includes(k)).length;
      if (score > bestScore) {
        bestScore = score;
        best = faq;
      }
    }

    // Basic context-awareness: a vague follow-up reuses the last topic.
    if (!best && this.lastCategory && /how long|what about|and\?/.test(q)) {
      best = FAQS.find((f) => f.category === this.lastCategory) ?? null;
    }

    if (best) {
      this.lastCategory = best.category;
      return { answer: best.answer, category: best.category };
    }

    this.lastCategory = null;
    return {
      answer: "I'm not certain about that one \u2014 I've flagged it for a staff member to help you directly.",
      category: null
    };
  }

  get quickPrompts(): string[] {
    return [
      'Which documents do I need?',
      'How long is the wait?',
      'Where is the washroom?',
      'Is this counter wheelchair accessible?'
    ];
  }
}
