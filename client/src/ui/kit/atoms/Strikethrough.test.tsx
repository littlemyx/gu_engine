/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Strikethrough, { type StrikethroughTone } from './Strikethrough';

afterEach(cleanup);

const TONES: StrikethroughTone[] = ['accent', 'plain'];

describe('Strikethrough, без нового значения', () => {
  it('показывает только старое значение зачёркнутым', () => {
    render(<Strikethrough oldValue="≈$0.04" />);

    expect(screen.getByText('≈$0.04')).toBeTruthy();
    expect(screen.queryByText('→')).toBeNull();
  });
});

describe.each(TONES)('Strikethrough, тон %s', tone => {
  it('показывает старое и новое значение со стрелкой между ними', () => {
    render(<Strikethrough oldValue="≈$0.04" newValue="≈$0.02" newTone={tone} />);

    expect(screen.getByText('≈$0.04')).toBeTruthy();
    expect(screen.getByText('→')).toBeTruthy();
    expect(screen.getByText('≈$0.02')).toBeTruthy();
  });
});

describe('Strikethrough на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<Strikethrough oldValue="≈$0.04" newValue="≈$0.02" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Strikethrough oldValue="≈$0.04" newValue="≈$0.02" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});

describe('Strikethrough, размер', () => {
  it('по умолчанию берёт кегль 10.5px', () => {
    const { container } = render(<Strikethrough oldValue="≈$0.04" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.fontSize).toBe('10.5px');
  });

  it('принимает кастомный кегль', () => {
    const { container } = render(<Strikethrough oldValue="≈$0.04" size={13} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.fontSize).toBe('13px');
  });
});
