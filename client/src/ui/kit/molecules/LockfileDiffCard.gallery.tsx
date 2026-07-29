import React from 'react';

import LockfileDiffCard from './LockfileDiffCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'LockfileDiffCard';

export const cases: GalleryCase[] = [
  {
    title: 'с хвостом сводки',
    node: (
      <LockfileDiffCard
        title="Что изменилось с v2 · diff lockfile-ов"
        meta="12 отпечатков разошлись"
        summary="проза: Б5 «Ссора» + 9 юнитов · концовки: обе"
        note="медиа: без изменений"
      />
    ),
  },
  {
    title: 'без хвоста сводки',
    node: (
      <LockfileDiffCard
        title="Что изменилось с v3 · diff lockfile-ов"
        meta="4 отпечатка разошлись"
        summary="аудио: 2 трека переозвучены"
      />
    ),
  },
];
