import React from 'react';

import ReleaseCard from './ReleaseCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ReleaseCard';

const STATS = ['слотов 21', 'юнитов 44', 'бандл 412 КБ', 'lockfile: 96 отпечатков'];

export const cases: GalleryCase[] = [
  {
    title: 'accent · с бейджем и статистикой',
    node: <ReleaseCard title="Релиз v2 · 14 июля · иммутабельный" badge="QA #5 ✓" stats={STATS} tone="accent" />,
  },
  {
    title: 'обычная · без бейджа',
    node: <ReleaseCard title="Релиз v1 · 2 июля · архив" stats={STATS} tone="обычная" />,
  },
  {
    title: 'без статистики',
    node: <ReleaseCard title="Релиз v3 · черновик" badge="draft" />,
  },
  {
    title: 'с содержимым снизу',
    node: (
      <ReleaseCard title="Релиз v2 · 14 июля · иммутабельный" badge="QA #5 ✓" stats={STATS}>
        <span>откатить · сравнить с текущим</span>
      </ReleaseCard>
    ),
  },
  {
    title: 'кликабельна',
    node: <ReleaseCard title="Релиз v2 · 14 июля · иммутабельный" badge="QA #5 ✓" stats={STATS} onClick={() => {}} />,
  },
];
