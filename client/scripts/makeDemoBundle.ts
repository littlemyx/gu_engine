/**
 * Генератор демо-бандла v2 без обращения к LLM.
 *
 * Нужен, чтобы storylet-рантайм можно было гонять руками и в тестах, не
 * оплачивая генерацию: проза здесь рукописная и намеренно куцая, а вот
 * структура — настоящая (три персонажа с разными архетипами, лестница из трёх
 * ступеней у каждого, развилка хребта, четыре концовки). Именно структура
 * проверяет режиссёра: салиенс, брекеты тона, продолжение разговора, якоря.
 *
 * Запуск:  npx tsx scripts/makeDemoBundle.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildStoryletBundle } from '../src/narrative/buildStoryletBundle';
import { SAMPLE_BRIEF } from '../src/narrative/sampleBrief';
import { guardFromRequires } from '../src/narrative/calendarTypes';
import type { Calendar, CharacterSchedule, EventUnit, SpinePlan } from '../src/narrative/calendarTypes';
import type { DialogueUnit } from '../src/narrative/dialogueUnit';
import type { EndingVariant, WorldLocation, WorldModel } from '../src/narrative/types';
import { DEFAULT_LOCATION_MOOD, endingKey } from '../src/narrative/types';

const here = dirname(fileURLToPath(import.meta.url));

const calendar: Calendar = {
  days: 4,
  dayparts: ['утро', 'день', 'вечер'],
  slotCount: 12,
  actBoundaries: [0, 1, 2, 3],
};

const loc = (id: string, name: string, description: string, adjacent: WorldLocation['adjacent']): WorldLocation => ({
  id,
  name,
  description,
  pointsOfInterest: [],
  adjacent,
  mood: DEFAULT_LOCATION_MOOD,
  specialKind: null,
});

const worldModel: WorldModel = {
  locations: [
    loc('lecture', 'Лекционная', 'Ряды столов, запах мела. Здесь начинается день.', [
      { locationId: 'canteen', via: 'коридор' },
      { locationId: 'library', via: 'лестница' },
    ]),
    loc('canteen', 'Столовая', 'Гул голосов, звон подносов.', [{ locationId: 'yard', via: 'боковая дверь' }]),
    loc('library', 'Библиотека', 'Тишина, пахнет пылью и бумагой.', [{ locationId: 'yard', via: 'окно во двор' }]),
    loc('yard', 'Двор', 'Скамейки под липами. Отсюда видно общежитие.', [{ locationId: 'dorm', via: 'тропинка' }]),
    loc('dorm', 'Общежитие', 'Твоя комната. Чайник, стопка конспектов.', []),
  ],
  anchorLocations: {},
};

const spine: SpinePlan = {
  title: 'Семестр',
  logline: 'Четыре дня до защиты проекта. Кто окажется рядом — решаешь ты.',
  beats: [
    {
      id: 'b_start',
      kind: 'beat',
      act: 1,
      window: { fromSlot: 0, toSlot: 2 },
      locationId: 'lecture',
      participants: [],
      summary: 'Куратор объявляет: проект защищают командами. Списки — к пятнице.',
      establishes: ['project_announced'],
      guard: { all: [] },
    },
    {
      id: 'b_choice',
      kind: 'branchPoint',
      act: 2,
      window: { fromSlot: 3, toSlot: 5 },
      locationId: 'canteen',
      participants: [],
      summary: 'За столом спорят, как делить работу. Все ждут, что скажешь ты.',
      establishes: [],
      guard: guardFromRequires(['project_announced']),
      outcomes: [
        { id: 'o_fair', label: 'Поделить поровну', setsFlag: 'chose_fair', summary: 'Поровну, по-честному.' },
        { id: 'o_fast', label: 'Взять основное на себя', setsFlag: 'chose_fast', summary: 'Быстрее сделать самому.' },
      ],
    },
    {
      id: 'b_crisis',
      kind: 'beat',
      act: 3,
      window: { fromSlot: 6, toSlot: 8 },
      locationId: 'library',
      participants: [],
      summary: 'Половина расчётов не сходится. Ночь впереди длинная.',
      establishes: ['crisis'],
      guard: guardFromRequires(['project_announced']),
    },
    {
      id: 'b_fair_only',
      kind: 'beat',
      act: 3,
      window: { fromSlot: 6, toSlot: 8 },
      locationId: 'yard',
      participants: [],
      summary: 'Команда сама предлагает переделать свои куски. Ты не просил.',
      establishes: [],
      guard: guardFromRequires(['chose_fair']),
    },
    {
      id: 'b_final',
      kind: 'finale',
      act: 4,
      window: { fromSlot: 9, toSlot: 11 },
      locationId: 'lecture',
      participants: [],
      summary: 'Защита. Ты выходишь к доске — и видишь, кто пришёл тебя слушать.',
      establishes: [],
      guard: guardFromRequires(['crisis']),
    },
  ],
  endings: [
    { id: 'e_good_kira', kind: 'good', liId: 'kira', guard: guardFromRequires(['crisis']) },
    { id: 'e_good_yuki', kind: 'good', liId: 'yuki', guard: guardFromRequires(['crisis']) },
    { id: 'e_good_asel', kind: 'good', liId: 'asel', guard: guardFromRequires(['crisis']) },
    { id: 'e_bad', kind: 'bad', liId: null, guard: { all: [] } },
    { id: 'e_normal', kind: 'normal', liId: null, guard: { all: [] } },
  ],
};

/**
 * Расписание: персонаж держится одной локации ЦЕЛЫЙ день (три слота), а не
 * скачет каждую часть дня.
 *
 * Это не косметика. Бит хребта и разговор конкурируют за один слот, и бит
 * всегда выигрывает (вход в локацию проверяет созревший бит раньше хаба).
 * Если персонаж стоит в локации ровно один слот, а на него пришёлся бит, то
 * его сцена теряется навсегда — что и показал первый прогон демо: пять битов
 * сыграли, разговоров ноль. Дневные «дежурства» дают игроку запас слотов,
 * ровно как run-length расписание настоящего планировщика.
 */
const day = (a: string, b: string, c: string, d: string): string[] => [
  ...Array(3).fill(a),
  ...Array(3).fill(b),
  ...Array(3).fill(c),
  ...Array(3).fill(d),
];

const schedule: CharacterSchedule = {
  kira: day('lecture', 'library', 'yard', 'lecture'),
  yuki: day('canteen', 'yard', 'dorm', 'canteen'),
  asel: day('library', 'lecture', 'canteen', 'library'),
};

type LiSpec = { id: string; name: string; locs: [string, string, string] };
const LIS: LiSpec[] = [
  { id: 'kira', name: 'Кира', locs: ['lecture', 'library', 'yard'] },
  { id: 'yuki', name: 'Юки', locs: ['canteen', 'yard', 'dorm'] },
  { id: 'asel', name: 'Асель', locs: ['library', 'lecture', 'canteen'] },
];

/** Реплики ступени по тону — три варианта на каждую сцену. */
const LINES: Record<string, Record<number, [string, string, string]>> = {
  kira: {
    1: [
      'Списки к пятнице. У тебя есть команда?',
      'Хорошо, что ты здесь. У тебя есть команда?',
      'Опять ты. Списки к пятнице, если не забыл.',
    ],
    2: [
      'Я перепроверила твои выкладки. Там ошибка в третьем пункте.',
      'Я перепроверила твои выкладки. Хотела, чтобы у тебя всё сошлось.',
      'Я перепроверила твои выкладки. Не благодари.',
    ],
    3: [
      'Я не привыкла говорить такое вслух. Но мне важно, что ты рядом.',
      'Я не привыкла говорить такое вслух. И всё-таки — останься.',
      'Забудь. Я ничего не собиралась говорить.',
    ],
  },
  yuki: {
    1: [
      'О, привет! Возьмёшь мне кофе, если я займу тебе место?',
      'Привет! Я тебе место заняла, между прочим.',
      'А. Привет.',
    ],
    2: [
      'Я вчера полночи не спала из-за этого проекта. И из-за тебя немножко.',
      'Я вчера полночи не спала. Думала, позвонишь.',
      'Я вчера полночи не спала. Неважно.',
    ],
    3: [
      'Слушай… а после защиты — может, не расходиться?',
      'После защиты — не расходимся, договорились?',
      'После защиты, наверное, разбежимся. Как обычно.',
    ],
  },
  asel: {
    1: ['Тише. Здесь читают. Что тебе?', 'Тише — здесь читают. Садись, я подвину.', 'Тише. Здесь вообще-то читают.'],
    2: [
      'Мне нельзя с тобой видеться так часто. Ты понимаешь это?',
      'Мне нельзя с тобой видеться так часто. Но я прихожу.',
      'Нам не стоит видеться. Совсем.',
    ],
    3: [
      'Если я останусь — назад дороги не будет. Ни для кого из нас.',
      'Пусть будет, как будет. Я остаюсь.',
      'Я не приду больше. Так правильно.',
    ],
  },
};

const CHOICES: [string, string][] = [
  ['Согласиться', 'Отшутиться'],
  ['Сказать прямо', 'Промолчать'],
  ['Остаться', 'Уйти'],
];

const bracketOf = (i: number): DialogueUnit['bracket'] => (i === 0 ? 'neutral' : i === 1 ? 'positive' : 'negative');

function makeProse(li: LiSpec, stage: number): DialogueUnit[] {
  const [warmText, coldText] = CHOICES[stage - 1];
  return [0, 1, 2].map(i => ({
    id: `u_${li.id}_${stage}_${bracketOf(i)}`,
    liId: li.id,
    bracket: bracketOf(i),
    entryNodeId: 'n1',
    nodes: [
      {
        id: 'n1',
        charactersPresent: [li.id],
        characterEmotions: { [li.id]: i === 1 ? 'happy' : i === 2 ? 'sad' : 'idle' },
        narration: '',
        dialogue: [
          { speaker: li.id, emotion: i === 1 ? 'happy' : i === 2 ? 'sad' : 'idle', line: LINES[li.id][stage][i] },
        ],
        choices: [
          {
            id: `c_warm_${li.id}_${stage}_${i}`,
            kind: 'ask' as const,
            text: warmText,
            next: 'n2',
            effects: { stateDeltas: { [`relationship[${li.id}].affection`]: 0.08 }, flagSet: [], flagClear: [] },
          },
          {
            id: `c_cold_${li.id}_${stage}_${i}`,
            kind: 'farewell' as const,
            text: coldText,
            next: 'n2',
            effects: { stateDeltas: { [`relationship[${li.id}].affection`]: -0.04 }, flagSet: [], flagClear: [] },
          },
        ],
      },
      {
        id: 'n2',
        charactersPresent: [li.id],
        characterEmotions: { [li.id]: 'idle' },
        narration: 'Пауза. Разговор ещё висит в воздухе.',
        dialogue: [],
        choices: [],
        closing: true,
      },
    ],
    farewell: { narration: `${li.name} кивает на прощание и уходит.`, dialogue: [] },
  }));
}

/**
 * Филлеры — «просто поболтать». Без них лестница недостижима: ступень 2 у Киры
 * требует affection ≥ 0.475, а одна сцена ступени 1 доводит только до 0.41.
 * В настоящем пайплайне ту же дыру закрывает synthesizeCoverageFillers; здесь
 * они рукописные, но роль та же — догоняющий канал между ступенями.
 */
const FILLER_LINES: Record<string, string[]> = {
  kira: ['Ты вообще спишь когда-нибудь?', 'Здесь тихо. Мне это нужно.', 'Не мешай, я считаю.'],
  yuki: ['Смотри, что я нашла!', 'Ты когда-нибудь пробовал тут кофе? Не пробуй.', 'Скучно. Развлеки меня.'],
  asel: ['У меня десять минут. Садись.', 'Дома опять спрашивали, где я была.', 'Не здесь. Потом.'],
};

function makeFillerProse(li: LiSpec, idx: number): DialogueUnit[] {
  const line = FILLER_LINES[li.id][idx % FILLER_LINES[li.id].length];
  return [0, 1, 2].map(i => ({
    id: `f_${li.id}_${idx}_${bracketOf(i)}`,
    liId: li.id,
    bracket: bracketOf(i),
    entryNodeId: 'n1',
    nodes: [
      {
        id: 'n1',
        charactersPresent: [li.id],
        characterEmotions: { [li.id]: i === 1 ? 'happy' : i === 2 ? 'sad' : 'idle' },
        narration: '',
        dialogue: [{ speaker: li.id, emotion: i === 1 ? 'happy' : i === 2 ? 'sad' : 'idle', line }],
        choices: [
          {
            id: `fc_warm_${li.id}_${idx}_${i}`,
            kind: 'ask' as const,
            text: 'Поддержать разговор',
            next: 'n2',
            effects: { stateDeltas: { [`relationship[${li.id}].affection`]: 0.06 }, flagSet: [], flagClear: [] },
          },
          {
            id: `fc_cold_${li.id}_${idx}_${i}`,
            kind: 'farewell' as const,
            text: 'Сослаться на дела',
            next: 'n2',
            effects: { stateDeltas: { [`relationship[${li.id}].affection`]: -0.03 }, flagSet: [], flagClear: [] },
          },
        ],
      },
      {
        id: 'n2',
        charactersPresent: [li.id],
        characterEmotions: { [li.id]: 'idle' },
        narration: 'Разговор сходит на нет сам собой.',
        dialogue: [],
        choices: [],
        closing: true,
      },
    ],
  }));
}

const eventUnits: Record<string, EventUnit> = {};
const unitProse: Record<string, DialogueUnit[]> = {};

for (const li of LIS) {
  // По два филлера на каждое «дежурство» — запас разговоров, из которых
  // селектор и выбирает, когда ступень ещё закрыта порогом. Дней ЧЕТЫРЕ:
  // день без единого юнита — это мир, где не с кем говорить (расписание
  // ставит персонажей по локациям, а контента для них нет), ровно это и
  // поймал плейтест на четвёртом дне. Локация дежурства циклится по locs —
  // расписание day() четвёртым днём возвращает персонажа в locs[0].
  for (let d = 0; d < 4; d++) {
    for (let k = 0; k < 2; k++) {
      const idx = d * 2 + k;
      const id = `f_${li.id}_${idx}`;
      eventUnits[id] = {
        id,
        kind: 'dialogue',
        at: { slot: { fromSlot: d * 3, toSlot: Math.min(11, d * 3 + 2) }, locationId: li.locs[d % 3] },
        participants: [li.id],
        guard: { all: [] },
        effects: [],
        scene: { kind: 'dialogue', anchorId: id, liId: li.id },
        priority: 40,
        goal: `болтовня с ${li.name}`,
        source: 'filler',
      };
      unitProse[id] = makeFillerProse(li, idx);
    }
  }

  for (let stage = 1; stage <= 3; stage++) {
    const id = `u_${li.id}_${stage}`;
    eventUnits[id] = {
      id,
      kind: 'dialogue',
      // Окна ступеней перекрываются: продолжение разговора возможно внутри
      // одной посиделки, а не «следующая ступень — следующий день».
      at: {
        slot: { fromSlot: (stage - 1) * 3, toSlot: Math.min(11, stage * 3 + 2) },
        locationId: li.locs[stage - 1],
      },
      participants: [li.id],
      guard: stage === 1 ? { all: [] } : { all: [{ fired: `u_${li.id}_${stage - 1}` }] },
      effects: [{ setFlag: `${li.id}_stage${stage}` }],
      scene: { kind: 'dialogue', anchorId: id, liId: li.id },
      priority: 20,
      goal: `ступень ${stage} линии ${li.name}`,
      arcStage: stage,
      source: 'agenda',
    };
    unitProse[id] = makeProse(li, stage);
  }
}

const ending = (kind: EndingVariant['kind'], liId: string | null, text: string): EndingVariant => ({
  kind,
  liId,
  scenes: [{ id: '', narration: text }],
});

const endings: Record<string, EndingVariant> = {
  [endingKey('good', 'kira')]: ending(
    'good',
    'kira',
    'Кира ждёт тебя у доски. «Я знала, что ты справишься», — говорит она, и впервые не отводит взгляд.',
  ),
  [endingKey('good', 'yuki')]: ending(
    'good',
    'yuki',
    'Юки машет тебе с последнего ряда так, что видит весь поток. Ей всё равно, кто смотрит.',
  ),
  [endingKey('good', 'asel')]: ending(
    'good',
    'asel',
    'Асель стоит в дверях. Она не входит — но и не уходит, пока ты не заканчиваешь.',
  ),
  [endingKey('bad')]: ending(
    'bad',
    null,
    'Ты защищаешься в полупустой аудитории. Проект приняли. Больше в этот день не случилось ничего.',
  ),
  [endingKey('normal')]: ending(
    'normal',
    null,
    'Защита прошла. Кто-то хлопнул тебя по плечу, кто-то уже собирал сумку. Семестр кончился.',
  ),
};

const { bundle, stats } = buildStoryletBundle(
  SAMPLE_BRIEF,
  spine,
  calendar,
  schedule,
  worldModel,
  {},
  unitProse,
  eventUnits,
  endings,
  {},
  {},
  undefined,
  { tagMap: { home: ['dorm'] } },
);

const out = resolve(here, '../../game/fixtures/demo-storylet.gu.json');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(bundle, null, 2), 'utf8');

// eslint-disable-next-line no-console
console.log(`демо-бандл записан: ${out}`);
// eslint-disable-next-line no-console
console.log(stats);
