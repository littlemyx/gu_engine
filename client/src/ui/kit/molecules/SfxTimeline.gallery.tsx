import React from 'react';

import SfxTimeline, { type SfxTimelineClip } from './SfxTimeline';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SfxTimeline';

const MIXED: SfxTimelineClip[] = [
  { label: 'скрип досок', left: 12, width: 90, bound: true },
  { label: 'шаги', left: 55, width: 70, bound: false },
];

const ONLY_BOUND: SfxTimelineClip[] = [
  { label: 'гром', left: 8, width: 80, bound: true },
  { label: 'колокол', left: 60, width: 100, bound: true },
];

const ONLY_PLAIN: SfxTimelineClip[] = [
  { label: 'ветер', left: 5, width: 70, bound: false },
  { label: 'толпа', left: 45, width: 110, bound: false },
];

export const cases: GalleryCase[] = [
  { title: 'привязан / обычный · по умолчанию', node: <SfxTimeline clips={MIXED} /> },
  { title: 'все клипы привязаны', node: <SfxTimeline clips={ONLY_BOUND} /> },
  { title: 'все клипы обычные', node: <SfxTimeline clips={ONLY_PLAIN} /> },
  {
    title: 'выбранный клип',
    node: <SfxTimeline clips={MIXED} selected={0} onClipClick={() => {}} />,
  },
  {
    title: 'кликабельная дорожка',
    node: <SfxTimeline clips={MIXED} onClipClick={() => {}} />,
  },
  {
    title: 'плейхед скрыт',
    node: <SfxTimeline clips={MIXED} playhead={-1} />,
  },
];
