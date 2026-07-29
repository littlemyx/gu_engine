import React from 'react';

import LabeledField from './LabeledField';

import type { GalleryCase } from '../galleryTypes';

export const title = 'LabeledField';

export const cases: GalleryCase[] = [
  { title: 'обычное', node: <LabeledField label="Эпоха" value="Современность" /> },
  { title: 'обязательное', node: <LabeledField label="Эпоха" value="Современность" required /> },
  { title: 'с подсказкой', node: <LabeledField label="Эпоха" value="Современность" hint="можно оставить пустым" /> },
  {
    title: 'стрелка ▴▾',
    node: <LabeledField label="Эпоха" value="Современность" arrow="updown" />,
  },
  { title: 'без стрелки', node: <LabeledField label="Эпоха" value="Современность" arrow="none" /> },
  { title: 'пустое', node: <LabeledField label="Эпоха" /> },
  {
    title: 'ошибка',
    node: <LabeledField label="Эпоха" required error errorHint="обязательное — без него не посчитать слоты" />,
  },
  {
    title: 'ошибка со значением',
    node: <LabeledField label="Эпоха" value="Современность" error hint="уточните эпоху" />,
  },
  { title: 'узкое, width=140', node: <LabeledField label="Каст" value="3" width={140} /> },
];
