import React from 'react';

import Dimming from './Dimming';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Dimming';

const Box = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, fontFamily: 'var(--font-body)' }}>{children}</div>
);

export const cases: GalleryCase[] = [
  {
    title: 'level по умолчанию (0.4)',
    node: (
      <Dimming>
        <Box>Д2в · Кафе — вне ветки</Box>
      </Dimming>
    ),
  },
  {
    title: 'level 0.15 (почти невидимо)',
    node: (
      <Dimming level={0.15}>
        <Box>Д2в · Кафе — вне ветки</Box>
      </Dimming>
    ),
  },
  {
    title: 'level 1 (без приглушения)',
    node: (
      <Dimming level={1}>
        <Box>Д2в · Кафе — вне ветки</Box>
      </Dimming>
    ),
  },
  {
    title: 'без содержимого — placeholder',
    node: <Dimming placeholder="Д2в · Кафе — вне ветки" />,
  },
  {
    title: 'на тёмном · placeholder',
    dark: true,
    node: <Dimming placeholder="Д2в · Кафе — вне ветки" onDark />,
  },
];
