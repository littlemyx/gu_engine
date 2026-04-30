import type { ArchetypeId, ArchetypeProfile } from './types';

/**
 * Библиотека архетипов маршрутов LI для пилота romance_vn.
 *
 * Каждый архетип — это поведенческий профиль, не описание. Поля имеют
 * конкретных потребителей в пайплайне:
 *
 *   initialState           -> branch-генератор использует при li_introduction / route_opening
 *   additionalStateVars    -> outline-генератор расширяет state-схему игры
 *   trajectory             -> валидатор проверяет распределение эффектов на маршруте
 *   requiredBeats          -> outline-генератор обязан сгенерировать эти якоря
 *   obstacleThemes         -> попадают в промпт branch-генератора в obstacle_reveal сегменте
 *   endingProfile.weight   -> определяет вероятность ending-а при пограничном state
 */

export const ARCHETYPES: Record<ArchetypeId, ArchetypeProfile> = {
  // ────────────────────────────────────────────────────────────────────────
  slow_burn: {
    id: 'slow_burn',
    description: 'Постепенное сближение без резких поворотов. Конфликт внутренний, обстоятельства тихие.',
    initialState: {
      affection: [0.1, 0.3],
      trust: [0.2, 0.4],
      tension: [0.1, 0.3],
    },
    additionalStateVars: null,
    trajectory: {
      shape: 'monotone_gradual',
      vars: {
        affection: 'monotone_increase',
        trust: 'monotone_increase',
        tension: 'stable_low',
      },
      maxPerSceneDelta: 0.08,
    },
    requiredBeats: [
      {
        type: 'accumulation_moment',
        position: 'after_obstacle_reveal',
        purpose: 'малый, но важный жест, после которого ощущается смещение в отношениях',
      },
      {
        type: 'subtle_realization',
        position: 'before_crisis',
        purpose: 'тихое осознание протагониста, что чувства серьёзны',
      },
    ],
    obstacleType: 'internal',
    obstacleThemes: ['нерешительность', 'недопонимание', 'страх разрушить дружбу'],
    endingProfile: {
      good: { weight: 0.6, tone: 'тёплая определённость' },
      normal: { weight: 0.3, tone: 'недосказанность с надеждой' },
      bad: { weight: 0.1, tone: 'упущенный момент' },
    },
    archetypeSpecificsSchema: null,
  },

  // ────────────────────────────────────────────────────────────────────────
  enemies_to_lovers: {
    id: 'enemies_to_lovers',
    description: 'Высокое стартовое напряжение, конверсия в близость через момент перелома.',
    initialState: {
      affection: [0.0, 0.2],
      trust: [0.0, 0.3],
      tension: [0.6, 0.9],
    },
    additionalStateVars: null,
    trajectory: {
      shape: 'tension_to_affection_pivot',
      vars: {
        affection: 'stagnant_then_jump',
        trust: 'monotone_increase_after_pivot',
        tension: 'high_then_drop_after_pivot',
      },
      pivotBeat: 'tension_flip',
    },
    requiredBeats: [
      {
        type: 'tension_flip',
        position: 'after_obstacle_reveal',
        purpose: 'конфликт обнажает уязвимость; tension резко падает, affection стартует',
      },
      {
        type: 'honest_confrontation',
        position: 'before_crisis',
        purpose: 'признание прошлой неправоты с одной или обеих сторон',
      },
    ],
    obstacleType: 'interpersonal',
    obstacleThemes: ['прошлая обида', 'предубеждение', 'соперничество'],
    endingProfile: {
      good: { weight: 0.5, tone: 'осознание с теплом' },
      normal: { weight: 0.3, tone: 'перемирие без полного сближения' },
      bad: { weight: 0.2, tone: 'возврат к враждебности' },
    },
    archetypeSpecificsSchema: {
      initialConflictSource: {
        required: true,
        examples: ['academic_rivalry', 'old_grudge', 'ideological_clash', 'class_difference'],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  forbidden: {
    id: 'forbidden',
    description: 'Взаимный интерес есть сразу, но внешнее обстоятельство мешает. Вся арка — давление vs выбор.',
    initialState: {
      affection: [0.4, 0.6],
      trust: [0.5, 0.8],
      tension: [0.3, 0.5],
    },
    additionalStateVars: {
      external_pressure: {
        range: [0.0, 1.0],
        default: 0.6,
        description:
          'сила внешнего препятствия (статус, семья, обязательство). Стартовое значение зависит от constraintType.',
      },
    },
    trajectory: {
      shape: 'growth_against_constraint',
      vars: {
        affection: 'monotone_increase',
        trust: 'monotone_increase',
        external_pressure: 'stable_or_increase',
        tension: 'increase_then_resolve_at_crisis',
      },
    },
    requiredBeats: [
      {
        type: 'constraint_revealed',
        position: 'obstacle_reveal',
        purpose: 'озвучивание препятствия; до этого казалось, что просто несовместимы',
      },
      {
        type: 'constraint_test',
        position: 'before_crisis',
        purpose: 'ситуация, в которой давление требует определённого решения',
      },
    ],
    obstacleType: 'external',
    obstacleThemes: ['разница в статусе', 'семейный долг', 'помолвка с другим', 'профессиональная этика'],
    endingProfile: {
      good: { weight: 0.4, tone: 'преодоление с потерей' },
      normal: {
        weight: 0.3,
        tone: 'тайные отношения без публичного разрешения',
      },
      bad: { weight: 0.3, tone: 'давление победило, расставание' },
    },
    archetypeSpecificsSchema: {
      constraintType: {
        required: true,
        examples: [
          'social_status',
          'family_obligation',
          'engagement_to_other',
          'secret_identity',
          'professional_ethics',
        ],
      },
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  mutual_pining: {
    id: 'mutual_pining',
    description: 'Оба тайно влюблены с начала, но не могут признаться. Арка — путь к признанию.',
    initialState: {
      affection: [0.5, 0.7],
      trust: [0.5, 0.7],
      tension: [0.2, 0.4],
    },
    additionalStateVars: {
      expressed_affection: {
        range: [0.0, 1.0],
        default: 0.0,
        description: 'степень, в которой чувства озвучены и признаны открыто',
      },
    },
    trajectory: {
      shape: 'delayed_mutual_acknowledgment',
      vars: {
        affection: 'stable_high',
        expressed_affection: 'stagnant_then_late_jump',
        tension: 'slow_increase_until_crisis',
      },
      pivotBeat: 'almost_confession',
    },
    requiredBeats: [
      {
        type: 'missed_signal',
        position: 'after_obstacle_reveal',
        purpose: 'сигнал от LI неправильно прочитан, страх признания усиливается',
      },
      {
        type: 'almost_confession',
        position: 'before_crisis',
        purpose: 'почти-признание, оборванное обстоятельством',
      },
    ],
    obstacleType: 'internal',
    obstacleThemes: ['страх отказа', 'иллюзия безответности', 'боязнь разрушить дружбу'],
    endingProfile: {
      good: { weight: 0.55, tone: 'взаимное освобождение' },
      normal: { weight: 0.3, tone: 'признание без ответа на этом этапе' },
      bad: { weight: 0.15, tone: 'невысказанное остаётся невысказанным' },
    },
    archetypeSpecificsSchema: null,
  },
};

export const ARCHETYPE_IDS: ArchetypeId[] = ['slow_burn', 'enemies_to_lovers', 'forbidden', 'mutual_pining'];

export function getArchetype(id: ArchetypeId): ArchetypeProfile {
  const profile = ARCHETYPES[id];
  if (!profile) {
    throw new Error(`Unknown archetype: ${id}`);
  }
  return profile;
}
