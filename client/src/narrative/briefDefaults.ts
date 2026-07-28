import type {
  BranchingDensity,
  Brief,
  BriefScale,
  EndingKind,
  Format,
  ProtagonistGender,
  ProtagonistVoiceStyle,
  WorldSetting,
} from './types';

/**
 * «Авто» в брифе — это null: автор габарит не задал, его выбирает генератор.
 * Но пайплайну нужны числа, а не null, поэтому между авторским вводом и
 * потребителями стоит один шов — resolveBrief().
 *
 * Почему шов, а не nullable-типы насквозь: acts и targetDurationMinutes уходят
 * в арифметику (computeCalendarTargets, actWeights, оценка стоимости) в добром
 * десятке мест. Протащить null туда — значит рассыпать `?? 4` по всему
 * пайплайну и однажды забыть про одно место. Здесь же null физически не может
 * пройти дальше: тип ResolvedBrief его не содержит.
 *
 * Значения дефолтов — ровно те, что стояли в брифе до появления «авто», чтобы
 * поведение старых проектов не поехало.
 */

export const BRIEF_DEFAULTS = {
  format: 'single_arc' as Format,
  acts: 4,
  targetDurationMinutes: 30,
  branchingDensity: 'medium' as BranchingDensity,
  commonRouteShare: 0.3,
  branchPointBudget: 2,
  intensity: 0.4,
  gender: 'female' as ProtagonistGender,
  voiceStyle: 'neutral_minimal' as ProtagonistVoiceStyle,
  endingsProfile: ['good', 'normal', 'bad'] as EndingKind[],
};

/** Габариты без «авто». */
export type ResolvedScale = {
  acts: number;
  targetDurationMinutes: number;
  branchingDensity: BranchingDensity;
  commonRouteShare: number;
  branchPointBudget: number;
};

/**
 * Большинству потребителей нужны только габариты, а не весь бриф. Отдельная
 * функция для них — чтобы зависимость была честной: незачем требовать целый
 * валидный Brief там, где считают число актов.
 */
export function resolveScale(scale: BriefScale): ResolvedScale {
  return {
    acts: scale.acts ?? BRIEF_DEFAULTS.acts,
    targetDurationMinutes: scale.targetDurationMinutes ?? BRIEF_DEFAULTS.targetDurationMinutes,
    branchingDensity: scale.branchingDensity ?? BRIEF_DEFAULTS.branchingDensity,
    commonRouteShare: scale.commonRouteShare ?? BRIEF_DEFAULTS.commonRouteShare,
    branchPointBudget: scale.branchPointBudget ?? BRIEF_DEFAULTS.branchPointBudget,
  };
}

/** Бриф, в котором «авто» уже разрешено в конкретные значения. */
export type ResolvedBrief = Omit<Brief, 'format' | 'scale' | 'world' | 'protagonist'> & {
  format: Format;
  scale: ResolvedScale;
  world: {
    setting: WorldSetting;
    tone: { mood: string; themes: string[]; intensity: number };
  };
  protagonist: {
    gender: ProtagonistGender;
    namePlaceholder: string;
    voiceStyle: ProtagonistVoiceStyle;
  };
};

export function resolveBrief(brief: Brief): ResolvedBrief {
  const { world, protagonist } = brief;
  return {
    ...brief,
    format: brief.format ?? BRIEF_DEFAULTS.format,
    scale: resolveScale(brief.scale),
    world: {
      setting: world.setting,
      tone: {
        mood: world.tone.mood,
        themes: world.tone.themes,
        intensity: world.tone.intensity ?? BRIEF_DEFAULTS.intensity,
      },
    },
    protagonist: {
      gender: protagonist.gender ?? BRIEF_DEFAULTS.gender,
      namePlaceholder: protagonist.namePlaceholder,
      voiceStyle: protagonist.voiceStyle ?? BRIEF_DEFAULTS.voiceStyle,
    },
    endingsProfile: brief.endingsProfile.length > 0 ? brief.endingsProfile : BRIEF_DEFAULTS.endingsProfile,
  };
}
