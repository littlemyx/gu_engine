/**
 * Модель артефактов: единая учётная единица всего, что производит конвейер.
 *
 * Зачем она: сейчас «сделано ли» и «не протухло ли» разбросано по флагам
 * (dirtyStages, наличие поля в сторе, imageFingerprint). Артефакт сводит это
 * к двум независимым осям, которые нельзя перепутать:
 *
 *   ownership — чьё это и можно ли трогать: машина предложила (proposed),
 *               автор принял (approved), автор написал сам (authored),
 *               автор запер (locked — «удачное, не перегенерировать»);
 *   freshness — соответствует ли артефакт своим входам: не создан (missing),
 *               свеж (fresh), протух (stale).
 *
 * Ownership хранится: это решение автора, вывести его неоткуда. Freshness НЕ
 * хранится: она считается сравнением отпечатка входов, поэтому рассинхрон
 * «в сторе fresh, а на деле нет» невозможен по построению.
 */

/**
 * Стадия конвейера. Совпадает со стадиями календарного прогона (см.
 * `narrative/calendarRunState.ts`), плюс бриф сверху и медиа/сборка снизу.
 *
 * `world` и `calendar` разведены намеренно: каскад `cast` сносит календарь и
 * тег-карту, но не модель мира, и в одной стадии это не выразить.
 */
export type ArtifactStage =
  | 'brief'
  | 'cast'
  | 'world'
  | 'calendar'
  | 'spine'
  | 'schedule'
  | 'beat_prose'
  | 'anchor_transitions'
  | 'event_pool'
  | 'dialogue_units'
  | 'ending_prose'
  | 'image'
  | 'audio'
  | 'qa'
  | 'bundle'
  | 'release';

/**
 * Адрес артефакта: стадия и элемент внутри неё. У скалярных стадий (бриф,
 * хребет) элемент пустой — на прогон приходится ровно один артефакт.
 */
export type ArtifactKey = `${ArtifactStage}/${string}`;

export type Ownership = 'proposed' | 'approved' | 'authored' | 'locked';
export type Freshness = 'missing' | 'fresh' | 'stale';

/** Один дубль артефакта. Тейки копятся, чтобы можно было вернуться к прежнему. */
export interface Take {
  n: number;
  ts: number;
  origin: 'generated' | 'manual' | 'restored';
  runId?: string;
  /** Стоимость именно этого дубля в долларах. */
  cost?: number;
}

export interface ArtifactMeta {
  key: ArtifactKey;
  ownership: Ownership;
  /**
   * Отпечаток входов на момент рождения артефакта. `null` — артефакта ещё нет.
   * Сравнение с текущим отпечатком и даёт freshness.
   */
  fingerprint: string | null;
  takes: Take[];
  /** Номер выбранного тейка (`Take.n`). */
  selectedTake: number;
  /** Заметки режиссёру: уезжают в previousIssues следующей генерации. */
  notes: string[];
  provenance?: {
    runId?: string;
    promptVersion?: number;
    cost?: number;
  };
}

export type ArtifactIndex = Record<string, ArtifactMeta>;

export function artifactKey(stage: ArtifactStage, item = ''): ArtifactKey {
  return `${stage}/${item}`;
}

export function parseArtifactKey(key: ArtifactKey): { stage: ArtifactStage; item: string } {
  const slash = key.indexOf('/');
  return { stage: key.slice(0, slash) as ArtifactStage, item: key.slice(slash + 1) };
}

/** Артефакт, который автор запретил трогать машине. */
export function isProtected(meta: ArtifactMeta): boolean {
  return meta.ownership === 'locked';
}

/**
 * Артефакт, который прогон не имеет права молча переписать: автор в него уже
 * вложился. Такие уходят в колл-щите в отдельную секцию «требуют решения».
 */
export function needsDecision(meta: ArtifactMeta, freshness: Freshness): boolean {
  return freshness === 'stale' && (meta.ownership === 'authored' || meta.ownership === 'locked');
}
