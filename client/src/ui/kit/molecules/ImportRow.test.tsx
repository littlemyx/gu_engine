/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ImportRow, { type ImportRowState } from './ImportRow';

afterEach(cleanup);

const STATES: ImportRowState[] = ['ок', 'предупреждение', 'пропуск'];

describe.each(STATES)('ImportRow, состояние %s', state => {
  it('показывает путь и значение', () => {
    render(<ImportRow path="world.setting" value="университет · современность" state={state} />);

    expect(screen.getByText('world.setting')).toBeTruthy();
    expect(screen.getByText('университет · современность')).toBeTruthy();
  });

  it('рисует глиф статуса', () => {
    render(<ImportRow path="world.setting" value="университет" state={state} />);

    expect(screen.getByRole('img')).toBeTruthy();
  });

  it('не рендерит кнопку — строка не кликабельна', () => {
    render(<ImportRow path="world.setting" value="университет" state={state} />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('ImportRow, дефолт состояния', () => {
  it('без state рендерит «ок»', () => {
    render(<ImportRow path="world.setting" value="университет" />);

    expect(screen.getByRole('img', { name: 'ok' })).toBeTruthy();
  });
});

describe('ImportRow, соответствие глифа состоянию', () => {
  it('«ок» рисует глиф ok', () => {
    render(<ImportRow path="world.setting" value="университет" state="ок" />);
    expect(screen.getByRole('img', { name: 'ok' })).toBeTruthy();
  });

  it('«предупреждение» рисует глиф warn', () => {
    render(<ImportRow path="world.setting" value="университет" state="предупреждение" />);
    expect(screen.getByRole('img', { name: 'warn' })).toBeTruthy();
  });

  it('«пропуск» рисует глиф none', () => {
    render(<ImportRow path="world.setting" value="университет" state="пропуск" />);
    expect(screen.getByRole('img', { name: 'none' })).toBeTruthy();
  });
});

describe('ImportRow, размеры колонок', () => {
  it('pathWidth задаёт ширину колонки пути', () => {
    const { container } = render(<ImportRow path="world.setting" value="университет" pathWidth={150} />);

    const pathEl = container.querySelector('span[style*="150px"]');
    expect(pathEl).toBeTruthy();
  });

  it('width задаёт ширину всей строки', () => {
    const { container } = render(<ImportRow path="world.setting" value="университет" width={600} />);

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('600px');
  });
});
