import React from 'react';

import PlaybackBadge from './PlaybackBadge';

import type { GalleryCase } from '../galleryTypes';

export const title = 'PlaybackBadge';

export const cases: GalleryCase[] = [
  { title: 'играет', dark: true, node: <PlaybackBadge /> },
  { title: 'пауза', dark: true, node: <PlaybackBadge playing={false} /> },
  {
    title: 'играет · своя подпись',
    dark: true,
    node: <PlaybackBadge label="запись реплики" time="1:02" total="2:15" />,
  },
  {
    title: 'пауза · своя подпись',
    dark: true,
    node: <PlaybackBadge label="остановлено" playing={false} time="0:12" total="0:45" />,
  },
];
