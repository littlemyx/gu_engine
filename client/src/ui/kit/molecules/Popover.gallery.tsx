import React from 'react';

import Popover from './Popover';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Popover';

const HINT = 'тот же seed + тот же бриф = тот же план. Меняет только жребий среди равноценных';

export const cases: GalleryCase[] = [
  {
    title: 'раскрыт, на светлом',
    node: (
      <Popover
        anchor="seed 91427"
        kicker="Seed прогона"
        value="91427"
        actionLabel="Перебросить"
        hint={HINT}
        open
        onToggle={() => {}}
      />
    ),
  },
  {
    title: 'свёрнут, на светлом',
    node: (
      <Popover
        anchor="seed 91427"
        kicker="Seed прогона"
        value="91427"
        actionLabel="Перебросить"
        hint={HINT}
        open={false}
        onToggle={() => {}}
      />
    ),
  },
  {
    title: 'раскрыт, на тёмном',
    dark: true,
    node: (
      <Popover
        anchor="seed 91427"
        kicker="Seed прогона"
        value="91427"
        actionLabel="Перебросить"
        hint={HINT}
        open
        onDark
        onToggle={() => {}}
      />
    ),
  },
  {
    title: 'свёрнут, на тёмном',
    dark: true,
    node: (
      <Popover
        anchor="seed 91427"
        kicker="Seed прогона"
        value="91427"
        actionLabel="Перебросить"
        hint={HINT}
        open={false}
        onDark
        onToggle={() => {}}
      />
    ),
  },
  {
    title: 'без колбэков (немая)',
    node: (
      <Popover anchor="seed 91427" kicker="Seed прогона" value="91427" actionLabel="Перебросить" hint={HINT} open />
    ),
  },
  {
    title: 'узкая панель',
    node: (
      <Popover
        anchor="seed 91427"
        kicker="Seed прогона"
        value="91427"
        actionLabel="Перебросить"
        hint={HINT}
        open
        width={180}
        onToggle={() => {}}
      />
    ),
  },
];
