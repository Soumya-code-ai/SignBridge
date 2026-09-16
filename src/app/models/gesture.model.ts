export interface GestureDefinition {
  id: string;
  label: string;
  spokenPhrase: string;
  /** [thumb, index, middle, ring, pinky] extended = true */
  fingerPattern: [boolean, boolean, boolean, boolean, boolean];
}

export type { SignLanguage } from './sign-language.model';

export interface TranscriptEntry {
  source: 'citizen' | 'official';
  text: string;
  timestamp: number;
}

export interface ChatMessage {
  role: 'user' | 'bot';
  text: string;
  timestamp: number;
}
