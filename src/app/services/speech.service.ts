import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * Wraps the two halves of the Web Speech API used by SignBridge:
 *  - speechSynthesis turns a recognised sign into audible speech
 *    (citizen -> official).
 *  - SpeechRecognition performs the reverse direction, turning the
 *    official's spoken words into captions the citizen can read
 *    (official -> citizen).
 * Every entry point is wrapped so an unsupported or blocked browser
 * degrades into a clear message instead of a silent failure.
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private recognition: any = null;
  private listening = false;

  transcript$ = new Subject<string>();
  recognitionError$ = new Subject<string>();

  speak(text: string, locale = 'en-IN'): void {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = locale;
    utterance.rate = 0.95;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  }

  get isRecognitionSupported(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
  }

  get isListening(): boolean {
    return this.listening;
  }

  startListening(): void {
    if (this.listening) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      this.recognitionError$.next('Speech recognition is not supported in this browser. Try Chrome or Edge.');
      return;
    }
    try {
      this.recognition = new SpeechRecognitionCtor();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-IN';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onresult = (event: any) => {
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
        }
        if (finalText.trim()) this.transcript$.next(finalText.trim());
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.recognition.onerror = (event: any) => {
        this.recognitionError$.next('Microphone error: ' + event.error);
      };
      this.recognition.onend = () => {
        this.listening = false;
      };
      this.recognition.start();
      this.listening = true;
    } catch {
      this.recognitionError$.next('Could not start the microphone.');
    }
  }

  stopListening(): void {
    if (this.recognition && this.listening) {
      this.recognition.stop();
      this.listening = false;
    }
  }
}
