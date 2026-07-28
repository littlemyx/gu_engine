/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import TextLabel from './TextLabel';

afterEach(cleanup);

describe('TextLabel', () => {
  it('показывает текст', () => {
    render(<TextLabel text="Слот сцены" />);

    expect(screen.getByText('Слот сцены')).toBeTruthy();
  });

  it('на тёмном получает отдельный класс', () => {
    const { container: light } = render(<TextLabel text="Слот сцены" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<TextLabel text="Слот сцены" onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });

  it('bold получает отдельный класс', () => {
    const { container: regular } = render(<TextLabel text="Слот сцены" />);
    const regularClass = regular.firstElementChild?.className ?? '';
    cleanup();

    const { container: bold } = render(<TextLabel text="Слот сцены" bold />);
    expect(bold.firstElementChild?.className).not.toBe(regularClass);
  });

  it('size управляет инлайновым font-size', () => {
    render(<TextLabel text="Слот сцены" size={14} />);

    const node = screen.getByText('Слот сцены') as HTMLElement;
    expect(node.style.fontSize).toBe('14px');
  });

  it('по умолчанию размер 11.5px', () => {
    render(<TextLabel text="Слот сцены" />);

    const node = screen.getByText('Слот сцены') as HTMLElement;
    expect(node.style.fontSize).toBe('11.5px');
  });
});
