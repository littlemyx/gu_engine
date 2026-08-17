import { parseArtifactKey } from '@/artifacts/types';

import type { ArtifactIndex, ArtifactKey } from '@/artifacts/types';
import type { BulkCalendarRunOptions } from './calendarRunState';
import type { EventUnit } from './calendarTypes';

/**
 * Заметки режиссёра → затравки прогона.
 *
 * Заметка живёт у артефакта («этот бит слишком мрачный»), а прогон принимает
 * фидбек каналами seedIssues — по тем же адресам, что и Story QA (qaSeeds):
 *
 *   spine/                  → затравка хребта;
 *   dialogue_units/<unitId> → затравка диалоговой прозы юнита;
 *   event_pool/<unitId>     → затравка пула владельца юнита (первый участник).
 *
 * Заметки на прочих стадиях канала пока не имеют — они остаются при артефакте
 * и не считаются учтёнными: молча выбросить слова автора хуже, чем показать их
 * ещё раз. Появится канал — маршрут допишется здесь.
 */

const seedLine = (text: string): string => `[заметка режиссёра] ${text}`;

export interface NoteSeeds {
  seeds: BulkCalendarRunOptions['seedIssues'];
  /** Артефакты, чьи заметки уехали в затравки, — им пора consumeNotes. */
  consumed: ArtifactKey[];
}

export function seedIssuesFromNotes(index: ArtifactIndex, eventUnits: EventUnit[]): NoteSeeds {
  const spine: string[] = [];
  const dialogue: Record<string, string[]> = {};
  const eventPool: Record<string, string[]> = {};
  const consumed: ArtifactKey[] = [];

  for (const [key, meta] of Object.entries(index)) {
    if (meta.notes.length === 0) continue;
    const { stage, item } = parseArtifactKey(key as ArtifactKey);
    const lines = meta.notes.map(seedLine);

    if (stage === 'spine') {
      spine.push(...lines);
    } else if (stage === 'dialogue_units' && item) {
      (dialogue[item] ??= []).push(...lines);
    } else if (stage === 'event_pool' && item) {
      const owner = eventUnits.find(u => u.id === item)?.participants[0];
      if (!owner) continue;
      (eventPool[owner] ??= []).push(...lines);
    } else {
      continue;
    }

    consumed.push(key as ArtifactKey);
  }

  const seeds: NonNullable<BulkCalendarRunOptions['seedIssues']> = {};
  if (spine.length > 0) seeds.spine = spine;
  if (Object.keys(dialogue).length > 0) seeds.dialogue = dialogue;
  if (Object.keys(eventPool).length > 0) seeds.eventPool = eventPool;

  return { seeds: Object.keys(seeds).length > 0 ? seeds : undefined, consumed };
}
