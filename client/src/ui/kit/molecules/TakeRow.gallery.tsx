import React from 'react';

import TakeRow from './TakeRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TakeRow';

export const cases: GalleryCase[] = [
  {
    title: 'принят',
    dark: true,
    node: <TakeRow num={3} label="✎ ручная правка" status="принят" />,
  },
  {
    title: 'черновик',
    dark: true,
    node: <TakeRow num={4} label="черновой прогон" status="черновик" />,
  },
  {
    title: 'отклонён',
    dark: true,
    node: <TakeRow num={2} label="слабая сцена, пересъём" status="отклонён" />,
  },
  {
    title: 'генерируется',
    dark: true,
    node: <TakeRow num={5} label="дубль от режиссёра" status="генерируется" />,
  },
  {
    title: 'action переопределяет статус',
    dark: true,
    node: <TakeRow num={6} label="правка диалога" action="дубль от Иры" />,
  },
  {
    title: 'выбрана',
    dark: true,
    node: <TakeRow num={3} label="✎ ручная правка" status="принят" selected onClick={() => {}} />,
  },
  {
    title: 'кликабельная, не выбрана',
    dark: true,
    node: <TakeRow num={7} label="добавлен реквизит" status="черновик" onClick={() => {}} />,
  },
  {
    title: 'некликабельная строка (без onClick)',
    dark: true,
    node: <TakeRow num={1} label="исходный тейк" status="принят" />,
  },
];
