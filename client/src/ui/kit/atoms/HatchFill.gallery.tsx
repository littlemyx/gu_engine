import React from 'react';

import HatchFill from './HatchFill';

import type { GalleryCase } from '../galleryTypes';

export const title = 'HatchFill';

const Slot = ({ children }: { children: React.ReactNode }) => <div style={{ width: 160, height: 80 }}>{children}</div>;

export const cases: GalleryCase[] = [
  {
    title: 'пусто · note по умолчанию',
    node: (
      <Slot>
        <HatchFill />
      </Slot>
    ),
  },
  {
    title: 'своя note',
    node: (
      <Slot>
        <HatchFill note="ещё не сгенерировано" />
      </Slot>
    ),
  },
  {
    title: 'без note',
    node: (
      <Slot>
        <HatchFill note="" />
      </Slot>
    ),
  },
  {
    title: 'с содержимым',
    node: (
      <Slot>
        <HatchFill>
          <span style={{ fontSize: 11 }}>эскиз</span>
        </HatchFill>
      </Slot>
    ),
  },
  {
    title: 'узкий шаг штриховки',
    node: (
      <Slot>
        <HatchFill step={4} />
      </Slot>
    ),
  },
  {
    title: 'на тёмном',
    dark: true,
    node: (
      <Slot>
        <HatchFill onDark />
      </Slot>
    ),
  },
  {
    title: 'на тёмном · с содержимым',
    dark: true,
    node: (
      <Slot>
        <HatchFill onDark>
          <span style={{ fontSize: 11, color: 'var(--gu-ink-85)' }}>эскиз</span>
        </HatchFill>
      </Slot>
    ),
  },
  {
    title: 'тон accent',
    node: (
      <Slot>
        <HatchFill tone="accent" />
      </Slot>
    ),
  },
  {
    title: 'тон accent · своя note',
    node: (
      <Slot>
        <HatchFill tone="accent" note="ещё не написано" />
      </Slot>
    ),
  },
  {
    title: 'тон accent · узкий шаг (как SpineBar)',
    node: (
      <Slot>
        <HatchFill tone="accent" step={4} note="" />
      </Slot>
    ),
  },
];
