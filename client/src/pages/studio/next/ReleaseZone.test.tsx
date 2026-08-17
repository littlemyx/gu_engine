/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { useArtifactStore } from '@/artifacts/artifactStore';

import ReleaseZone, { deriveGateBlockers, deriveReleaseRows } from './ReleaseZone';

import type { ArtifactIndex } from '@/artifacts/types';
import type { ArtifactRow, PipelineModel, ZoneRow } from '../derive/pipelineModel';

afterEach(() => {
  cleanup();
  useArtifactStore.setState({ index: {} });
});

// jest-dom в проекте нет — смотрим сам DOM.
const readyZone = (id: ZoneRow['id'], label: string, rows: ArtifactRow[] = []): ZoneRow => ({
  id,
  label,
  hint: '',
  state: 'ready',
  fresh: 3,
  stale: 0,
  missing: 0,
  total: 3,
  rows,
});

const notReadyZone = (id: ZoneRow['id'], label: string, state: ZoneRow['state']): ZoneRow => ({
  id,
  label,
  hint: '',
  state,
  fresh: 1,
  stale: state === 'stale' ? 1 : 0,
  missing: state === 'partial' ? 2 : 0,
  total: 3,
  rows: [],
});

const previewZone: ZoneRow = {
  id: 'preview',
  label: '4 · Превью',
  hint: '',
  state: 'empty',
  fresh: 0,
  stale: 0,
  missing: 0,
  total: 0,
  rows: [],
};

function releaseRow(item: string, freshness: ArtifactRow['freshness'] = 'fresh'): ArtifactRow {
  return {
    key: `release/${item}` as ArtifactRow['key'],
    stage: 'release',
    item,
    freshness,
    ownership: 'locked',
    mark: freshness === 'fresh' ? '●' : freshness === 'stale' ? '◐' : '○',
    locked: true,
    needsDecision: false,
    placeholder: false,
    inDraft: false,
  };
}

function bundlePlaceholder(): ArtifactRow {
  return {
    key: 'bundle/' as ArtifactRow['key'],
    stage: 'bundle',
    item: '',
    freshness: 'missing',
    ownership: 'proposed',
    mark: '○',
    locked: false,
    needsDecision: false,
    placeholder: true,
    inDraft: false,
  };
}

const EMPTY_PIPELINE: PipelineModel = {
  zones: [
    notReadyZone('idea', '0 · Замысел', 'partial'),
    readyZone('structure', '1 · Структура'),
    notReadyZone('prose', '2 · Генерация', 'stale'),
    readyZone('media', '3 · Медиа'),
    previewZone,
    readyZone('qa', '5 · Проверка'),
    { ...readyZone('release', '6 · Релиз'), rows: [bundlePlaceholder()], state: 'empty', fresh: 0, total: 1 },
  ],
  nextIncomplete: 'idea',
  totalStale: 2,
  totalMissing: 1,
};

function withReleases(rows: ArtifactRow[]): PipelineModel {
  return {
    zones: [
      readyZone('idea', '0 · Замысел'),
      readyZone('structure', '1 · Структура'),
      readyZone('prose', '2 · Генерация'),
      readyZone('media', '3 · Медиа'),
      previewZone,
      readyZone('qa', '5 · Проверка'),
      { ...readyZone('release', '6 · Релиз'), rows },
    ],
    nextIncomplete: null,
    totalStale: 0,
    totalMissing: 0,
  };
}

describe('deriveGateBlockers', () => {
  it('собирает блокер на каждую неготовую зону, кроме превью и самого релиза', () => {
    const blockers = deriveGateBlockers(EMPTY_PIPELINE);
    const texts = blockers.map(b => b.text).join(' | ');

    expect(texts).toContain('Замысел');
    expect(texts).toContain('Генерация');
    expect(texts).not.toContain('Превью');
    expect(blockers.some(b => b.id === 'zone:release')).toBe(false);
  });

  it('добавляет отдельный блокер на устаревшее по всему конвейеру', () => {
    const blockers = deriveGateBlockers(EMPTY_PIPELINE);
    expect(blockers.some(b => b.id === 'stale')).toBe(true);
  });

  it('на полностью готовом конвейере блокеров нет', () => {
    expect(deriveGateBlockers(withReleases([]))).toEqual([]);
  });
});

describe('deriveReleaseRows', () => {
  it('отбрасывает плейсхолдер bundle и оставляет только строки стадии release', () => {
    expect(deriveReleaseRows(EMPTY_PIPELINE)).toEqual([]);
  });

  it('видит настоящие релизы', () => {
    const rows = deriveReleaseRows(withReleases([releaseRow('v1'), bundlePlaceholder()]));
    expect(rows.map(r => r.item)).toEqual(['v1']);
  });
});

describe('ReleaseZone — релизов ещё нет', () => {
  it('показывает список блокеров и пустое состояние', () => {
    render(<ReleaseZone pipeline={EMPTY_PIPELINE} />);

    expect(screen.getByText('Релизов ещё нет')).toBeTruthy();
    expect(screen.getByText('сначала закройте блокеры выше')).toBeTruthy();
    expect(screen.getAllByText(/Замысел/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Генерация/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Устарело артефактов: 2/)).toBeTruthy();
  });

  it('когда блокеров нет, а релизов ещё нет — приглашает собрать первый', () => {
    render(<ReleaseZone pipeline={withReleases([])} />);

    expect(screen.getByText('Блокеров нет — конвейер готов к сборке релиза.')).toBeTruthy();
    expect(screen.getByText('гейт открыт — можно собрать первый релиз')).toBeTruthy();
  });
});

describe('ReleaseZone — есть готовые релизы', () => {
  const index: ArtifactIndex = {
    'release/v1': {
      key: 'release/v1' as ArtifactRow['key'],
      ownership: 'locked',
      fingerprint: 'fp1',
      takes: [{ n: 1, ts: 0, origin: 'generated' }],
      selectedTake: 1,
      notes: [],
      provenance: { cost: 1.5 },
    },
    'release/v2': {
      key: 'release/v2' as ArtifactRow['key'],
      ownership: 'approved',
      fingerprint: 'fp2',
      takes: [{ n: 1, ts: 0, origin: 'generated' }],
      selectedTake: 1,
      notes: [],
    },
  };

  const pipeline = withReleases([releaseRow('v1'), releaseRow('v2', 'stale')]);

  it('рисует карточку на каждый релиз и паспорт первого по умолчанию', () => {
    useArtifactStore.setState({ index });
    render(<ReleaseZone pipeline={pipeline} />);

    expect(screen.getAllByText('v1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('v2').length).toBeGreaterThan(0);
    expect(screen.getByText('версия: v1')).toBeTruthy();
  });

  it('выбор другой карточки — решение автора: паспорт переключается', () => {
    useArtifactStore.setState({ index });
    render(<ReleaseZone pipeline={pipeline} />);

    fireEvent.click(screen.getAllByText('v2')[0]);

    expect(screen.getByText('версия: v2')).toBeTruthy();
    expect(screen.queryByText('версия: v1')).toBeFalsy();
  });
});
