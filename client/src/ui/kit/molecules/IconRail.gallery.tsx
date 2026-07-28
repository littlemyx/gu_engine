import React from 'react';

import IconRail, { type IconRailItem } from './IconRail';

import type { GalleryCase } from '../galleryTypes';

export const title = 'IconRail';

const ITEMS: IconRailItem[] = [
  { glyph: '≡', label: 'Иерархия — открывается оверлеем' },
  { glyph: '◐', label: 'Префабы' },
  { glyph: '▦', label: 'Ассеты' },
  { glyph: '✓', label: 'QA' },
];

export const cases: GalleryCase[] = [
  { title: 'по умолчанию (пункт 0 активен)', node: <IconRail items={ITEMS} onSelect={() => {}} />, dark: true },
  { title: 'активен пункт 2', node: <IconRail items={ITEMS} active={2} onSelect={() => {}} />, dark: true },
  {
    title: 'с подписью у подножия',
    node: <IconRail items={ITEMS} active={1} note="v2" onSelect={() => {}} />,
    dark: true,
  },
  {
    title: 'один пункт заперт',
    node: (
      <IconRail
        items={[...ITEMS.slice(0, 2), { ...ITEMS[2], disabled: true }, ITEMS[3]]}
        active={0}
        onSelect={() => {}}
      />
    ),
    dark: true,
  },
  { title: 'без onSelect — пункты не интерактивны', node: <IconRail items={ITEMS} note="v2" />, dark: true },
];
