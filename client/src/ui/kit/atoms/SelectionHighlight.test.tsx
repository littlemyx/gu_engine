/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SelectionHighlight, { type SelectionHighlightVariant } from './SelectionHighlight';

afterEach(cleanup);

const VARIANTS: SelectionHighlightVariant[] = ['row', 'cell', 'outline'];

describe.each(VARIANTS)('SelectionHighlight, вариант %s', variant => {
  it('оборачивает содержимое, не съедая его', () => {
    render(
      <SelectionHighlight variant={variant}>
        <span>выбранная строка</span>
      </SelectionHighlight>,
    );

    expect(screen.getByText('выбранная строка')).toBeTruthy();
  });
});

describe('SelectionHighlight, отступ', () => {
  it('применяет padding пропсом', () => {
    const { container } = render(<SelectionHighlight padding={12}>x</SelectionHighlight>);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.padding).toBe('12px');
  });

  it('по умолчанию использует 8px', () => {
    const { container } = render(<SelectionHighlight>x</SelectionHighlight>);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.padding).toBe('8px');
  });
});

describe('SelectionHighlight на тёмном', () => {
  it.each(VARIANTS)('получает отдельный класс для %s, а не тот же, что на светлом', variant => {
    const { container: light } = render(<SelectionHighlight variant={variant} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<SelectionHighlight variant={variant} onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
