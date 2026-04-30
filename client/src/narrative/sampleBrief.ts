import type { Brief } from './types';

/**
 * Образцовый бриф: университетская новелла, 3 LI с разными архетипами.
 * Используется как seed для UI пилота — авторские карточки на канвасе будут
 * редактировать копию этой структуры.
 */
export const SAMPLE_BRIEF: Brief = {
  version: '0.1',
  seed: null,
  genre: 'romance_vn',
  format: 'single_arc',
  scale: {
    acts: 4,
    targetDurationMinutes: 30,
    branchingDensity: 'medium',
    commonRouteShare: 0.3,
  },
  endingsProfile: ['good', 'normal', 'bad'],
  world: {
    setting: {
      era: 'modern_day',
      place: 'university',
      specifics: 'провинциальный универ, поздняя осень, дожди',
    },
    tone: {
      mood: 'bittersweet',
      themes: ['self_discovery', 'first_love', 'transitions'],
      intensity: 0.4,
    },
  },
  artStyle: {
    referenceDescriptor: 'anime, soft pastels, painterly backgrounds',
    colorPalette: ['#d8c8b6', '#a4b8a2', '#5a6b7c', '#1f2a30'],
    modelPromptTemplate: 'soft anime painterly, pastel palette, autumnal lighting, {scene_focus}',
  },
  protagonist: {
    gender: 'female',
    namePlaceholder: '{player_name}',
    voiceStyle: 'neutral_minimal',
  },
  loveInterests: [
    {
      id: 'kira',
      name: 'Кира',
      age: 22,
      roleInWorld: 'староста потока, физмат',
      appearance: {
        hair: 'тёмная коса',
        build: 'сухощавая, прямая осанка',
        signatureItem: 'очки в тонкой оправе',
      },
      speechPattern: 'формальная, резкая, редко шутит',
      personality: {
        traits: ['принципиальная', 'скрытно ранимая'],
        values: ['справедливость', 'достижения'],
        fears: ['показаться слабой'],
        desires: ['признание её усилий'],
      },
      archetype: 'enemies_to_lovers',
      archetypeSpecifics: {
        initialConflictSource: 'academic_rivalry',
      },
      preExistingRelationship: 'antagonistic_classmate',
    },
    {
      id: 'yuki',
      name: 'Юки',
      age: 21,
      roleInWorld: 'студент-литературовед, работает в кофейне',
      appearance: {
        hair: 'светлые пряди, чуть растрёпанные',
        build: 'мягкая, сутулится',
        signatureItem: 'потрёпанный шарф',
      },
      speechPattern: 'тихая, читает между строк, делает паузы',
      personality: {
        traits: ['наблюдательный', 'мечтательный'],
        values: ['искренность', 'красота момента'],
        fears: ['быть бременем'],
        desires: ['быть услышанным'],
      },
      archetype: 'slow_burn',
      archetypeSpecifics: null,
      preExistingRelationship: null,
    },
    {
      id: 'asel',
      name: 'Асель',
      age: 23,
      roleInWorld: 'аспирантка, дочь известного профессора',
      appearance: {
        hair: 'короткая стрижка',
        build: 'высокая, уверенная',
        signatureItem: 'фамильный перстень',
      },
      speechPattern: 'выверенная, дипломатичная, редкие искры тепла',
      personality: {
        traits: ['ответственная', 'тоскует по свободе'],
        values: ['семья', 'долг'],
        fears: ['разочаровать отца'],
        desires: ['прожить что-то своё'],
      },
      archetype: 'forbidden',
      archetypeSpecifics: {
        constraintType: 'family_obligation',
      },
      preExistingRelationship: 'distant_acquaintance',
    },
  ],
};
