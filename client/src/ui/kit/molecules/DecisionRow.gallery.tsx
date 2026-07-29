import React from 'react';

import DecisionRow from './DecisionRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'DecisionRow';

export const cases: GalleryCase[] = [
  {
    title: 'решение не принято',
    node: <DecisionRow text="beat_prose/b5 — ваша правка, но изменился Б4" onPick={() => {}} />,
  },
  {
    title: 'выбрано «оставить моё»',
    node: <DecisionRow text="beat_prose/b5 — ваша правка, но изменился Б4" chosen="моё" onPick={() => {}} />,
  },
  {
    title: 'выбран «дубль»',
    node: <DecisionRow text="beat_prose/b5 — ваша правка, но изменился Б4" chosen="дубль" onPick={() => {}} />,
  },
  {
    title: 'нерактивная строка (без onPick)',
    node: <DecisionRow text="beat_prose/b5 — ваша правка, но изменился Б4" />,
  },
  {
    title: 'свои подписи кнопок',
    node: (
      <DecisionRow
        text="location_beat/k2 — оба автора правили описание локации"
        keepLabel="взять моё"
        redoLabel="перегенерировать ≈$0.05"
        onPick={() => {}}
      />
    ),
  },
];
