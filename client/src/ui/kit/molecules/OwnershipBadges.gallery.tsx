import React from 'react';

import OwnershipBadges from './OwnershipBadges';

import type { GalleryCase } from '../galleryTypes';

export const title = 'OwnershipBadges';

export const cases: GalleryCase[] = [
  {
    title: 'ручная · на тёмном',
    dark: true,
    node: <OwnershipBadges ownership="✎ ручная правка" ownerTone="manual" stale="◐ устарело — изменился Б4" />,
  },
  {
    title: 'предложено · на тёмном',
    dark: true,
    node: <OwnershipBadges ownership="⇄ предложено" ownerTone="proposed" />,
  },
  {
    title: 'принято · на тёмном',
    dark: true,
    node: <OwnershipBadges ownership="✓ принято" ownerTone="accepted" />,
  },
  {
    title: 'залочено · на тёмном',
    dark: true,
    node: <OwnershipBadges ownership="▣ залочено" ownerTone="locked" />,
  },
  {
    title: 'только устарело · на тёмном',
    dark: true,
    node: <OwnershipBadges stale="◐ устарело — изменился Б4" />,
  },
  {
    title: 'ручная · на светлом',
    node: (
      <OwnershipBadges
        ownership="✎ ручная правка"
        ownerTone="manual"
        stale="◐ устарело — изменился Б4"
        onDark={false}
      />
    ),
  },
  {
    title: 'принято · на светлом',
    node: <OwnershipBadges ownership="✓ принято" ownerTone="accepted" onDark={false} />,
  },
];
