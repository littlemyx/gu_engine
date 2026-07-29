import React from 'react';

import VariantCard from './VariantCard';

import type { GalleryCase } from '../galleryTypes';

export const title = 'VariantCard';

export const cases: GalleryCase[] = [
  {
    title: 'A · играет',
    node: <VariantCard letter="A" label="▸ 1:48 · спокойный, гитара" playing progress={34} />,
  },
  {
    title: 'B · ждёт',
    node: <VariantCard letter="B" label="▸ 2:05 · тревожный, струнные" playing={false} />,
  },
  {
    title: 'кликабельная (наведи/нажми)',
    node: <VariantCard letter="A" label="▸ 1:48 · спокойный, гитара" playing={false} onClick={() => {}} />,
  },
  {
    title: 'A · играет · на тёмном',
    dark: true,
    node: <VariantCard letter="A" label="▸ 1:48 · спокойный, гитара" playing progress={62} onDark onClick={() => {}} />,
  },
  {
    title: 'B · ждёт · на тёмном',
    dark: true,
    node: <VariantCard letter="B" label="▸ 2:05 · тревожный, струнные" playing={false} onDark />,
  },
];
