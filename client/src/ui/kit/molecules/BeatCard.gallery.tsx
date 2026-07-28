import React from 'react';

import BeatCard from './BeatCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BeatCard';

export const cases: GalleryCase[] = [
  {
    title: 'done',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="done" />,
  },
  {
    title: 'failed',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="failed" />,
  },
  {
    title: 'running',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="running" />,
  },
  {
    title: 'locked',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="locked" />,
  },
  {
    title: 'selected',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="done" selected />,
  },
  {
    title: 'dimmed',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="done" dimmed />,
  },
  {
    title: 'кастомный statusText',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="running" statusText="в очереди" />,
  },
  {
    title: 'кликабельная (onSelect)',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="done" onSelect={() => {}} />,
  },
  {
    title: 'без onSelect — не кликабельная',
    node: <BeatCard kicker="Бит 04 · Д4д–Д4в" title="Фестиваль ◈" state="locked" />,
  },
];
