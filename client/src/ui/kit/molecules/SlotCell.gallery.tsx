import React from 'react';

import SlotCell from './SlotCell';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SlotCell';

export const cases: GalleryCase[] = [
  { title: 'loc', node: <SlotCell text="КФ" state="loc" /> },
  { title: 'offscreen', node: <SlotCell text="КФ" state="offscreen" /> },
  { title: 'done', node: <SlotCell text="КФ" state="done" /> },
  { title: 'open', node: <SlotCell text="КФ" state="open" /> },
  { title: 'locked', node: <SlotCell text="КФ" state="locked" /> },
  { title: 'failed', node: <SlotCell text="КФ" state="failed" /> },
  { title: 'empty', node: <SlotCell text="—" state="empty" /> },
  { title: 'done · кликабельная', node: <SlotCell text="КФ" state="done" onClick={() => {}} /> },
  { title: 'open · с подсказкой', node: <SlotCell text="КФ" state="open" tip="Кофейня, флешбэк" onClick={() => {}} /> },
];
