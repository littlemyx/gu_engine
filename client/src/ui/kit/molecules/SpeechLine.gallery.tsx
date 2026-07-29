import React from 'react';

import SpeechLine from './SpeechLine';

import type { GalleryCase } from '../galleryTypes';

export const title = 'SpeechLine';

export const cases: GalleryCase[] = [
  {
    title: 'с эмоцией',
    node: <SpeechLine name="Мия" emotion="нежно" text="«Ты правда дождался меня после пары?»" />,
  },
  {
    title: 'без эмоции',
    node: <SpeechLine name="Дэн" text="Конечно. А ты сомневалась?" />,
  },
  {
    title: 'широкая карточка',
    node: (
      <SpeechLine
        name="Мия"
        emotion="удивлённо"
        text="«Ты серьёзно всё это время меня ждал под дождём? Я думала, ты уже дома»"
        width={640}
      />
    ),
  },
];
