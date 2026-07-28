import { describe, expect, it } from 'vitest';

import { computeBriefGaps } from './briefGaps';
import { blankBrief as blank } from './briefStore';
import { newLoveInterest } from './loveInterestCard';
import { mergeGeneratedBrief } from './mergeGeneratedBrief';
import { SAMPLE_BRIEF } from './sampleBrief';

describe('mergeGeneratedBrief — поля мира и стиля', () => {
  it('заполняет пустые поля из patch', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(
      brief,
      {
        world: { setting: { era: 'near_future' }, tone: { mood: 'noir', themes: ['isolation', 'trust'] } },
        artStyle: { colorPalette: ['#1c2230', '#8fa3b8'] },
      },
      computeBriefGaps(brief),
    );

    expect(merged.world.setting.era).toBe('near_future');
    expect(merged.world.tone.mood).toBe('noir');
    expect(merged.world.tone.themes).toEqual(['isolation', 'trust']);
    expect(merged.artStyle.colorPalette).toEqual(['#1c2230', '#8fa3b8']);
  });

  it('не трогает заполненное автором, даже если patch это перезаписывает', () => {
    const merged = mergeGeneratedBrief(
      SAMPLE_BRIEF,
      { world: { setting: { era: 'near_future', place: 'orbital_station' } } },
      computeBriefGaps(SAMPLE_BRIEF),
    );

    expect(merged.world.setting.era).toBe(SAMPLE_BRIEF.world.setting.era);
    expect(merged.world.setting.place).toBe(SAMPLE_BRIEF.world.setting.place);
  });

  it('игнорирует поля вне gaps — модель, вернувшая бриф целиком, ничего не ломает', () => {
    const brief = blank();
    // gaps собраны до того, как автор вписал настроение руками.
    const gaps = computeBriefGaps(brief).filter(g => g !== 'world.tone.mood' && g !== 'scale.acts');
    const edited = { ...brief, world: { ...brief.world, tone: { ...brief.world.tone, mood: 'cozy' } } };

    const merged = mergeGeneratedBrief(edited, { world: { tone: { mood: 'noir' } }, scale: { acts: 9 } }, gaps);

    expect(merged.world.tone.mood).toBe('cozy');
    expect(merged.scale.acts).toBeNull();
  });

  it('не трогает габариты, которые автор задал руками', () => {
    const brief = { ...blank(), scale: { ...blank().scale, acts: 6, targetDurationMinutes: 90 } };
    const merged = mergeGeneratedBrief(
      brief,
      { scale: { acts: 3, targetDurationMinutes: 20, commonRouteShare: 0.5 } },
      computeBriefGaps(brief),
    );

    expect(merged.scale.acts).toBe(6);
    expect(merged.scale.targetDurationMinutes).toBe(90);
    // А вот «авто»-поле генератор заполнить вправе.
    expect(merged.scale.commonRouteShare).toBe(0.5);
  });

  it('отбрасывает мусор вместо значений', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(
      brief,
      {
        world: { setting: { era: '   ' }, tone: { themes: [] } },
        artStyle: { colorPalette: ['не цвет', '#1c2230'] },
      },
      computeBriefGaps(brief),
    );

    expect(merged.world.setting.era).toBe('');
    expect(merged.world.tone.themes).toEqual([]);
    expect(merged.artStyle.colorPalette).toEqual(['#1c2230']);
  });
});

describe('mergeGeneratedBrief — габариты и перечисления', () => {
  it('заполняет габариты, формат, концовки и протагониста', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(
      brief,
      {
        format: 'episodic',
        scale: {
          acts: 3,
          targetDurationMinutes: 45,
          branchingDensity: 'high',
          commonRouteShare: 0.4,
          branchPointBudget: 1,
        },
        endingsProfile: ['good', 'bad'],
        world: { tone: { intensity: 0.8 } },
        protagonist: { gender: 'player_choice', voiceStyle: 'defined' },
      },
      computeBriefGaps(brief),
    );

    expect(merged.format).toBe('episodic');
    expect(merged.scale).toMatchObject({
      acts: 3,
      targetDurationMinutes: 45,
      branchingDensity: 'high',
      commonRouteShare: 0.4,
      branchPointBudget: 1,
    });
    expect(merged.endingsProfile).toEqual(['good', 'bad']);
    expect(merged.world.tone.intensity).toBe(0.8);
    expect(merged.protagonist).toMatchObject({ gender: 'player_choice', voiceStyle: 'defined' });
  });

  it('значение вне списка допустимых не пишется — поле остаётся «авто»', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(
      brief,
      {
        format: 'интерактивный_сериал',
        scale: { branchingDensity: 'экстремальная' },
        protagonist: { gender: 'робот' },
        endingsProfile: ['good', 'катастрофическая'],
      },
      computeBriefGaps(brief),
    );

    expect(merged.format).toBeNull();
    expect(merged.scale.branchingDensity).toBeNull();
    expect(merged.protagonist.gender).toBeNull();
    // Из списка выживает только то, что модель назвала верно.
    expect(merged.endingsProfile).toEqual(['good']);
  });

  it('числа зажимаются в допустимый диапазон, а не пишутся как есть', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(
      brief,
      {
        scale: { acts: 99, targetDurationMinutes: 3, commonRouteShare: 5, branchPointBudget: -2 },
        world: { tone: { intensity: 7 } },
      },
      computeBriefGaps(brief),
    );

    expect(merged.scale.acts).toBe(10);
    expect(merged.scale.targetDurationMinutes).toBe(10);
    expect(merged.scale.commonRouteShare).toBe(0.9);
    expect(merged.scale.branchPointBudget).toBe(0);
    expect(merged.world.tone.intensity).toBe(1);
  });
});

describe('mergeGeneratedBrief — каст', () => {
  const generatedCard = {
    name: 'Рин',
    age: 27,
    roleInWorld: 'механик доковой смены',
    appearance: { hair: 'короткие тёмные', build: 'жилистая', signatureItem: 'налобный фонарь' },
    speechPattern: 'короткие фразы, длинные паузы',
    personality: { traits: ['замкнутая'], values: ['надёжность'], fears: ['одиночество'], desires: ['остаться'] },
    archetype: 'slow_burn',
    archetypeSpecifics: null,
    preExistingRelationship: null,
  };

  it('собирает карточки с нуля и выдаёт им свежие id', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(
      brief,
      { loveInterests: [generatedCard, { ...generatedCard, name: 'Кай', archetype: 'forbidden' }] },
      computeBriefGaps(brief),
    );

    expect(merged.loveInterests).toHaveLength(2);
    expect(merged.loveInterests[0].name).toBe('Рин');
    // id придумывает редактор: модель их не присылает, а если пришлёт — не её дело.
    expect(merged.loveInterests[0].id).toMatch(/^li_/);
    expect(merged.loveInterests[0].id).not.toBe(merged.loveInterests[1].id);
  });

  it('карточку с неизвестным архетипом отбрасывает целиком', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(
      brief,
      { loveInterests: [{ ...generatedCard, archetype: 'вампир_из_ниоткуда' }, generatedCard] },
      computeBriefGaps(brief),
    );

    expect(merged.loveInterests).toHaveLength(1);
    expect(merged.loveInterests[0].archetype).toBe('slow_burn');
  });

  it('специфику фильтрует по схеме архетипа', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(
      brief,
      {
        loveInterests: [
          {
            ...generatedCard,
            archetype: 'forbidden',
            archetypeSpecifics: { constraintType: 'family_obligation', выдуманное: 'поле' },
          },
        ],
      },
      computeBriefGaps(brief),
    );

    expect(merged.loveInterests[0].archetypeSpecifics).toEqual({ constraintType: 'family_obligation' });
  });

  it('в существующей карточке дозаполняет только пустые поля', () => {
    const card = { ...newLoveInterest('slow_burn'), name: 'Юки' };
    const brief = { ...blank(), loveInterests: [card] };
    const merged = mergeGeneratedBrief(
      brief,
      { loveInterests: [{ id: card.id, name: 'Рин', speechPattern: 'тихая, с паузами' }] },
      computeBriefGaps(brief),
    );

    expect(merged.loveInterests[0].name).toBe('Юки');
    expect(merged.loveInterests[0].speechPattern).toBe('тихая, с паузами');
    // Карточка та же — id не переписывается.
    expect(merged.loveInterests[0].id).toBe(card.id);
  });

  it('карточку без совпадения по id оставляет как есть', () => {
    const card = newLoveInterest('slow_burn');
    const brief = { ...blank(), loveInterests: [card] };
    const merged = mergeGeneratedBrief(
      brief,
      { loveInterests: [{ id: 'чужой', name: 'Рин' }] },
      computeBriefGaps(brief),
    );

    expect(merged.loveInterests[0]).toEqual(card);
  });

  it('пустой каст сохраняется, если из patch не удалось собрать ни одной карточки', () => {
    const brief = blank();
    const merged = mergeGeneratedBrief(brief, { loveInterests: ['мусор'] }, computeBriefGaps(brief));

    expect(merged.loveInterests).toEqual([]);
  });
});
