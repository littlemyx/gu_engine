import React from 'react';

import ReadinessRow from './ReadinessRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ReadinessRow';

export const cases: GalleryCase[] = [
  { title: 'готово', dark: true, node: <ReadinessRow text="логлайн и тон" state="done" /> },
  { title: 'проблема', dark: true, node: <ReadinessRow text="каст: нет любовной линии" state="problem" /> },
  { title: 'ожидает', dark: true, node: <ReadinessRow text="мир: календарь не собран" state="waiting" /> },
];
