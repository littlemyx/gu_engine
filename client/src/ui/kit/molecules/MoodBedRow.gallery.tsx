import React from 'react';

import MoodBedRow from './MoodBedRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'MoodBedRow';

export const cases: GalleryCase[] = [
  {
    title: 'выбор · дубль A',
    node: (
      <MoodBedRow label="весёлая" code="cheerful_warm" state="choice" choice="A" onPick={() => {}} onPlay={() => {}} />
    ),
  },
  {
    title: 'выбор · дубль B',
    node: (
      <MoodBedRow label="тревожная" code="tense_low" state="choice" choice="B" onPick={() => {}} onPlay={() => {}} />
    ),
  },
  {
    title: 'выбор · без колбэков',
    node: <MoodBedRow label="нейтральная" code="neutral_ambient" state="choice" />,
  },
  {
    title: 'генерируется',
    node: <MoodBedRow label="торжественная" code="triumph_full" state="generating" />,
  },
  {
    title: 'в очереди',
    node: <MoodBedRow label="грустная" code="melancholy_soft" state="queue" />,
  },
  {
    title: 'примечание',
    node: <MoodBedRow label="базовая" code="base_ambient" state="note" note="= базовая подложка" />,
  },
  {
    title: 'нет локаций',
    node: <MoodBedRow label="общая" code="shared_bed" state="noLocations" note="нет привязанных локаций" />,
  },
  {
    title: 'на тёмном · выбор',
    dark: true,
    node: (
      <MoodBedRow
        label="весёлая"
        code="cheerful_warm"
        state="choice"
        choice="A"
        onDark
        onPick={() => {}}
        onPlay={() => {}}
      />
    ),
  },
  {
    title: 'на тёмном · генерируется',
    dark: true,
    node: <MoodBedRow label="торжественная" code="triumph_full" state="generating" onDark />,
  },
];
