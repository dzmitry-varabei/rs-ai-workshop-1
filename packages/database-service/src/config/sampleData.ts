/**
 * Sample Data for Development and Testing
 * 
 * Creates sample words for in-memory storage backend.
 */

import type { Word } from '@english-learning/domain';

export function createSampleWords(): Word[] {
  return [
    {
      id: 'word-1' as any,
      text: 'hello',
      level: 'A1',
      exampleEn: 'Hello, how are you?',
      exampleRu: 'Привет, как дела?',
      tags: ['greeting', 'basic'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/həˈloʊ/',
          audioUrl: 'https://example.com/hello.mp3',
        },
      ],
    },
    {
      id: 'word-2' as any,
      text: 'goodbye',
      level: 'A1',
      exampleEn: 'Goodbye, see you later!',
      exampleRu: 'До свидания, увидимся позже!',
      tags: ['greeting', 'basic'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/ɡʊdˈbaɪ/',
        },
      ],
    },
    {
      id: 'word-3' as any,
      text: 'beautiful',
      level: 'B1',
      exampleEn: 'The sunset is beautiful.',
      exampleRu: 'Закат прекрасен.',
      tags: ['adjective', 'description'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/ˈbjuːtɪfəl/',
        },
      ],
    },
    {
      id: 'word-4' as any,
      text: 'understand',
      level: 'A2',
      exampleEn: 'Do you understand the question?',
      exampleRu: 'Ты понимаешь вопрос?',
      tags: ['verb', 'communication'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/ˌʌndərˈstænd/',
        },
      ],
    },
    {
      id: 'word-5' as any,
      text: 'important',
      level: 'B1',
      exampleEn: 'This is very important information.',
      exampleRu: 'Это очень важная информация.',
      tags: ['adjective', 'emphasis'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/ɪmˈpɔːrtənt/',
        },
      ],
    },
    {
      id: 'word-6' as any,
      text: 'computer',
      level: 'A2',
      exampleEn: 'I work on my computer every day.',
      exampleRu: 'Я работаю на компьютере каждый день.',
      tags: ['noun', 'technology'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/kəmˈpjuːtər/',
        },
      ],
    },
    {
      id: 'word-7' as any,
      text: 'learning',
      level: 'A2',
      exampleEn: 'Learning English is fun!',
      exampleRu: 'Изучение английского - это весело!',
      tags: ['noun', 'education'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/ˈlɜːrnɪŋ/',
        },
      ],
    },
    {
      id: 'word-8' as any,
      text: 'experience',
      level: 'B2',
      exampleEn: 'She has a lot of experience in teaching.',
      exampleRu: 'У неё большой опыт в преподавании.',
      tags: ['noun', 'professional'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/ɪkˈspɪriəns/',
        },
      ],
    },
    {
      id: 'word-9' as any,
      text: 'development',
      level: 'B2',
      exampleEn: 'Software development requires patience.',
      exampleRu: 'Разработка программного обеспечения требует терпения.',
      tags: ['noun', 'professional', 'technology'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/dɪˈveləpmənt/',
        },
      ],
    },
    {
      id: 'word-10' as any,
      text: 'knowledge',
      level: 'B1',
      exampleEn: 'Knowledge is power.',
      exampleRu: 'Знание - сила.',
      tags: ['noun', 'education', 'abstract'],
      pronunciations: [
        {
          locale: 'en-US',
          ipa: '/ˈnɑːlɪdʒ/',
        },
      ],
    },
  ];
}