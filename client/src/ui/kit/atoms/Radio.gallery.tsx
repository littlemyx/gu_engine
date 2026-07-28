import React from 'react';

import Radio from './Radio';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Radio';

export const cases: GalleryCase[] = [
  { title: 'checked', node: <Radio label="по порядку" checked onChange={() => {}} /> },
  { title: 'unchecked', node: <Radio label="вперемешку" checked={false} onChange={() => {}} /> },
  { title: 'disabled, checked', node: <Radio label="по порядку" checked disabled onChange={() => {}} /> },
  { title: 'disabled, unchecked', node: <Radio label="вперемешку" checked={false} disabled onChange={() => {}} /> },
  { title: 'без подписи', node: <Radio label="по порядку" checked showLabel={false} onChange={() => {}} /> },
  { title: 'немой индикатор (без onChange)', node: <Radio label="по порядку" checked /> },
];
