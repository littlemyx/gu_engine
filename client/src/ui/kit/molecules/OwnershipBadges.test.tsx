/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import OwnershipBadges, { type OwnershipTone } from './OwnershipBadges';

afterEach(cleanup);

const OWNER_TONES: OwnershipTone[] = ['manual', 'proposed', 'accepted', 'locked'];

describe.each(OWNER_TONES)('OwnershipBadges, ownerTone %s', ownerTone => {
  it('показывает бейдж владения', () => {
    render(<OwnershipBadges ownership="✎ ручная правка" ownerTone={ownerTone} />);

    expect(screen.getByText('✎ ручная правка')).toBeTruthy();
  });
});

describe('OwnershipBadges, необязательность бейджей', () => {
  it('без ownership бейдж владения не рисуется', () => {
    render(<OwnershipBadges stale="◐ устарело — изменился Б4" />);

    expect(screen.queryByText(/ручная/)).toBeNull();
    expect(screen.getByText('◐ устарело — изменился Б4')).toBeTruthy();
  });

  it('без stale бейдж устаревания не рисуется', () => {
    render(<OwnershipBadges ownership="✎ ручная правка" />);

    expect(screen.queryByText(/устарело/)).toBeNull();
    expect(screen.getByText('✎ ручная правка')).toBeTruthy();
  });

  it('без обоих текстов ничего не рисуется', () => {
    const { container } = render(<OwnershipBadges />);

    expect(container.querySelectorAll('span').length).toBe(0);
  });
});

describe('OwnershipBadges, светлое/тёмное', () => {
  it('на тёмном хроме по умолчанию', () => {
    const { container: dark } = render(<OwnershipBadges ownership="✎ ручная правка" />);
    const darkClass = dark.querySelector('span')?.className ?? '';
    cleanup();

    const { container: light } = render(<OwnershipBadges ownership="✎ ручная правка" onDark={false} />);
    const lightClass = light.querySelector('span')?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});

describe('OwnershipBadges, интерактивность', () => {
  it('бейджи не кликабельны', () => {
    render(<OwnershipBadges ownership="✎ ручная правка" stale="◐ устарело — изменился Б4" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
