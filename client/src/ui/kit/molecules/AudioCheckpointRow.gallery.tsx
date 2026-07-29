import React from 'react';

import AudioCheckpointRow from './AudioCheckpointRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'AudioCheckpointRow';

export const cases: GalleryCase[] = [
  { title: 'ждёт · по умолчанию', node: <AudioCheckpointRow name="audio_pier_evening" /> },
  { title: 'решён · по умолчанию', node: <AudioCheckpointRow name="audio_pier_evening" state="решён" /> },
  {
    title: 'решён · произвольный текст статуса',
    node: <AudioCheckpointRow name="audio_market_noise" statusText="дубль от Иры" state="решён" />,
  },
  {
    title: 'ждёт · кликабельная строка',
    node: <AudioCheckpointRow name="audio_pier_evening" onClick={() => {}} />,
  },
  {
    title: 'решён · кликабельная строка',
    node: <AudioCheckpointRow name="audio_pier_evening" state="решён" onClick={() => {}} />,
  },
];
