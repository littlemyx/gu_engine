import React from 'react';

import ReachabilityChart from './ReachabilityChart';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ReachabilityChart';

export const cases: GalleryCase[] = [
  {
    title: 'обычный набор — все концовки достижимы',
    node: (
      <ReachabilityChart
        title="ДОСТИЖИМОСТЬ КОНЦОВОК · 50 ПРОГОНОВ"
        rows={[
          { label: 'примирение', percent: 68, count: '34' },
          { label: 'расставание', percent: 52, count: '26' },
          { label: 'новый союз', percent: 40, count: '20' },
        ]}
      />
    ),
  },
  {
    title: 'тон quiet — приглушённая концовка',
    node: (
      <ReachabilityChart
        title="ДОСТИЖИМОСТЬ КОНЦОВОК · 50 ПРОГОНОВ"
        rows={[
          { label: 'примирение', percent: 68, count: '34' },
          { label: 'тихий уход', percent: 24, count: '12', tone: 'quiet' },
        ]}
      />
    ),
  },
  {
    title: 'тон warn — редко достижимая концовка',
    node: (
      <ReachabilityChart
        title="ДОСТИЖИМОСТЬ КОНЦОВОК · 50 ПРОГОНОВ"
        rows={[
          { label: 'примирение', percent: 68, count: '34' },
          { label: 'расставание', percent: 52, count: '26' },
          { label: 'тайна маяка', percent: 8, count: '4', tone: 'warn' },
        ]}
      />
    ),
  },
  {
    title: 'все три тона вместе',
    node: (
      <ReachabilityChart
        title="ДОСТИЖИМОСТЬ КОНЦОВОК · 50 ПРОГОНОВ"
        rows={[
          { label: 'примирение', percent: 68, count: '34' },
          { label: 'тихий уход', percent: 24, count: '12', tone: 'quiet' },
          { label: 'тайна маяка', percent: 8, count: '4', tone: 'warn' },
        ]}
      />
    ),
  },
  {
    title: 'одна строка на пределе (100%)',
    node: (
      <ReachabilityChart
        title="ДОСТИЖИМОСТЬ КОНЦОВОК · 12 ПРОГОНОВ"
        rows={[{ label: 'единственный финал', percent: 100, count: '12' }]}
      />
    ),
  },
];
