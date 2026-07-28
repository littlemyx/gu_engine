import React from 'react';

import ScheduleTrack from './ScheduleTrack';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ScheduleTrack';

export const cases: GalleryCase[] = [
  {
    title: 'по умолчанию · 21 слот',
    node: <ScheduleTrack label="Асель" />,
  },
  {
    title: 'якорь поверх присутствия · пересечение слотов',
    node: <ScheduleTrack label="Данияр" presence={[{ from: 15, to: 21 }]} meetings={[3]} anchors={[18]} />,
  },
  {
    title: 'без данных · пустая дорожка',
    node: <ScheduleTrack label="Гость" presence={[]} meetings={[]} anchors={[]} />,
  },
  {
    title: 'короткая дорожка · 7 слотов, узкая подпись',
    node: (
      <ScheduleTrack
        label="Ерлан"
        slots={7}
        labelWidth={50}
        width={280}
        presence={[{ from: 1, to: 2 }]}
        meetings={[4]}
        anchors={[7]}
      />
    ),
  },
];
