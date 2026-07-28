import type {
  ArchetypeId,
  BranchingDensity,
  EndingKind,
  Format,
  ProtagonistGender,
  ProtagonistVoiceStyle,
} from './types';

/**
 * Допустимые значения полей-перечислений. Одна точка истины для трёх мест:
 * выпадающих списков формы, описаний для модели (интерполируются ниже) и
 * проверки при слиянии сгенерированного. Иначе список в промпте и список в
 * коде разъезжаются, и модель уверенно возвращает значение, которое merge
 * молча выбросит.
 */
export const FORMATS: readonly Format[] = ['single_arc', 'episodic', 'vignette'];
export const BRANCHING_DENSITIES: readonly BranchingDensity[] = ['low', 'medium', 'high'];
export const ENDING_KINDS: readonly EndingKind[] = ['good', 'normal', 'bad'];
export const PROTAGONIST_GENDERS: readonly ProtagonistGender[] = ['female', 'male', 'nonbinary', 'player_choice'];
export const PROTAGONIST_VOICE_STYLES: readonly ProtagonistVoiceStyle[] = ['neutral_minimal', 'defined'];

/**
 * Каталог полей брифа — одна точка истины для трёх потребителей:
 * поиска пустых полей (briefGaps), целевых объёмов генерации
 * (briefVerbosity) и промптов LLM (build*Request → description едет в промпт
 * как есть). Поэтому description написан для модели, а не для тултипа:
 * в нём указан и смысл поля, и язык значения.
 *
 * Язык полей неоднороден по историческим причинам: era/place/mood/themes и
 * прочие токены — латиница snake_case (они уходят в guard-ы и теги), арт-стиль
 * — английские фразы для генератора картинок, вся проза — по-русски.
 */

export type BriefFieldSpec = {
  /** Путь в брифе; у полей карточки — путь внутри карточки. */
  path: string;
  /** Смысл поля и язык значения. Идёт в промпт дословно. */
  description: string;
  /** Объём при подробности по умолчанию: слов для текста, элементов для списка. */
  baseSize: number;
  /**
   * Растёт ли поле от ползунка «подробность». false — там, где объём это не
   * многословие, а структура: размер каста, число цветов палитры, токен.
   */
  scales?: boolean;
};

/** Директива автора: что он хочет видеть в конкретном поле. */
export type BriefDirective = {
  /** Путь поля, «loveInterests» или «general». */
  target: string;
  instruction: string;
};

/** Поля брифа верхнего уровня, доступные генерации. */
export const BRIEF_FIELDS: BriefFieldSpec[] = [
  {
    path: 'format',
    description: `Формат истории. Строго одно из: ${FORMATS.join(', ')}.`,
    baseSize: 1,
    scales: false,
  },
  {
    path: 'scale.acts',
    description: 'Число актов, целое от 1 до 10. Обычно 3-4; больше — для длинных историй.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'scale.targetDurationMinutes',
    description: 'Целевая длительность прохождения в минутах, целое от 10 до 180. Короткая новелла — 20-40.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'scale.branchingDensity',
    description: `Плотность ветвления. Строго одно из: ${BRANCHING_DENSITIES.join(', ')}.`,
    baseSize: 1,
    scales: false,
  },
  {
    path: 'scale.commonRouteShare',
    description:
      'Доля игры на общем маршруте до расхождения по персонажам, дробное в [0.1, 0.9]. Больше персонажей — больше доля.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'scale.branchPointBudget',
    description: 'Число глобальных развилок сюжета, целое от 0 до 3.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'endingsProfile',
    description: `Виды концовок. Список строго из значений ${ENDING_KINDS.join(
      ', ',
    )} — какие уместны этой истории (обычно все три).`,
    baseSize: 3,
    scales: false,
  },
  {
    path: 'protagonist.gender',
    description: `Пол героя, от лица которого играют. Строго одно из: ${PROTAGONIST_GENDERS.join(
      ', ',
    )}. Должен быть совместим с кастом.`,
    baseSize: 1,
    scales: false,
  },
  {
    path: 'protagonist.voiceStyle',
    description: `Стиль внутренних монологов героя. Строго одно из: ${PROTAGONIST_VOICE_STYLES.join(
      ', ',
    )} — neutral_minimal значит герой-пустышка, в которого игрок подставляет себя.`,
    baseSize: 1,
    scales: false,
  },
  {
    path: 'world.setting.era',
    description:
      'Эпоха. Латиница snake_case, один токен: modern_day, late_1980s, post_war_1950s, near_future, victorian. Назвал автор конкретный период — закодируй именно его, а не ближайший из примеров.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'world.setting.place',
    description: 'Место действия. Латиница snake_case, одно слово-токен: university, orbital_station, seaside_town.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'world.setting.specifics',
    description: 'Конкретика мира по-русски: чем это место живёт, время года, погода, бытовые детали. Свободный текст.',
    baseSize: 12,
  },
  {
    path: 'world.tone.mood',
    description: 'Настроение истории. Латиница snake_case, одно слово-токен: bittersweet, noir, cozy.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'world.tone.themes',
    description: 'Темы истории. Список токенов латиницей snake_case: self_discovery, first_love, transitions.',
    baseSize: 3,
  },
  {
    path: 'world.tone.intensity',
    description:
      'Интенсивность тона, дробное в [0, 1]: 0 — уютно и легко, 1 — тяжёлая мелодрама. Должна отвечать mood.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'artStyle.referenceDescriptor',
    description:
      'Референс арт-стиля для генератора картинок. Английская описательная фраза: anime, soft pastels, painterly backgrounds.',
    baseSize: 6,
  },
  {
    path: 'artStyle.modelPromptTemplate',
    description:
      'Английский шаблон промпта фона. ОБЯЗАН содержать плейсхолдер {scene_focus}: soft anime painterly, pastel palette, autumnal lighting, {scene_focus}.',
    baseSize: 10,
  },
  {
    path: 'artStyle.colorPalette',
    description: 'Палитра истории: hex-цвета вида #d8c8b6, от тёмного к светлому или наоборот.',
    baseSize: 4,
    scales: false,
  },
  {
    path: 'loveInterests',
    description:
      'Каст: карточки love interest-ов, вокруг которых строятся маршруты. Персонажи должны отличаться друг от друга ролью, темпераментом и манерой речи.',
    baseSize: 3,
    scales: false,
  },
];

/**
 * Поля карточки персонажа. appearance.freeform сознательно не включён: его
 * нет в форме брифа, и сгенерированное туда автор не увидел бы.
 */
export const LI_CARD_FIELDS: BriefFieldSpec[] = [
  { path: 'name', description: 'Имя персонажа по-русски.', baseSize: 1, scales: false },
  { path: 'age', description: 'Возраст, целое число от 16 до 60.', baseSize: 1, scales: false },
  {
    path: 'roleInWorld',
    description: 'Роль в мире по-русски: чем занят, где его место в этом сеттинге.',
    baseSize: 4,
  },
  { path: 'appearance.hair', description: 'Волосы по-русски.', baseSize: 3 },
  { path: 'appearance.build', description: 'Телосложение и осанка по-русски.', baseSize: 3 },
  {
    path: 'appearance.signatureItem',
    description: 'Опознавательная деталь по-русски: вещь, по которой персонажа узнают.',
    baseSize: 3,
  },
  {
    path: 'speechPattern',
    description: 'Манера речи по-русски: темп, лексика, что в ней выдаёт характер.',
    baseSize: 5,
  },
  { path: 'personality.traits', description: 'Черты характера по-русски, по одному-два слова каждая.', baseSize: 2 },
  { path: 'personality.values', description: 'Ценности по-русски, по одному-два слова каждая.', baseSize: 2 },
  { path: 'personality.fears', description: 'Страхи по-русски, коротко.', baseSize: 1 },
  { path: 'personality.desires', description: 'Желания по-русски, коротко.', baseSize: 1 },
  {
    path: 'archetype',
    description: 'Архетип маршрута: строго один из id профилей архетипов.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'archetypeSpecifics',
    description:
      'Флэйвор архетипа: объект строго с ключами из схемы этого архетипа, значения — токены латиницей snake_case. null, если у архетипа схемы нет.',
    baseSize: 1,
    scales: false,
  },
  {
    path: 'preExistingRelationship',
    description:
      'Знакомы ли герои до начала истории: токен латиницей snake_case (antagonistic_classmate, distant_acquaintance) или null, если незнакомы.',
    baseSize: 1,
    scales: false,
  },
];

const BRIEF_FIELD_BY_PATH = new Map(BRIEF_FIELDS.map(f => [f.path, f]));
const LI_FIELD_BY_PATH = new Map(LI_CARD_FIELDS.map(f => [f.path, f]));

export function briefFieldSpec(path: string): BriefFieldSpec | undefined {
  return BRIEF_FIELD_BY_PATH.get(path);
}

export function liCardFieldSpec(field: string): BriefFieldSpec | undefined {
  return LI_FIELD_BY_PATH.get(field);
}

/** `loveInterests[kira].speechPattern` → `{ id: 'kira', field: 'speechPattern' }`. */
export function parseLiPath(path: string): { id: string; field: string } | null {
  const m = /^loveInterests\[([^\]]+)\]\.(.+)$/.exec(path);
  return m ? { id: m[1], field: m[2] } : null;
}

export function liFieldPath(id: string, field: string): string {
  return `loveInterests[${id}].${field}`;
}

/** Архетипы в промпт едут обрезанными: движковые поля модели не нужны. */
export type TrimmedArchetypeProfile = {
  id: ArchetypeId;
  description: string;
  archetypeSpecificsSchema: Record<string, { required: boolean; examples: string[] }> | null;
};
