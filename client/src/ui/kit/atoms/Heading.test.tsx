/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import Heading, { type HeadingLevel } from './Heading';

afterEach(cleanup);

const LEVELS: HeadingLevel[] = ['card', 'modal', 'screen'];

describe.each(LEVELS)('Heading, ступень %s', level => {
  it('показывает текст', () => {
    render(<Heading text="Заголовок панели" level={level} />);
    expect(screen.getByText('Заголовок панели')).toBeTruthy();
  });
});

describe('Heading, регистр', () => {
  it('по умолчанию заглавные буквы включены', () => {
    render(<Heading text="Заголовок" />);
    const el = screen.getByText('Заголовок');
    expect(el.className).toContain('uppercase');
  });

  it('uppercase={false} снимает трансформацию регистра', () => {
    render(<Heading text="Заголовок" uppercase={false} />);
    const el = screen.getByText('Заголовок');
    expect(el.className).not.toContain('uppercase');
  });
});

describe('Heading на тёмном', () => {
  it('получает отдельный класс, а не тот же, что на светлом', () => {
    const { container: light } = render(<Heading text="X" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Heading text="X" onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });
});

describe('Heading, размер поверх ступени', () => {
  it('проп size выставляет инлайновый font-size', () => {
    render(<Heading text="Заголовок" size={22} />);
    const el = screen.getByText('Заголовок');
    expect(el.style.fontSize).toBe('22px');
  });

  it('без size инлайновый стиль не задаётся', () => {
    render(<Heading text="Заголовок" />);
    const el = screen.getByText('Заголовок');
    expect(el.style.fontSize).toBe('');
  });
});
