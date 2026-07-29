import React from 'react';

import ModalCard from './ModalCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ModalCard';

const body = <span>содержимое модала…</span>;

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию (тень, крестик)',
    node: <ModalCard title="Режиссура · веса селектора">{body}</ModalCard>,
  },
  {
    title: 'без крестика (closable=false)',
    node: (
      <ModalCard title="Режиссура · веса селектора" closable={false}>
        {body}
      </ModalCard>
    ),
  },
  {
    title: 'без тени (elevation=false)',
    node: (
      <ModalCard title="Режиссура · веса селектора" elevation={false}>
        {body}
      </ModalCard>
    ),
  },
  {
    title: 'узкая (300px)',
    node: (
      <ModalCard title="Seed" width={300}>
        <span>91427</span>
      </ModalCard>
    ),
  },
  {
    title: 'широкая (600px)',
    node: (
      <ModalCard title="Сборка истории" width={600}>
        {body}
      </ModalCard>
    ),
  },
  {
    title: 'на тёмном фоне (затемнение)',
    dark: true,
    node: <ModalCard title="Режиссура · веса селектора">{body}</ModalCard>,
  },
];
