import React from 'react';

import InspectorSection from './InspectorSection';

import type { GalleryCase } from '../galleryTypes';

export const title = 'InspectorSection';

const BODY = 'План генерируется поэтапно: хребет → окна битов → лестницы каста → пул событий.';

export const cases: GalleryCase[] = [
  {
    title: 'на тёмном · развёрнуто',
    dark: true,
    node: <InspectorSection title="Готовность · 6/6" body={BODY} open onDark />,
  },
  {
    title: 'на тёмном · свёрнуто',
    dark: true,
    node: <InspectorSection title="Готовность · 6/6" body={BODY} open={false} onDark />,
  },
  {
    title: 'на тёмном · кликабельный заголовок',
    dark: true,
    node: (
      <InspectorSection
        title="Готовность · 6/6"
        body={BODY}
        open
        onDark
        onToggle={() => {
          /* демонстрация в галерее */
        }}
      />
    ),
  },
  {
    title: 'на светлом · развёрнуто',
    node: <InspectorSection title="Готовность · 6/6" body={BODY} open />,
  },
  {
    title: 'на светлом · свёрнуто',
    node: <InspectorSection title="Готовность · 6/6" body={BODY} open={false} />,
  },
  {
    title: 'произвольное содержимое (children)',
    node: (
      <InspectorSection title="Замечания критика" open>
        <ul>
          <li>Бит Б5 короче остальных вдвое.</li>
          <li>Реплика Марты повторяет реплику из Б3.</li>
        </ul>
      </InspectorSection>
    ),
  },
];
