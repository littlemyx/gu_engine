/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import BottomTabs, { type BottomTabsItem } from './BottomTabs';

afterEach(cleanup);

const TABS: BottomTabsItem[] = [{ label: 'Пайплайн' }, { label: 'Лента' }, { label: 'Прогоны' }];

// jest-dom в проекте нет, поэтому смотрим само свойство/атрибут элемента.
const tab = (name: string) => screen.getByRole('tab', { name }) as HTMLElement;

describe('BottomTabs', () => {
  it('показывает все вкладки и подсвечивает активную', () => {
    render(<BottomTabs tabs={TABS} active={1} onPick={() => {}} />);

    expect(tab('Пайплайн').getAttribute('aria-selected')).toBe('false');
    expect(tab('Лента').getAttribute('aria-selected')).toBe('true');
    expect(tab('Прогоны').getAttribute('aria-selected')).toBe('false');
  });

  it('по умолчанию активна первая вкладка', () => {
    render(<BottomTabs tabs={TABS} onPick={() => {}} />);

    expect(tab('Пайплайн').getAttribute('aria-selected')).toBe('true');
  });

  it('клик по вкладке зовёт onPick с индексом и меткой', () => {
    const onPick = vi.fn();
    render(<BottomTabs tabs={TABS} active={0} onPick={onPick} />);

    tab('Прогоны').click();

    expect(onPick).toHaveBeenCalledWith(2, 'Прогоны');
  });

  it('без onPick вкладки не кликабельны', () => {
    render(<BottomTabs tabs={TABS} active={0} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(tab('Пайплайн').tagName).toBe('SPAN');
  });

  it('в свёрнутом состоянии подсветка активной вкладки гаснет и появляется пояснение', () => {
    render(<BottomTabs tabs={TABS} active={0} collapsed onPick={() => {}} />);

    expect(tab('Пайплайн').getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('свёрнуто')).toBeTruthy();
  });

  it('пока не свёрнуто, пояснения нет', () => {
    render(<BottomTabs tabs={TABS} active={0} onPick={() => {}} />);

    expect(screen.queryByText('свёрнуто')).toBeNull();
  });
});
