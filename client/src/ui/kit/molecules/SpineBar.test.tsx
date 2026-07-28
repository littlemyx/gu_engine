/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SpineBar, { type SpineBarState } from './SpineBar';

afterEach(cleanup);

const STATES: SpineBarState[] = ['fill', 'window', 'hatch', 'anchor', 'final'];

describe.each(STATES)('SpineBar, состояние %s', state => {
  it('показывает подпись бита', () => {
    render(<SpineBar label="Б2" state={state} />);
    expect(screen.getAllByText('Б2', { exact: false }).length).toBeGreaterThan(0);
  });

  it('без onClick рисует неинтерактивную полосу', () => {
    render(<SpineBar label="Б2" state={state} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рисует кнопку и вызывает колбэк по клику', () => {
    let clicked = 0;
    render(
      <SpineBar
        label="Б2"
        state={state}
        onClick={() => {
          clicked += 1;
        }}
      />,
    );
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(clicked).toBe(1);
  });
});

describe('SpineBar, частные случаи', () => {
  it('якорь получает глиф-префикс ◈', () => {
    render(<SpineBar label="Б4" state="anchor" />);
    expect(screen.getByText('◈ Б4')).toBeTruthy();
  });

  it('заливка и финал не получают глиф-префикс', () => {
    render(<SpineBar label="Б4" state="fill" />);
    expect(screen.getByText('Б4')).toBeTruthy();
    expect(screen.queryByText('◈ Б4')).toBeNull();
  });

  it('окно показывает пояснение note рядом с окном прогресса', () => {
    render(<SpineBar label="Б2" state="window" note="окно Д1в–Д2в" />);
    expect(screen.getByText('окно Д1в–Д2в')).toBeTruthy();
  });

  it('окно без note не рисует пояснение', () => {
    render(<SpineBar label="Б2" state="window" />);
    expect(screen.queryByText(/окно/)).toBeNull();
  });

  it('заливка и штриховка игнорируют note', () => {
    render(<SpineBar label="Б2" state="fill" note="окно Д1в–Д2в" />);
    expect(screen.queryByText('окно Д1в–Д2в')).toBeNull();
  });

  it('окно позиционирует полосу прогресса по fillStart/fillWidth', () => {
    const { container } = render(<SpineBar label="Б2" state="window" fillStart={20} fillWidth={40} />);
    const fill = container.querySelector('span[style]') as HTMLElement;
    expect(fill.style.left).toBe('20%');
    expect(fill.style.width).toBe('40%');
  });

  it('fillStart/fillWidth зажимаются в 0–100', () => {
    const { container } = render(<SpineBar label="Б2" state="window" fillStart={-10} fillWidth={140} />);
    const fill = container.querySelector('span[style]') as HTMLElement;
    expect(fill.style.left).toBe('0%');
    expect(fill.style.width).toBe('100%');
  });

  it('selected рисует кольцо выбора', () => {
    const { container } = render(<SpineBar label="Б2" selected />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/selected/);
  });

  it('без selected кольца выбора нет', () => {
    const { container } = render(<SpineBar label="Б2" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).not.toMatch(/selected/);
  });

  it('width задаёт ширину полосы', () => {
    const { container } = render(<SpineBar label="Б2" width={200} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('200px');
  });

  it('width по умолчанию — 140px', () => {
    const { container } = render(<SpineBar label="Б2" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('140px');
  });

  it('состояние по умолчанию — window', () => {
    const { container } = render(<SpineBar label="Б2" note="окно Д1в–Д2в" />);
    expect(screen.getByText('окно Д1в–Д2в')).toBeTruthy();
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toMatch(/stateWindow/);
  });
});
