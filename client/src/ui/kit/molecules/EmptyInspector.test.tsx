/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import EmptyInspector from './EmptyInspector';

afterEach(cleanup);

describe('EmptyInspector', () => {
  it('показывает каждую переданную строку', () => {
    render(<EmptyInspector lines={['Ничего не выбрано.', 'Выберите узел в иерархии или объект на чертеже.']} />);
    expect(screen.getByText('Ничего не выбрано.')).toBeTruthy();
    expect(screen.getByText('Выберите узел в иерархии или объект на чертеже.')).toBeTruthy();
  });

  it('рендерит одну строку без падения', () => {
    render(<EmptyInspector lines={['Пусто.']} />);
    expect(screen.getByText('Пусто.')).toBeTruthy();
  });

  it('на светлом и на тёмном хроме получает разные классы', () => {
    const { container: light } = render(<EmptyInspector lines={['мета']} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<EmptyInspector lines={['мета']} onDark />);
    const darkClass = dark.firstElementChild?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
  });

  it('не кликабельна — кнопок внутри нет', () => {
    const { container } = render(<EmptyInspector lines={['Ничего не выбрано.']} />);
    expect(container.querySelector('button')).toBeNull();
  });
});
