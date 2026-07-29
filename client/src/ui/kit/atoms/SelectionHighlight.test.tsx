/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SelectionHighlight, {
  type SelectionHighlightOutlineTone,
  type SelectionHighlightVariant,
} from './SelectionHighlight';

afterEach(cleanup);

const VARIANTS: SelectionHighlightVariant[] = ['row', 'cell', 'outline', 'ring'];

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

describe('SelectionHighlight, вариант ring (внешнее кольцо)', () => {
  it('по умолчанию отступает на 2px', () => {
    const { container } = render(<SelectionHighlight variant="ring">x</SelectionHighlight>);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.outlineOffset).toBe('2px');
  });

  it('принимает произвольный outlineOffset пропом', () => {
    const { container } = render(
      <SelectionHighlight variant="ring" outlineOffset={6}>
        x
      </SelectionHighlight>,
    );
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.outlineOffset).toBe('6px');
  });

  it('не задаёт outlineOffset у остальных вариантов', () => {
    const { container } = render(<SelectionHighlight variant="outline">x</SelectionHighlight>);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.outlineOffset).toBe('');
  });

  const TONES: SelectionHighlightOutlineTone[] = ['accent', 'accent-900'];

  it.each(TONES)('получает отдельный класс для тона %s', tone => {
    const { container } = render(
      <SelectionHighlight variant="ring" outlineTone={tone}>
        x
      </SelectionHighlight>,
    );
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain(tone === 'accent' ? 'toneAccent' : 'toneAccent900');
  });

  it('по умолчанию использует accent-900, как в макете', () => {
    const { container } = render(<SelectionHighlight variant="ring">x</SelectionHighlight>);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain('toneAccent900');
  });

  it('на тёмном хроме получает отдельный класс', () => {
    const { container: light } = render(<SelectionHighlight variant="ring">x</SelectionHighlight>);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(
      <SelectionHighlight variant="ring" onDark>
        x
      </SelectionHighlight>,
    );
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});
