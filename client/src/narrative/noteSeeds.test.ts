import { describe, expect, it } from 'vitest';

import { emptyMeta, onNote } from '@/artifacts/transitions';

import { seedIssuesFromNotes } from './noteSeeds';

import type { ArtifactIndex, ArtifactKey } from '@/artifacts/types';
import type { EventUnit } from './calendarTypes';

function noted(key: ArtifactKey, ...notes: string[]): ArtifactIndex[string] {
  return notes.reduce((meta, text) => onNote(meta, text), emptyMeta(key));
}

const unit = (id: string, owner: string): EventUnit =>
  ({ id, participants: [owner, 'player'] } as unknown as EventUnit);

describe('seedIssuesFromNotes', () => {
  it('без заметок — без затравок', () => {
    const index: ArtifactIndex = { 'spine/': emptyMeta('spine/') };
    expect(seedIssuesFromNotes(index, [])).toEqual({ seeds: undefined, consumed: [] });
  });

  it('заметка на хребте едет в spine, на юните — в dialogue его unitId', () => {
    const index: ArtifactIndex = {
      'spine/': noted('spine/', 'меньше мрака'),
      'dialogue_units/enc_kaya_3': noted('dialogue_units/enc_kaya_3', 'больше язвительности'),
    };

    const { seeds, consumed } = seedIssuesFromNotes(index, []);

    expect(seeds?.spine).toEqual(['[заметка режиссёра] меньше мрака']);
    expect(seeds?.dialogue).toEqual({ enc_kaya_3: ['[заметка режиссёра] больше язвительности'] });
    expect(consumed.sort()).toEqual(['dialogue_units/enc_kaya_3', 'spine/']);
  });

  it('заметка на юните пула адресуется владельцу — первому участнику', () => {
    const index: ArtifactIndex = { 'event_pool/ev1': noted('event_pool/ev1', 'слишком часто в библиотеке') };

    const { seeds, consumed } = seedIssuesFromNotes(index, [unit('ev1', 'li_kaya')]);

    expect(seeds?.eventPool).toEqual({ li_kaya: ['[заметка режиссёра] слишком часто в библиотеке'] });
    expect(consumed).toEqual(['event_pool/ev1']);
  });

  it('юнит пула без владельца не учитывается — заметка остаётся при артефакте', () => {
    const index: ArtifactIndex = { 'event_pool/ev_unknown': noted('event_pool/ev_unknown', 'заметка') };

    const { seeds, consumed } = seedIssuesFromNotes(index, []);

    expect(seeds).toBeUndefined();
    expect(consumed).toEqual([]);
  });

  it('стадия без канала (calendar) не съедает заметку', () => {
    const index: ArtifactIndex = { 'calendar/': noted('calendar/', 'меньше выходных') };

    const { seeds, consumed } = seedIssuesFromNotes(index, []);

    expect(seeds).toBeUndefined();
    expect(consumed).toEqual([]);
  });
});
