import type { ArtifactKey, ArtifactMeta, Ownership, Take } from './types';

/**
 * Переходы владения — чистые функции над одной метой.
 *
 * Правила, которые они охраняют:
 *   · прогон не переписывает того, что автор запер (locked) — locked остаётся
 *     locked и нового тейка не получает;
 *   · прогон не понижает authored до proposed: автор уже вложился, и молча
 *     подменить его текст машинным нельзя. Такой артефакт получает тейк, но
 *     владение сохраняет, а колл-щит выносит его в «требуют решения»;
 *   · заметка режиссёру не меняет владения: она — вход следующей генерации,
 *     а не факт правки.
 */

export const FIRST_TAKE = 1;

export function emptyMeta(key: ArtifactKey): ArtifactMeta {
  return { key, ownership: 'proposed', fingerprint: null, takes: [], selectedTake: FIRST_TAKE, notes: [] };
}

function withTake(meta: ArtifactMeta, take: Omit<Take, 'n'>): ArtifactMeta {
  const n = meta.takes.reduce((max, t) => Math.max(max, t.n), 0) + 1;
  return { ...meta, takes: [...meta.takes, { ...take, n }], selectedTake: n };
}

export interface GeneratedInfo {
  fingerprint: string;
  runId?: string;
  cost?: number;
  promptVersion?: number;
}

/**
 * Прогон сгенерировал артефакт. Запертое не трогается вовсе — даже отпечаток,
 * иначе locked-артефакт тихо стал бы «свежим» без пересборки.
 */
export function onGenerated(meta: ArtifactMeta, info: GeneratedInfo): ArtifactMeta {
  if (meta.ownership === 'locked') return meta;

  const next = withTake(meta, { ts: Date.now(), origin: 'generated', runId: info.runId, cost: info.cost });

  return {
    ...next,
    // authored не понижаем: у сгенерированного дубля появляется тейк, но
    // хозяином текста остаётся автор, пока он сам не примет машинный вариант.
    ownership: meta.ownership === 'authored' ? 'authored' : 'proposed',
    fingerprint: info.fingerprint,
    provenance: { runId: info.runId, cost: info.cost, promptVersion: info.promptVersion },
  };
}

/** Автор принял машинный вариант: артефакт больше не «на рассмотрении». */
export function onApprove(meta: ArtifactMeta): ArtifactMeta {
  return meta.ownership === 'proposed' ? { ...meta, ownership: 'approved' } : meta;
}

/**
 * Автор правил руками. Отпечаток берётся текущий: правка сделана поверх этих
 * входов, и протухшей она станет только когда входы поедут дальше.
 */
export function onUserEdit(meta: ArtifactMeta, fingerprint: string): ArtifactMeta {
  const next = withTake(meta, { ts: Date.now(), origin: 'manual' });
  return { ...next, ownership: 'authored', fingerprint };
}

/**
 * Автор решил «оставить моё», когда входы уехали, а строка его.
 *
 * Отпечаток освежается по текущим входам — конфликт закрыт, и в следующей
 * смете строка не всплывёт снова. Тейк при этом НЕ добавляется: работы не
 * было, и врать о ней в истории дублей нельзя.
 *
 * Запертое трогает сознательно (в отличие от onGenerated): это явное решение
 * автора по конкретной строке, а не тихая подмена машиной.
 */
export function onKeepOwn(meta: ArtifactMeta, fingerprint: string): ArtifactMeta {
  return meta.fingerprint === null ? meta : { ...meta, fingerprint };
}

/** «Удачное — не трогать». Запирать можно что угодно, кроме несуществующего. */
export function onLock(meta: ArtifactMeta): ArtifactMeta {
  return meta.fingerprint === null ? meta : { ...meta, ownership: 'locked' };
}

/** Снятие замка возвращает артефакт в авторские, а не в машинные. */
export function onUnlock(meta: ArtifactMeta): ArtifactMeta {
  return meta.ownership === 'locked' ? { ...meta, ownership: 'authored' } : meta;
}

/** Вернуться к прежнему дублю. Несуществующий номер игнорируется. */
export function onSelectTake(meta: ArtifactMeta, n: number): ArtifactMeta {
  return meta.takes.some(t => t.n === n) ? { ...meta, selectedTake: n } : meta;
}

/** Заметка режиссёру: уедет в previousIssues следующей генерации. */
export function onNote(meta: ArtifactMeta, note: string): ArtifactMeta {
  const trimmed = note.trim();
  return trimmed ? { ...meta, notes: [...meta.notes, trimmed] } : meta;
}

/** Заметки учтены прогоном — копить их дальше незачем. */
export function onNotesConsumed(meta: ArtifactMeta): ArtifactMeta {
  return meta.notes.length ? { ...meta, notes: [] } : meta;
}

export function ownershipLabel(ownership: Ownership): string {
  const LABELS: Record<Ownership, string> = {
    proposed: 'предложено',
    approved: 'принято',
    authored: 'написано вами',
    locked: 'заперто',
  };
  return LABELS[ownership];
}
