/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Tab, { type TabVariant } from './Tab';

afterEach(cleanup);

const VARIANTS: TabVariant[] = ['underline', 'document', 'dock'];

describe.each(VARIANTS)('Tab, вариант %s', variant => {
  it('показывает подпись', () => {
    render(<Tab label="Сцена" variant={variant} />);
    expect(screen.getByText('Сцена')).toBeTruthy();
  });

  it('без onClick рисует неинтерактивную вкладку', () => {
    const { container } = render(<Tab label="Сцена" variant={variant} />);
    expect(container.querySelector('button')).toBeNull();
    expect(container.querySelector('[role="tab"]')).toBeTruthy();
  });

  it('с onClick рисует кнопку и вызывает колбэк по клику', () => {
    const onClick = vi.fn();
    const { container } = render(<Tab label="Сцена" variant={variant} onClick={onClick} />);
    const tab = container.querySelector('button[role="tab"]');
    expect(tab).toBeTruthy();

    fireEvent.click(tab as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Tab, состояние selected', () => {
  it('выбранная вкладка помечена aria-selected=true', () => {
    const { container } = render(<Tab label="Сцена" selected />);
    expect(container.querySelector('[role="tab"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('невыбранная вкладка помечена aria-selected=false', () => {
    const { container } = render(<Tab label="Сцена" />);
    expect(container.querySelector('[role="tab"]')?.getAttribute('aria-selected')).toBe('false');
  });
});

describe('Tab, notify', () => {
  it('точка непросмотренного видна только при notify', () => {
    const { container, rerender } = render(<Tab label="Сцена" />);
    expect(container.querySelector('[aria-label="есть непросмотренное"]')).toBeNull();

    rerender(<Tab label="Сцена" notify />);
    expect(container.querySelector('[aria-label="есть непросмотренное"]')).toBeTruthy();
  });
});

describe('Tab, крестик закрытия', () => {
  it('виден только у документной вкладки', () => {
    const { container: underline } = render(<Tab label="Сцена" variant="underline" />);
    expect(underline.querySelector('[aria-label="закрыть"]')).toBeNull();

    const { container: dock } = render(<Tab label="Сцена" variant="dock" />);
    expect(dock.querySelector('[aria-label="закрыть"]')).toBeNull();

    const { container: docTab } = render(<Tab label="Документ" variant="document" />);
    expect(docTab.querySelector('[aria-label="закрыть"]')).toBeTruthy();
  });

  it('closable=false прячет крестик у документной вкладки', () => {
    const { container } = render(<Tab label="Документ" variant="document" closable={false} />);
    expect(container.querySelector('[aria-label="закрыть"]')).toBeNull();
  });

  it('клик по крестику вызывает onClose и не всплывает до onClick вкладки', () => {
    const onClick = vi.fn();
    const onClose = vi.fn();
    const { container } = render(<Tab label="Документ" variant="document" onClick={onClick} onClose={onClose} />);
    const close = container.querySelector('[aria-label="закрыть"]') as HTMLElement;

    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });
});
