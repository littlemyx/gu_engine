import type { ArtifactStage } from '@/artifacts/types';

/**
 * Зоны конвейера — крупные шаги, которыми автор мыслит работу над историей.
 *
 * Зона не то же самое, что стадия: стадия — единица генерации, зона — единица
 * внимания. В зоне «Замысел» три стадии (бриф, каст, мир), но автор занят там
 * одним делом, и показывать ему три отдельных экрана незачем.
 *
 * Наверху всегда одна зона — текущая; весь конвейер целиком живёт во вкладке
 * «Пайплайн» нижней панели.
 */

export type ZoneId = 'idea' | 'structure' | 'prose' | 'media' | 'preview' | 'qa' | 'release';

export interface Zone {
  id: ZoneId;
  /** Номер, которым зона названа в интерфейсе: «0 · Замысел». */
  n: number;
  ru: string;
  /** Стадии, за которые зона отвечает. */
  stages: ArtifactStage[];
  /** Одной строкой: что автор здесь делает. */
  hint: string;
}

export const ZONES: Zone[] = [
  {
    id: 'idea',
    n: 0,
    ru: 'Замысел',
    stages: ['brief', 'cast', 'world'],
    hint: 'бриф, кастинг ролей, мир истории',
  },
  {
    id: 'structure',
    n: 1,
    ru: 'Структура',
    stages: ['calendar', 'spine', 'schedule'],
    hint: 'каркас собирается бесплатно — правьте, пока не сойдётся',
  },
  {
    // Замысел называет эту зону «Генерация», хотя по сути это проза: имя взято
    // из макета, потому что оно стоит в переключателе зоны у автора перед глазами.
    id: 'prose',
    n: 2,
    ru: 'Генерация',
    stages: ['beat_prose', 'anchor_transitions', 'event_pool', 'dialogue_units', 'ending_prose'],
    hint: 'самая дорогая зона: порции, чекпоинты, раши',
  },
  {
    id: 'media',
    n: 3,
    ru: 'Медиа',
    stages: ['image', 'audio'],
    hint: 'фоны, спрайты и звук — дорожками, параллельно',
  },
  {
    // Превью не производит артефактов: это взгляд на историю, а не шаг сборки.
    id: 'preview',
    n: 4,
    ru: 'Превью',
    stages: [],
    hint: 'играть прямо в редакторе, на том же движке, что и релиз',
  },
  {
    id: 'qa',
    n: 5,
    ru: 'Проверка',
    stages: ['qa'],
    hint: 'достижимость, тупики, континуити',
  },
  {
    id: 'release',
    n: 6,
    ru: 'Релиз',
    stages: ['bundle', 'release'],
    hint: 'честный гейт и неизменяемая сборка',
  },
];

export const DEFAULT_ZONE: ZoneId = 'idea';

export function zoneById(id: ZoneId): Zone {
  return ZONES.find(z => z.id === id) ?? ZONES[0];
}

/** «0 · Замысел» — подпись переключателя зоны. */
export function zoneLabel(zone: Zone): string {
  return `${zone.n} · ${zone.ru}`;
}

/** Зона, отвечающая за стадию. У каждой стадии ровно одна хозяйка. */
export function zoneOfStage(stage: ArtifactStage): Zone | undefined {
  return ZONES.find(z => z.stages.includes(stage));
}

/** Следующая зона конвейера — куда ведёт кнопка «Продолжить». */
export function nextZone(id: ZoneId): Zone | undefined {
  const index = ZONES.findIndex(z => z.id === id);
  return index >= 0 ? ZONES[index + 1] : undefined;
}
