import React from 'react';

import SpriteStage from './SpriteStage';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SpriteStage';

export const cases: GalleryCase[] = [
  {
    title: 'говорит справа (по умолчанию)',
    node: <SpriteStage />,
  },
  {
    title: 'говорит слева',
    node: <SpriteStage speaking="слева" />,
  },
  {
    title: 'никто не говорит',
    node: <SpriteStage speaking="никто" />,
  },
  {
    title: 'другие подписи',
    node: <SpriteStage leftLabel="left · kira_idle" rightLabel="right · asel_stern" speaking="слева" />,
  },
  {
    title: 'узкая сцена (width=260)',
    node: <SpriteStage width={260} />,
  },
  {
    title: 'широкая сцена (width=700)',
    node: <SpriteStage width={700} speaking="слева" />,
  },
];
