/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import FloatingDock, { type FloatingDockItem } from './FloatingDock';

afterEach(cleanup);

const ITEMS: FloatingDockItem[] = [
  { glyph: '≡', label: 'Иерархия' },
  { glyph: '▤', label: 'Ассеты', notify: true },
  { glyph: '≣', label: 'Лог' },
];

describe('FloatingDock', () => {
  it('показывает каждую вкладку по её подписи', () => {
    render(<FloatingDock items={ITEMS} onSelect={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Иерархия' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Ассеты' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Лог' })).toBeTruthy();
  });

  it('первая вкладка активна по умолчанию', () => {
    render(<FloatingDock items={ITEMS} onSelect={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Иерархия' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Ассеты' }).getAttribute('aria-selected')).toBe('false');
  });

  it('activeIndex переключает активную вкладку', () => {
    render(<FloatingDock items={ITEMS} activeIndex={2} onSelect={() => {}} />);

    expect(screen.getByRole('tab', { name: 'Лог' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Иерархия' }).getAttribute('aria-selected')).toBe('false');
  });

  it('клик по вкладке вызывает onSelect с индексом и подписью', () => {
    const onSelect = vi.fn();
    render(<FloatingDock items={ITEMS} onSelect={onSelect} />);

    screen.getByRole('tab', { name: 'Ассеты' }).click();

    expect(onSelect).toHaveBeenCalledWith(1, 'Ассеты');
  });

  it('без onSelect вкладки не рендерятся кнопками', () => {
    render(<FloatingDock items={ITEMS} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Иерархия' }).tagName).toBe('SPAN');
  });

  it('точка непросмотренного видна только у вкладки с notify', () => {
    const { container } = render(<FloatingDock items={ITEMS} onSelect={() => {}} />);

    const assetsTab = screen.getByRole('tab', { name: 'Ассеты' });
    const hierarchyTab = screen.getByRole('tab', { name: 'Иерархия' });

    expect(assetsTab.querySelectorAll('span[aria-hidden="true"]').length).toBeGreaterThan(
      hierarchyTab.querySelectorAll('span[aria-hidden="true"]').length,
    );
    expect(container.querySelectorAll('[role="tab"]').length).toBe(3);
  });
});
