import React from 'react';

import BranchTag from './BranchTag';

import type { GalleryCase } from '../galleryTypes';

export const title = 'BranchTag';

export const cases: GalleryCase[] = [
  { title: 'обычная', node: <BranchTag label="ПРИМИРЕНИЕ" tone="обычная" percent={68} /> },
  { title: 'активная', node: <BranchTag label="ПРИМИРЕНИЕ" tone="активная" percent={68} /> },
  { title: 'тихая', node: <BranchTag label="ОТЧУЖДЕНИЕ" tone="тихая" percent={12} /> },
  { title: 'без процента', node: <BranchTag label="ЗАВЯЗКА" tone="обычная" /> },
  { title: 'ноль процентов', node: <BranchTag label="ФИНАЛ" tone="активная" percent={0} /> },
];
