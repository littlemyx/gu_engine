import { describe, expect, it } from 'vitest';

import {
  emptyMeta,
  onApprove,
  onGenerated,
  onLock,
  onNote,
  onNotesConsumed,
  onSelectTake,
  onUnlock,
  onUserEdit,
} from './transitions';

import type { ArtifactMeta, Ownership } from './types';

const born = (ownership: Ownership = 'proposed'): ArtifactMeta => ({
  ...emptyMeta('spine/'),
  ownership,
  fingerprint: 'fp-1',
  takes: [{ n: 1, ts: 1, origin: 'generated' }],
});

describe('onGenerated', () => {
  it('рождает артефакт: первый тейк, отпечаток входов, машинное владение', () => {
    const meta = onGenerated(emptyMeta('spine/'), { fingerprint: 'fp-1', runId: 'r1', cost: 0.4 });

    expect(meta.ownership).toBe('proposed');
    expect(meta.fingerprint).toBe('fp-1');
    expect(meta.takes).toHaveLength(1);
    expect(meta.takes[0].origin).toBe('generated');
    expect(meta.provenance?.cost).toBe(0.4);
  });

  it('копит тейки и выбирает последний', () => {
    const first = onGenerated(emptyMeta('spine/'), { fingerprint: 'fp-1' });
    const second = onGenerated(first, { fingerprint: 'fp-2' });

    expect(second.takes.map(t => t.n)).toEqual([1, 2]);
    expect(second.selectedTake).toBe(2);
  });

  it('запертое не трогает вовсе — ни тейка, ни отпечатка', () => {
    const locked = born('locked');
    expect(onGenerated(locked, { fingerprint: 'fp-2' })).toBe(locked);
  });

  it('авторское не понижает до машинного, но дубль записывает', () => {
    const authored = born('authored');
    const next = onGenerated(authored, { fingerprint: 'fp-2' });

    expect(next.ownership).toBe('authored');
    expect(next.takes).toHaveLength(2);
  });

  it('принятое возвращается в машинное: это новый вариант, его ещё не принимали', () => {
    expect(onGenerated(born('approved'), { fingerprint: 'fp-2' }).ownership).toBe('proposed');
  });
});

describe('onApprove', () => {
  it('поднимает предложенное до принятого', () => {
    expect(onApprove(born('proposed')).ownership).toBe('approved');
  });

  it.each<Ownership>(['approved', 'authored', 'locked'])('не трогает %s', ownership => {
    const meta = born(ownership);
    expect(onApprove(meta)).toBe(meta);
  });
});

describe('onUserEdit', () => {
  it('делает артефакт авторским и записывает ручной дубль', () => {
    const next = onUserEdit(born(), 'fp-1');

    expect(next.ownership).toBe('authored');
    expect(next.takes.at(-1)?.origin).toBe('manual');
  });

  it('правка снимает протухание: она сделана поверх текущих входов', () => {
    const stale = { ...born(), fingerprint: 'fp-old' };
    expect(onUserEdit(stale, 'fp-new').fingerprint).toBe('fp-new');
  });
});

describe('замок', () => {
  it('запирает существующий артефакт', () => {
    expect(onLock(born()).ownership).toBe('locked');
  });

  it('несуществующий запереть нельзя', () => {
    const missing = emptyMeta('spine/');
    expect(onLock(missing)).toBe(missing);
  });

  it('снятие замка возвращает в авторские, а не в машинные', () => {
    expect(onUnlock(onLock(born())).ownership).toBe('authored');
  });
});

describe('тейки и заметки', () => {
  it('переключение на существующий дубль', () => {
    const two = onGenerated(born(), { fingerprint: 'fp-2' });
    expect(onSelectTake(two, 1).selectedTake).toBe(1);
  });

  it('несуществующий дубль игнорируется', () => {
    const meta = born();
    expect(onSelectTake(meta, 99)).toBe(meta);
  });

  it('заметка копится и не меняет владения', () => {
    const noted = onNote(born('approved'), '  больше про море  ');

    expect(noted.notes).toEqual(['больше про море']);
    expect(noted.ownership).toBe('approved');
  });

  it('пустая заметка не пишется', () => {
    const meta = born();
    expect(onNote(meta, '   ')).toBe(meta);
  });

  it('учтённые заметки сбрасываются', () => {
    expect(onNotesConsumed(onNote(born(), 'ещё')).notes).toEqual([]);
  });
});
