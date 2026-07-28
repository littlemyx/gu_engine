/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import MenuPanel, { type MenuPanelItem } from './MenuPanel';

afterEach(cleanup);

const ITEMS: MenuPanelItem[] = [
  { label: 'Сгенерировать план', hotkey: '⌘G' },
  { label: 'Догенерировать выбранное', price: '≈$0.04' },
  { label: 'Остановить прогон', disabled: true },
  { label: 'Проверить историю', separator: true },
];

describe('MenuPanel, заголовок', () => {
  it('печатает заголовок, когда он задан', () => {
    render(<MenuPanel title="Генерация" items={ITEMS} />);
    expect(screen.getByText('Генерация')).toBeTruthy();
  });

  it('без title ничего не печатает над панелью', () => {
    render(<MenuPanel items={ITEMS} />);
    expect(screen.queryByText('Генерация')).toBeNull();
  });
});

describe('MenuPanel, состав пунктов', () => {
  it('печатает каждый пункт с его хоткеем/сметой', () => {
    render(<MenuPanel items={ITEMS} />);

    expect(screen.getByText('Сгенерировать план')).toBeTruthy();
    expect(screen.getByText('⌘G')).toBeTruthy();
    expect(screen.getByText('Догенерировать выбранное')).toBeTruthy();
    expect(screen.getByText('≈$0.04')).toBeTruthy();
  });

  it('mark check и radio доходят до строки как глифы', () => {
    const marked: MenuPanelItem[] = [
      { label: 'Строгий режим', mark: 'check' },
      { label: 'Только черновики', mark: 'radio' },
    ];
    render(<MenuPanel items={marked} onPick={() => {}} />);

    const checkBtn = screen.getByRole('button', { name: /Строгий режим/ });
    expect(checkBtn.textContent).toContain('✓');

    const radioBtn = screen.getByRole('button', { name: /Только черновики/ });
    expect(radioBtn.textContent).toContain('•');
  });
});

describe('MenuPanel, интерактивность', () => {
  it('клик по пункту вызывает onPick с индексом и лейблом', () => {
    const onPick = vi.fn();
    render(<MenuPanel items={ITEMS} onPick={onPick} />);

    fireEvent.click(screen.getByRole('button', { name: /Сгенерировать план/ }));
    expect(onPick).toHaveBeenCalledWith(0, 'Сгенерировать план');
  });

  it('disabled-пункт заперт и не вызывает onPick', () => {
    const onPick = vi.fn();
    render(<MenuPanel items={ITEMS} onPick={onPick} />);

    const btn = screen.getByRole('button', { name: 'Остановить прогон' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);

    fireEvent.click(btn);
    expect(onPick).not.toHaveBeenCalled();
  });

  it('без onPick пункты рендерятся неинтерактивными', () => {
    render(<MenuPanel items={ITEMS} />);

    expect(screen.queryByRole('button', { name: 'Сгенерировать план' })).toBeNull();
    expect(screen.getByText('Сгенерировать план')).toBeTruthy();
  });
});

describe('MenuPanel, ширина', () => {
  it('дефолтная ширина панели — 250px', () => {
    const { container } = render(<MenuPanel items={ITEMS} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('250px');
  });

  it('width переопределяет ширину', () => {
    const { container } = render(<MenuPanel items={ITEMS} width={200} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('200px');
  });
});
