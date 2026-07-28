import React from 'react';

import ReadOnlyBanner from './ReadOnlyBanner';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ReadOnlyBanner';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию',
    node: <ReadOnlyBanner />,
  },
  {
    title: 'свой текст',
    node: <ReadOnlyBanner text="Прогон идёт: 6 из 14 сцен. Редактирование откроется после завершения." />,
  },
  {
    title: 'свой глиф',
    node: <ReadOnlyBanner glyph="⏳" text="Синхронизация с сервером — подождите." />,
  },
];
