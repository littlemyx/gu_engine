import React from 'react';

import CastRow from './CastRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'CastRow';

export const cases: GalleryCase[] = [
  {
    title: 'нерактивная строка (без onClick/onEdit)',
    node: <CastRow name="Кира" description="староста потока · enemies_to_lovers · очки в тонкой оправе" />,
  },
  {
    title: 'кликабельная строка (onClick)',
    node: (
      <CastRow
        name="Кира"
        description="староста потока · enemies_to_lovers · очки в тонкой оправе"
        onClick={() => {}}
      />
    ),
  },
  {
    title: 'с кнопкой правки (onClick + onEdit)',
    node: (
      <CastRow
        name="Марк"
        description="капитан баскетбольной · burn_notice · шрам над бровью"
        onClick={() => {}}
        onEdit={() => {}}
      />
    ),
  },
  {
    title: 'узкая строка (width=260)',
    node: (
      <CastRow
        name="Алина"
        description="лучшая подруга героини, знает все секреты и не молчит об этом"
        width={260}
        onClick={() => {}}
        onEdit={() => {}}
      />
    ),
  },
  {
    title: 'широкая строка (width=520)',
    node: (
      <CastRow
        name="Тео"
        description="сосед по общежитию · slow_burn · вечно с гитарой на плече, поёт под окном"
        width={520}
        onClick={() => {}}
        onEdit={() => {}}
      />
    ),
  },
];
