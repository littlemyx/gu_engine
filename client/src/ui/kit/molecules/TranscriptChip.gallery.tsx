import React from 'react';

import TranscriptChip from './TranscriptChip';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TranscriptChip';

export const cases: GalleryCase[] = [
  {
    title: 'обычный',
    node: <TranscriptChip label="Д2д Кафе" tone="обычный" />,
  },
  {
    title: 'текущий',
    node: <TranscriptChip label="Д3в Пирс" tone="текущий" />,
  },
  {
    title: 'предупреждение',
    node: <TranscriptChip label="история дальше изменилась — промотка остановлена" tone="предупреждение" />,
  },
  {
    title: 'обычный, кликабельный',
    node: <TranscriptChip label="Д2д Кафе" tone="обычный" onClick={() => {}} />,
  },
  {
    title: 'текущий, кликабельный',
    node: <TranscriptChip label="Д3в Пирс" tone="текущий" onClick={() => {}} />,
  },
  {
    title: 'предупреждение, кликабельный',
    node: (
      <TranscriptChip
        label="история дальше изменилась — промотка остановлена"
        tone="предупреждение"
        onClick={() => {}}
      />
    ),
  },
];
