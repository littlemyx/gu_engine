import React from 'react';

import AudioTrackRow from './AudioTrackRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'AudioTrackRow';

export const cases: GalleryCase[] = [
  { title: 'по умолчанию', node: <AudioTrackRow trackName="тема_главная.mp3" /> },
  { title: 'playing · проигрывается', node: <AudioTrackRow trackName="тема_главная.mp3" duration="1:48" playing /> },
  {
    title: 'override · заменён вручную',
    node: <AudioTrackRow trackName="эмбиент_ночь.mp3" duration="0:47" override />,
  },
  {
    title: 'playing + override',
    node: <AudioTrackRow trackName="бой_финал.mp3" duration="3:02" playing override />,
  },
  {
    title: 'кликабельная строка',
    node: <AudioTrackRow trackName="тема_главная.mp3" duration="2:14" onClick={() => {}} />,
  },
];
