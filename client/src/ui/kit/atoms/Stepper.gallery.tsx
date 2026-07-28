import React from 'react';

import Stepper from './Stepper';

import type { GalleryCase } from '../galleryTypes';

export const title = 'Stepper';

export const cases: GalleryCase[] = [
  { title: 'по умолчанию', node: <Stepper /> },
  { title: 'с единицей', node: <Stepper value={7} unit="сек" label="таймер" /> },
  { title: 'без подписи', node: <Stepper value={12} showLabel={false} /> },
  { title: 'у границы max', node: <Stepper value={9} max={9} label="слотов" /> },
  { title: 'disabled', node: <Stepper value={4} disabled /> },
];
