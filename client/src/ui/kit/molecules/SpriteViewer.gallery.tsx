import React from 'react';

import SpriteViewer from './SpriteViewer';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SpriteViewer';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию (бейдж + подпись)',
    node: <SpriteViewer />,
  },
  {
    title: 'без бейджа',
    node: <SpriteViewer badge="" />,
  },
  {
    title: 'без подписи',
    node: <SpriteViewer caption="" />,
  },
  {
    title: 'без бейджа и подписи',
    node: <SpriteViewer badge="" caption="" />,
  },
  {
    title: 'другой контент бейджа/подписи',
    node: <SpriteViewer badge="ещё не сгенерирован" caption=":3007/images/mia_stern.png;poseFilenames.stern" />,
  },
  {
    title: 'узкая (width=140)',
    node: <SpriteViewer width={140} />,
  },
  {
    title: 'широкая (width=340)',
    node: <SpriteViewer width={340} />,
  },
];
