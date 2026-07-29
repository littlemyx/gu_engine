import React from 'react';

import ImportRow from './ImportRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ImportRow';

export const cases: GalleryCase[] = [
  {
    title: 'ок',
    node: <ImportRow path="world.setting" value="университет · современность · провинциальный универ" state="ок" />,
  },
  {
    title: 'предупреждение',
    node: <ImportRow path="cast.trust_start" value="вне диапазона −5…5, округлено до 5" state="предупреждение" />,
  },
  {
    title: 'пропуск',
    node: <ImportRow path="world.tags" value="не найдено в исходнике" state="пропуск" />,
  },
  {
    title: 'узкая колонка пути',
    node: <ImportRow path="beat.trigger" value="сцена 12 · после развилки" pathWidth={90} />,
  },
  {
    title: 'узкая строка целиком',
    node: <ImportRow path="world.setting" value="университет" width={320} />,
  },
];
