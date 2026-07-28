/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SidebarTabs, { type SidebarTabsItem } from './SidebarTabs';

afterEach(cleanup);

const TABS: SidebarTabsItem[] = [{ label: 'Структура' }, { label: 'Пайплайн' }];

const tab = (name: string) => screen.getByRole('tab', { name }) as HTMLElement;

describe('SidebarTabs', () => {
  it('показывает все вкладки и подсвечивает активную', () => {
    render(<SidebarTabs tabs={TABS} active={1} onPick={() => {}} />);

    expect(tab('Структура').getAttribute('aria-selected')).toBe('false');
    expect(tab('Пайплайн').getAttribute('aria-selected')).toBe('true');
  });

  it('по умолчанию активна первая вкладка', () => {
    render(<SidebarTabs tabs={TABS} onPick={() => {}} />);

    expect(tab('Структура').getAttribute('aria-selected')).toBe('true');
  });

  it('клик по вкладке зовёт onPick с индексом и меткой', () => {
    const onPick = vi.fn();
    render(<SidebarTabs tabs={TABS} active={0} onPick={onPick} />);

    tab('Пайплайн').click();

    expect(onPick).toHaveBeenCalledWith(1, 'Пайплайн');
  });

  it('без onPick вкладки не кликабельны', () => {
    render(<SidebarTabs tabs={TABS} active={0} />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(tab('Структура').tagName).toBe('SPAN');
  });

  it('точка непросмотренного появляется только у помеченной вкладки', () => {
    const tabsWithNotify: SidebarTabsItem[] = [{ label: 'Структура' }, { label: 'Пайплайн', notify: true }];
    const { container } = render(<SidebarTabs tabs={tabsWithNotify} active={0} onPick={() => {}} />);
    const tabs = container.querySelectorAll('[role="tab"]');

    expect(tabs[0].querySelector('[aria-label="есть непросмотренное"]')).toBeNull();
    expect(tabs[1].querySelector('[aria-label="есть непросмотренное"]')).toBeTruthy();
  });
});
