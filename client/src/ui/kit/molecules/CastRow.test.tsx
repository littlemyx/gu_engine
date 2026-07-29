/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import CastRow from './CastRow';

afterEach(cleanup);

describe('CastRow', () => {
  it('показывает имя и мета-строку', () => {
    render(<CastRow name="Кира" description="староста потока · enemies_to_lovers" />);
    expect(screen.getByText('Кира')).toBeTruthy();
    expect(screen.getByText('староста потока · enemies_to_lovers')).toBeTruthy();
  });

  it('без onClick строка не кликабельна', () => {
    render(<CastRow name="Кира" description="мета" />);
    expect(screen.queryByRole('button', { name: /Кира/ })).toBeNull();
  });

  it('с onClick строка получает role="button" и вызывает колбэк по клику', () => {
    let clicked = 0;
    render(<CastRow name="Кира" description="мета" onClick={() => (clicked += 1)} />);
    const row = screen.getByRole('button', { name: /Кира/ });
    fireEvent.click(row);
    expect(clicked).toBe(1);
  });

  it('с onClick строка реагирует на Enter и пробел', () => {
    let clicked = 0;
    render(<CastRow name="Кира" description="мета" onClick={() => (clicked += 1)} />);
    const row = screen.getByRole('button', { name: /Кира/ });
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.keyDown(row, { key: ' ' });
    expect(clicked).toBe(2);
  });

  it('без onEdit значок правки не кликабелен', () => {
    render(<CastRow name="Кира" description="мета" />);
    expect(screen.queryByRole('button', { name: 'редактировать' })).toBeNull();
  });

  it('с onEdit клик по значку вызывает колбэк и не всплывает до строки', () => {
    let editClicked = 0;
    let rowClicked = 0;
    render(
      <CastRow name="Кира" description="мета" onClick={() => (rowClicked += 1)} onEdit={() => (editClicked += 1)} />,
    );
    const editButton = screen.getByRole('button', { name: 'редактировать' });
    fireEvent.click(editButton);
    expect(editClicked).toBe(1);
    expect(rowClicked).toBe(0);
  });

  it('width применяется инлайновым стилем к корню строки', () => {
    const { container } = render(<CastRow name="Кира" description="мета" width={320} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('320px');
  });
});
