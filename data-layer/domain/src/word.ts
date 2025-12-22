import type { WordId, WordStatus } from './types.js';

/**
 * Pronunciation information for a word
 */
export interface Pronunciation {
  locale: string; // e.g., 'en-US', 'en-GB'
  ipa?: string; // International Phonetic Alphabet, e.g., '/bʊst/'
  audioUrl?: string; // URL to audio file
  source?: string; // e.g., 'forvo', 'tts'
}

/**
 * Word entity from the dictionary
 */
export interface Word {
  id: WordId;
  text: string; // English word text
  level?: string; // CEFR level: A1, A2, B1, B2, C1, C2
  exampleEn?: string; // Example sentence in English
  exampleRu?: string; // Example sentence translation in Russian
  tags: string[]; // Categories/themes
  pronunciations: Pronunciation[]; // Pronunciation variants
}

