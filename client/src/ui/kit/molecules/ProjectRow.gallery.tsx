import React from 'react';

import ProjectRow from './ProjectRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ProjectRow';

const noop = () => {
  /* демонстрация в галерее */
};

export const cases: GalleryCase[] = [
  {
    title: 'обычная',
    node: <ProjectRow name="Осенний семестр" meta="изменён 12 минут назад" onOpen={noop} />,
  },
  {
    title: 'обычная, без onOpen (не кликабельна)',
    node: <ProjectRow name="Осенний семестр" meta="изменён 12 минут назад" />,
  },
  {
    title: 'без названия (unnamed)',
    node: <ProjectRow name="без названия" meta="создан только что" unnamed onOpen={noop} />,
  },
  {
    title: 'подтверждение удаления',
    node: (
      <ProjectRow name="Осенний семестр" meta="изменён 12 минут назад" state="подтверждение удаления" onDelete={noop} />
    ),
  },
  {
    title: 'узкая строка (width 300)',
    node: (
      <ProjectRow
        name="Очень длинное название проекта, которое обрежется многоточием"
        meta="изменён вчера"
        width={300}
        onOpen={noop}
      />
    ),
  },
];
