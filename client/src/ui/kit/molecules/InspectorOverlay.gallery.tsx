import React from 'react';

import InspectorOverlay from './InspectorOverlay';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ИНСПЕКТОР-ОВЕРЛЕЙ';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию (300×320)',
    dark: true,
    node: (
      <InspectorOverlay title="Инспектор · Бит 04" onClose={() => {}}>
        <div>▾ Замки ✓✓✓ · ▸ Исходы · ▸ Медиа</div>
      </InspectorOverlay>
    ),
  },
  {
    title: 'без onClose — кнопка неактивна',
    dark: true,
    node: (
      <InspectorOverlay title="Инспектор · Бит 04">
        <div>▾ Замки ✓✓✓ · ▸ Исходы · ▸ Медиа</div>
      </InspectorOverlay>
    ),
  },
  {
    title: 'узкий (240×200)',
    dark: true,
    node: (
      <InspectorOverlay title="Замысел" width={240} height={200} onClose={() => {}}>
        <div>Фестиваль ◈ развилка</div>
      </InspectorOverlay>
    ),
  },
  {
    title: 'широкий (420×600)',
    dark: true,
    node: (
      <InspectorOverlay title="Инспектор · Партитура" width={420} height={600} onClose={() => {}}>
        <div>содержимое инспектора…</div>
      </InspectorOverlay>
    ),
  },
];
