/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ConflictNote from './ConflictNote';

afterEach(cleanup);

const SAMPLE_TEXT = '▣ × ◐ — конфликт: залочено и устарело. Система не решает — решаете вы.';

describe('ConflictNote', () => {
  it('показывает текст предупреждения', () => {
    render(<ConflictNote text={SAMPLE_TEXT} />);
    expect(screen.getByText(SAMPLE_TEXT)).toBeTruthy();
  });

  it('по умолчанию на светлом хроме', () => {
    render(<ConflictNote text="конфликт" />);
    const root = screen.getByText('конфликт');
    expect(root.className).not.toContain('dark');
  });

  it('на тёмном хроме получает отдельный класс', () => {
    const { container: light } = render(<ConflictNote text="конфликт" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<ConflictNote text="конфликт" onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });

  it('не рендерит кнопку — заметка некликабельна', () => {
    render(<ConflictNote text="конфликт" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('корневой узел — простой div без фокусируемости', () => {
    const { container } = render(<ConflictNote text="конфликт" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.tagName).toBe('DIV');
    expect(root.getAttribute('tabindex')).toBeNull();
  });
});
