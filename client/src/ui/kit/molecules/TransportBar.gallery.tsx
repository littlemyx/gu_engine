import React from 'react';

import TransportBar from './TransportBar';

import type { GalleryCase } from '../galleryTypes';

export const title = 'TransportBar';

export const cases: GalleryCase[] = [
  {
    title: 'идёт воспроизведение, луп включён',
    node: <TransportBar onPause={() => {}} onStop={() => {}} onRestart={() => {}} onLoop={() => {}} />,
  },
  {
    title: 'на паузе, луп выключен',
    node: (
      <TransportBar
        playing={false}
        loop={false}
        onPause={() => {}}
        onStop={() => {}}
        onRestart={() => {}}
        onLoop={() => {}}
      />
    ),
  },
  {
    title: 'без onStop/onRestart — не интерактивны',
    node: <TransportBar onPause={() => {}} onLoop={() => {}} />,
  },
  {
    title: 'свои подписи и таймкод',
    node: (
      <TransportBar
        pauseLabel="Держим"
        resumeLabel="Дальше"
        stopLabel="■ Прервать"
        restartLabel="⟲ Заново"
        loopLabel="повтор бита"
        time="1:02"
        total="2:15"
        onPause={() => {}}
        onStop={() => {}}
        onRestart={() => {}}
        onLoop={() => {}}
      />
    ),
  },
];
