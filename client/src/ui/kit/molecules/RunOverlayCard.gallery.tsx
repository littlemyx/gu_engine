import React from 'react';

import RunOverlayCard, { type RunOverlayPhaseItem } from './RunOverlayCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'RunOverlayCard';

const MID_RUN_PHASES: RunOverlayPhaseItem[] = [
  { label: 'фазы 1–7', value: '$0.13', status: 'done' },
  { label: 'Диалоговые юниты', value: '14/24', status: 'current' },
  { label: 'Эпилоги', value: '≈ $0.06', status: 'waiting' },
  { label: 'Story QA', value: '≈ $0.03', status: 'waiting' },
];

const EARLY_RUN_PHASES: RunOverlayPhaseItem[] = [
  { label: 'Каркас', value: '3/3', status: 'current' },
  { label: 'Диалоговые юниты', value: '≈ $0.11', status: 'waiting' },
  { label: 'Эпилоги', value: '≈ $0.06', status: 'waiting' },
  { label: 'Story QA', value: '≈ $0.03', status: 'waiting' },
];

const DONE_PHASES: RunOverlayPhaseItem[] = [
  { label: 'фазы 1–7', value: '$0.13', status: 'done' },
  { label: 'Диалоговые юниты', value: '24/24', status: 'done' },
  { label: 'Эпилоги', value: '$0.05', status: 'done' },
  { label: 'Story QA', value: '$0.03', status: 'done' },
];

export const cases: GalleryCase[] = [
  {
    title: 'середина прогона · 58%',
    node: <RunOverlayCard title="Прогон · фаза 8/10" phases={MID_RUN_PHASES} percent={58} />,
  },
  {
    title: 'начало прогона · узкая карточка',
    node: <RunOverlayCard title="Прогон · фаза 2/10" phases={EARLY_RUN_PHASES} percent={9} width={200} />,
  },
  {
    title: 'все фазы готовы · 100%',
    node: <RunOverlayCard title="Прогон · завершён" phases={DONE_PHASES} percent={100} />,
  },
  {
    title: 'широкая карточка · без фаз',
    node: <RunOverlayCard title="Прогон · инициализация" phases={[]} percent={4} width={360} />,
  },
];
