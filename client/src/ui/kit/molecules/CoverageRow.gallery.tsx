import React from 'react';

import CoverageRow, { type CoverageCell } from './CoverageRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CoverageRow';

const MIXED: CoverageCell[] = [
  { tone: 'scene' },
  { tone: 'scene' },
  { tone: 'filler' },
  { tone: 'scene' },
  { tone: 'filler' },
  { tone: 'empty', tip: 'слот без событий' },
  { tone: 'scene' },
  { tone: 'filler' },
  { tone: 'scene' },
  { tone: 'scene' },
  { tone: 'filler' },
  { tone: 'scene' },
];

const ALL_SCENE: CoverageCell[] = Array.from({ length: 8 }, () => ({ tone: 'scene' }));
const ALL_FILLER: CoverageCell[] = Array.from({ length: 8 }, () => ({ tone: 'filler' }));
const SPARSE: CoverageCell[] = [
  { tone: 'empty', tip: 'пусто' },
  { tone: 'filler' },
  { tone: 'empty', tip: 'пусто' },
  { tone: 'filler' },
  { tone: 'empty', tip: 'пусто' },
  { tone: 'filler' },
];

export const cases: GalleryCase[] = [
  { title: 'смешанное покрытие', node: <CoverageRow label="Покрытие" cells={MIXED} /> },
  { title: 'все ячейки — сцены', node: <CoverageRow label="Покрытие" cells={ALL_SCENE} /> },
  { title: 'все ячейки — филлер', node: <CoverageRow label="Покрытие" cells={ALL_FILLER} /> },
  { title: 'много пустых слотов (тултип на наведении)', node: <CoverageRow label="Порция 2" cells={SPARSE} /> },
  {
    title: 'узкая подпись и широкие ячейки',
    node: <CoverageRow label="Кира" cells={MIXED.slice(0, 6)} labelWidth={48} cellWidth={44} />,
  },
  { title: 'без ячеек', node: <CoverageRow label="Покрытие" cells={[]} /> },
];
