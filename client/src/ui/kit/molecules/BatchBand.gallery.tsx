import React from 'react';

import BatchBand from './BatchBand';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BatchBand';

export const cases: GalleryCase[] = [
  {
    title: 'акцентная (порция)',
    node: <BatchBand label="ПОРЦИЯ 2 · СТУПЕНЬ 2 · КИРА — ИДЁТ" meta="4/9" tone="accent" />,
  },
  {
    title: 'тихая (секция)',
    node: <BatchBand label="СЕКЦИЯ 3 · ЗАВЯЗКА" meta="2/5" tone="quiet" />,
  },
  {
    title: 'без счётчика',
    node: <BatchBand label="ПОРЦИЯ 1 · СТУПЕНЬ 1 · ВСТУПЛЕНИЕ" tone="accent" />,
  },
  {
    title: 'длинная подпись — обрезка многоточием',
    node: (
      <div style={{ width: 220 }}>
        <BatchBand
          label="ПОРЦИЯ 5 · СТУПЕНЬ 4 · ОЧЕНЬ ДЛИННОЕ ИМЯ ПЕРСОНАЖА — ИДЁТ И ПРОДОЛЖАЕТСЯ"
          meta="9/9"
          tone="quiet"
        />
      </div>
    ),
  },
];
