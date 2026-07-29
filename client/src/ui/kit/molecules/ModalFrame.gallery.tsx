import React from 'react';

import ModalFrame from './ModalFrame';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ModalFrame';

export const cases: GalleryCase[] = [
  {
    title: 'кикер + заголовок',
    node: (
      <ModalFrame kicker="ПРОГОН #13" title="Колл-щит">
        <span>содержимое модала…</span>
      </ModalFrame>
    ),
  },
  {
    title: 'с приписной подстрокой',
    node: (
      <ModalFrame kicker="ПРОГОН #13" title="Колл-щит" subtitle="черновик, не сохранён">
        <span>содержимое модала…</span>
      </ModalFrame>
    ),
  },
  {
    title: 'узкий (180px)',
    node: (
      <ModalFrame kicker="ШАГ 2 ИЗ 4" title="Seed" width={180}>
        <span>91427</span>
      </ModalFrame>
    ),
  },
  {
    title: 'широкий (420px)',
    node: (
      <ModalFrame kicker="ЭКСПОРТ" title="Сборка истории" subtitle="4 акта · 37 сцен" width={420}>
        <span>содержимое модала…</span>
      </ModalFrame>
    ),
  },
  {
    title: 'на тёмном фоне (затемнение)',
    dark: true,
    node: (
      <ModalFrame kicker="ПРОГОН #13" title="Колл-щит" subtitle="черновик">
        <span>содержимое модала…</span>
      </ModalFrame>
    ),
  },
];
