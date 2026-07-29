import React from 'react';

import TranscriptBar from './TranscriptBar';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TranscriptBar';

const ITEMS = [
  { label: 'Д1а Двор' },
  { label: 'Д2д Кафе', tone: 'current' as const },
  { label: 'история дальше изменилась — промотка остановлена', tone: 'warning' as const },
];

export const cases: GalleryCase[] = [
  {
    title: 'обычный чип',
    node: <TranscriptBar label="ТРАНСКРИПТ" items={[{ label: 'Д2д Кафе' }]} />,
  },
  {
    title: 'текущий чип',
    node: <TranscriptBar label="ТРАНСКРИПТ" items={[{ label: 'Д3в Пирс', tone: 'current' }]} />,
  },
  {
    title: 'предупреждение',
    node: (
      <TranscriptBar
        label="ТРАНСКРИПТ"
        items={[{ label: 'история дальше изменилась — промотка остановлена', tone: 'warning' }]}
      />
    ),
  },
  {
    title: 'лента с кикером',
    node: <TranscriptBar label="ТРАНСКРИПТ · клик = детерминированный откат" items={ITEMS} onPick={() => {}} />,
  },
  {
    title: 'без кикера',
    node: <TranscriptBar label="" items={ITEMS} onPick={() => {}} />,
  },
  {
    title: 'без колбэка · не кликабельно',
    node: <TranscriptBar label="ТРАНСКРИПТ" items={ITEMS} />,
  },
  {
    title: 'на тёмном',
    node: <TranscriptBar label="ТРАНСКРИПТ · клик = детерминированный откат" items={ITEMS} onPick={() => {}} onDark />,
    dark: true,
  },
];
