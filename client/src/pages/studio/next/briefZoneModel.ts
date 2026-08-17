import { computeBriefGaps, isEmptyValue, readBriefPath } from '@/narrative/briefGaps';
import { validateBrief } from '@/narrative/validateBrief';

import type { Brief } from '@/narrative/types';
import type { BriefFieldCardState } from '@/ui/kit/molecules/BriefFieldCard';
import type { ReadinessRowState } from '@/ui/kit/molecules/ReadinessRow';

/**
 * Модель бриф-половины зоны «Замысел»: поля брифа, сгруппированные в карточки,
 * и чек-лист готовности зоны.
 *
 * Карточка — единица внимания, а не поля: автор думает «сеттинг», а не
 * «world.setting.era». Пути каждой группы — из каталога briefFields, поэтому
 * счётчик пробелов у карточек и у генератора один и тот же (computeBriefGaps).
 */

export type BriefCardId = 'setting' | 'tone' | 'format' | 'branching' | 'protagonist' | 'artstyle' | 'cast';

export interface BriefZoneCard {
  id: BriefCardId;
  kicker: string;
  state: BriefFieldCardState;
  /** Сводка заполненных полей группы одной строкой. */
  value: string;
  hint: string;
}

export interface ReadinessItem {
  text: string;
  state: ReadinessRowState;
}

export interface BriefZoneModel {
  cards: BriefZoneCard[];
  readiness: ReadinessItem[];
  /** Пустых полей по каталогу — та же цифра, что видит генератор брифа. */
  gapCount: number;
  /** Ошибок валидации нет — «Продолжить конвейер» бриф не задержит. */
  briefReady: boolean;
}

interface CardDef {
  id: BriefCardId;
  kicker: string;
  /** Имя строчными для чек-листа: «сеттинг · заполняется…». */
  name: string;
  paths: string[];
  hint: string;
}

const CARDS: CardDef[] = [
  {
    id: 'setting',
    kicker: 'СЕТТИНГ',
    name: 'сеттинг',
    paths: ['world.setting.era', 'world.setting.place', 'world.setting.specifics'],
    hint: 'эпоха и место — токены, конкретика мира — свободным текстом',
  },
  {
    id: 'tone',
    kicker: 'ТОН И ТЕМЫ',
    name: 'тон и темы',
    paths: ['world.tone.mood', 'world.tone.themes', 'world.tone.intensity'],
    hint: 'настроение и темы истории; интенсивность — от уютного к тяжёлому',
  },
  {
    id: 'format',
    kicker: 'ФОРМАТ И ГАБАРИТЫ',
    name: 'формат и габариты',
    paths: ['format', 'scale.acts', 'scale.targetDurationMinutes'],
    hint: 'пусто — «авто»: габариты выберет генератор',
  },
  {
    id: 'branching',
    kicker: 'ВЕТВЛЕНИЕ И КОНЦОВКИ',
    name: 'ветвление и концовки',
    paths: ['scale.branchingDensity', 'scale.branchPointBudget', 'scale.commonRouteShare', 'endingsProfile'],
    hint: 'структурные числа: их читает солвер, а не проза',
  },
  {
    id: 'protagonist',
    kicker: 'ПРОТАГОНИСТ',
    name: 'протагонист',
    paths: ['protagonist.gender', 'protagonist.voiceStyle'],
    hint: 'герой-пустышка или очерченный голос — от лица кого играют',
  },
  {
    id: 'artstyle',
    kicker: 'АРТ-СТИЛЬ',
    name: 'арт-стиль',
    paths: ['artStyle.referenceDescriptor', 'artStyle.modelPromptTemplate', 'artStyle.colorPalette'],
    hint: 'референс и шаблон промпта — по-английски, для генератора картинок',
  },
  {
    id: 'cast',
    kicker: 'КАСТ · LI',
    name: 'каст',
    paths: ['loveInterests'],
    hint: 'карточки персонажей; роли закрываются на кастинг-столе ниже',
  },
];

/**
 * Поля, где «пусто» значит «авто»: null выберет генератор, а до него —
 * resolveBrief. Пустая группа таких полей — состояние «авто», а не «пусто».
 */
const AUTO_PATHS = new Set([
  'format',
  'scale.acts',
  'scale.targetDurationMinutes',
  'scale.branchingDensity',
  'scale.commonRouteShare',
  'scale.branchPointBudget',
  'endingsProfile',
  'protagonist.gender',
  'protagonist.voiceStyle',
  'world.tone.intensity',
]);

function truncate(s: string, n: number): string {
  return s.length <= n ? s : `${s.slice(0, n - 1)}…`;
}

function show(value: unknown): string {
  if (isEmptyValue(value)) return '';
  if (Array.isArray(value)) return value.join(', ');
  return String(value);
}

function cardValue(def: CardDef, brief: Brief): string {
  if (def.id === 'cast') {
    return truncate(brief.loveInterests.map(li => li.name.trim() || 'без имени').join(' · '), 96);
  }
  const parts = def.paths.map(p => show(readBriefPath(brief, p))).filter(Boolean);
  return truncate(parts.join(' · '), 96);
}

function cardState(def: CardDef, brief: Brief, gaps: string[], generating: boolean): BriefFieldCardState {
  // Каст в списке пробелов живёт и как `loveInterests` (пустой), и как
  // `loveInterests[id].поле` (недозаполненная карточка) — оба значат «генератор
  // сюда пишет».
  const gapped =
    def.id === 'cast' ? gaps.some(g => g.startsWith('loveInterests')) : def.paths.some(p => gaps.includes(p));
  if (generating && gapped) return 'filling';

  const allEmpty = def.paths.every(p => isEmptyValue(readBriefPath(brief, p)));
  if (allEmpty) return def.paths.every(p => AUTO_PATHS.has(p)) ? 'auto' : 'empty';
  return 'done';
}

/** Ошибки брифа; на полупустом брифе валидатор не должен ронять зону. */
function briefErrors(brief: Brief): string[] {
  try {
    return validateBrief(brief)
      .filter(i => i.severity === 'error')
      .map(i => i.message);
  } catch {
    return ['бриф заполнен не до конца'];
  }
}

export interface BriefZoneInput {
  brief: Brief;
  /** Идёт генерация брифа: карточки с пробелами показываются «заполняется». */
  generating: boolean;
}

export function deriveBriefZone({ brief, generating }: BriefZoneInput): BriefZoneModel {
  const gaps = computeBriefGaps(brief);

  const cards: BriefZoneCard[] = CARDS.map(def => ({
    id: def.id,
    kicker: def.kicker,
    state: cardState(def, brief, gaps, generating),
    value: cardValue(def, brief),
    hint: def.hint,
  }));

  const readiness: ReadinessItem[] = cards.map(card => {
    const name = CARDS.find(d => d.id === card.id)?.name ?? card.id;
    if (card.state === 'filling') return { text: `${name} · заполняется…`, state: 'waiting' };
    if (card.state === 'auto') return { text: `${name} · авто, решит генератор`, state: 'waiting' };
    if (card.state === 'empty') return { text: name, state: 'waiting' };
    return { text: `${name} · ${truncate(card.value, 36)}`, state: 'done' };
  });

  const errors = briefErrors(brief);
  for (const message of errors) readiness.push({ text: message, state: 'problem' });

  return { cards, readiness, gapCount: gaps.length, briefReady: errors.length === 0 };
}
