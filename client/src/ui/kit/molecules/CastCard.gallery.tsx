import React from 'react';

import CastCard from './CastCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CastCard';

export const cases: GalleryCase[] = [
  {
    title: 'обычная',
    node: (
      <CastCard
        name="Юки"
        meta="20 · slow_burn"
        role="тихая художница, подрабатывает в кафе «Прибой»"
        speech="мягкая, с паузами, много «наверное»"
        traits={['застенчивая', 'наблюдательная', 'верная']}
      />
    ),
  },
  {
    title: 'выбрана (selected)',
    node: (
      <CastCard
        name="Юки"
        meta="20 · slow_burn"
        role="тихая художница, подрабатывает в кафе «Прибой»"
        speech="мягкая, с паузами, много «наверное»"
        traits={['застенчивая', 'наблюдательная', 'верная']}
        selected
      />
    ),
  },
  {
    title: 'кликабельная карточка + редактирование',
    node: (
      <CastCard
        name="Феликс"
        meta="24 · rival"
        role="капитан гребной команды, вечно опаздывает"
        speech="резкая, короткие фразы"
        traits={['упрямый', 'вспыльчивый']}
        onClick={() => {}}
        onEdit={() => {}}
      />
    ),
  },
  {
    title: 'минимум данных — только имя',
    node: <CastCard name="???" />,
  },
  {
    title: 'узкая карточка (width=260)',
    node: <CastCard name="Ада" meta="19" role="программирует драм-машины" traits={['саркастичная']} width={260} />,
  },
];
