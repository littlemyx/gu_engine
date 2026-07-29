import React from 'react';

import EmptyProjectCard from './EmptyProjectCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'EmptyProjectCard';

export const cases: GalleryCase[] = [
  {
    title: 'дефолтный контент, без колбэков',
    node: <EmptyProjectCard />,
  },
  {
    title: 'обе дорожки кликабельны',
    node: <EmptyProjectCard onStart1={() => {}} onStart2={() => {}} />,
  },
  {
    title: 'кастомный контент',
    node: (
      <EmptyProjectCard
        title="Новая история"
        sub="Начните с одного из способов — их можно совместить позже."
        t1Title="1 · С нуля"
        t1Desc="Заполните бриф: жанр, тон, длительность — конвейер соберёт остальное."
        t1Action="Заполнить бриф"
        t1Price="≈ $0.80"
        onStart1={() => {}}
        t2Title="2 · Из префабов"
        t2Desc="Возьмите персонажей, мир или аудио-сет из библиотеки."
        t2Action="Открыть библиотеку"
        onStart2={() => {}}
      />
    ),
  },
];
