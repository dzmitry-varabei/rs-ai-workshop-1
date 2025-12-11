import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserId, WordId } from '@english-learning/domain';
import type { Word, Pronunciation, WordRepository } from '@english-learning/domain';

/**
 * Database row types (matching Supabase schema)
 */
interface WordRow {
  id: string;
  text_en: string;
  level: string | null;
  example_en: string | null;
  example_ru: string | null;
  tags: string[];
  extra: Record<string, unknown>;
}

interface PronunciationRow {
  id: string;
  word_id: string;
  locale: string;
  ipa: string | null;
  audio_url: string | null;
  source: string | null;
}

/**
 * Supabase implementation of WordRepository
 */
export class SupabaseWordRepository implements WordRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getRandomBatch(userId: UserId, limit: number): Promise<Word[]> {
    // PostgREST не поддерживает order по random(), поэтому делаем случайный offset
    const safeLimit = Math.max(1, limit);

    const { count, error: countError } = await this.client
      .from('words')
      .select('id', { count: 'exact', head: true });

    if (countError) {
      throw new Error(`Failed to count words: ${countError.message}`);
    }

    const total = count ?? 0;
    if (total === 0) return [];

    const maxOffset = Math.max(total - safeLimit, 0);
    const offset = Math.floor(Math.random() * (maxOffset + 1));

    const { data, error } = await this.client
      .from('words')
      .select('id, text_en, level, example_en, example_ru, tags, extra')
      .range(offset, offset + safeLimit - 1);

    if (error) {
      throw new Error(`Failed to fetch random words: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    return this.mapWordsWithPronunciations(data);
  }

  async getByIds(ids: WordId[]): Promise<Word[]> {
    if (ids.length === 0) {
      return [];
    }

    const { data, error } = await this.client
      .from('words')
      .select('id, text_en, level, example_en, example_ru, tags, extra')
      .in('id', ids);

    if (error) {
      throw new Error(`Failed to fetch words by IDs: ${error.message}`);
    }

    if (!data || data.length === 0) {
      return [];
    }

    return this.mapWordsWithPronunciations(data);
  }

  async getTotalCount(): Promise<number> {
    const { count, error } = await this.client
      .from('words')
      .select('*', { count: 'exact', head: true });

    if (error) {
      throw new Error(`Failed to count words: ${error.message}`);
    }

    return count ?? 0;
  }

  /**
   * Map database rows to domain Word objects with pronunciations
   */
  private async mapWordsWithPronunciations(wordRows: WordRow[]): Promise<Word[]> {
    const wordIds = wordRows.map((row) => row.id);

    // Fetch pronunciations for all words
    const { data: pronunciations, error: pronError } = await this.client
      .from('word_pronunciations')
      .select('word_id, locale, ipa, audio_url, source')
      .in('word_id', wordIds);

    if (pronError) {
      // Log error but don't fail - words can exist without pronunciations
      console.warn(`Failed to fetch pronunciations: ${pronError.message}`);
    }

    // Group pronunciations by word_id
    const pronunciationsByWordId = new Map<string, Pronunciation[]>();
    if (pronunciations) {
      for (const pron of pronunciations) {
        const wordId = pron.word_id;
        if (!pronunciationsByWordId.has(wordId)) {
          pronunciationsByWordId.set(wordId, []);
        }
        pronunciationsByWordId.get(wordId)!.push({
          locale: pron.locale,
          ipa: pron.ipa ?? undefined,
          audioUrl: pron.audio_url ?? undefined,
          source: pron.source ?? undefined,
        });
      }
    }

    // Map words with their pronunciations
    return wordRows.map((row) => ({
      id: row.id as WordId,
      text: row.text_en,
      level: row.level ?? undefined,
      exampleEn: row.example_en ?? undefined,
      exampleRu: row.example_ru ?? undefined,
      tags: row.tags,
      pronunciations: pronunciationsByWordId.get(row.id) ?? [],
    }));
  }
}

