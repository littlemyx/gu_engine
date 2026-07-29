import React from 'react';

import ConsequenceRow from './ConsequenceRow';

import type { GalleryCase } from '../galleryTypes';

export const title = 'ConsequenceRow';

export const cases: GalleryCase[] = [
  {
    title: 'глиф ◐ — протухнет, активная',
    node: <ConsequenceRow glyph="◐" text="Проза — протухнут 44 юнита + 2 концовки" action="довести ≈$5.10" />,
  },
  {
    title: 'глиф ● — готово',
    node: <ConsequenceRow glyph="●" text="Каст-план — пересчитан под новую ветку" action="принять" />,
  },
  {
    title: 'глиф ▣ — артефакт',
    node: <ConsequenceRow glyph="▣" text="Спайн — 3 бита ушли в архив" action="просмотреть" />,
  },
  {
    title: 'глиф ✎ — правка вручную',
    node: <ConsequenceRow glyph="✎" text="Мировой календарь — авторская правка расходится" action="разрешить" />,
  },
  {
    title: 'тихая строка',
    node: (
      <ConsequenceRow glyph="◐" text="Проза — протухнут 44 юнита + 2 концовки" action="довести ≈$5.10" active={false} />
    ),
  },
  {
    title: 'без разделителя (последняя строка списка)',
    node: (
      <ConsequenceRow
        glyph="◐"
        text="Проза — протухнут 44 юнита + 2 концовки"
        action="довести ≈$5.10"
        divider={false}
      />
    ),
  },
];
