/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PassportKV, { type PassportKVRow } from './PassportKV';

import accentStyles from '../atoms/AccentText.module.css';
import monoStyles from '../atoms/MonoText.module.css';
import textLabelStyles from '../atoms/TextLabel.module.css';

afterEach(cleanup);

const ROWS: PassportKVRow[] = [
  { key: 'модель', value: 'gpt-4.1-mini', format: 'mono' },
  { key: 'стоимость', value: '$0.014 · 2 попытки' },
  { key: 'проверки', value: '8/8 ✓ · критик ✓', format: 'plain' },
  { key: 'статус', value: 'валиден, в бандл', format: 'accent' },
];

describe('PassportKV, контент', () => {
  it('показывает каждый ключ и каждое значение', () => {
    render(<PassportKV rows={ROWS} />);
    for (const row of ROWS) {
      expect(screen.getByText(row.key)).toBeTruthy();
      expect(screen.getByText(row.value)).toBeTruthy();
    }
  });

  it('без format значение рисуется как plain', () => {
    render(<PassportKV rows={[{ key: 'проверки', value: '8/8 ✓ · критик ✓' }]} />);
    expect(screen.getByText('8/8 ✓ · критик ✓')).toBeTruthy();
  });

  it('пустой список строк не падает и не рисует строк', () => {
    const { container } = render(<PassportKV rows={[]} />);
    expect(container.querySelectorAll('span')).toHaveLength(0);
  });
});

describe('PassportKV, начертание значения', () => {
  it('format="mono" рисуется через MonoText', () => {
    render(<PassportKV rows={[{ key: 'модель', value: 'gpt-4.1-mini', format: 'mono' }]} />);
    const value = screen.getByText('gpt-4.1-mini');
    expect(value.className).toContain(monoStyles.root);
  });

  it('format="accent" рисуется через AccentText', () => {
    render(<PassportKV rows={[{ key: 'статус', value: 'валиден, в бандл', format: 'accent' }]} />);
    const value = screen.getByText('валиден, в бандл');
    expect(value.className).toContain(accentStyles.root);
  });

  it('format="plain" (и отсутствие format) рисуется через TextLabel', () => {
    render(
      <PassportKV
        rows={[
          { key: 'проверки', value: '8/8 ✓ · критик ✓', format: 'plain' },
          { key: 'стоимость', value: '$0.014 · 2 попытки' },
        ]}
      />,
    );
    expect(screen.getByText('8/8 ✓ · критик ✓').className).toContain(textLabelStyles.root);
    expect(screen.getByText('$0.014 · 2 попытки').className).toContain(textLabelStyles.root);
  });
});

describe('PassportKV, вид', () => {
  it('ширина колонки ключа и общая ширина применяются к сетке', () => {
    const { container } = render(<PassportKV rows={ROWS} labelWidth={80} width={320} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.gridTemplateColumns).toBe('80px 1fr');
    expect(root.style.width).toBe('320px');
  });

  it('по умолчанию ширина колонки ключа 64px, общая ширина 280px', () => {
    const { container } = render(<PassportKV rows={ROWS} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.gridTemplateColumns).toBe('64px 1fr');
    expect(root.style.width).toBe('280px');
  });

  it('onDark пробрасывается в атомы значений и ключей', () => {
    render(<PassportKV rows={[{ key: 'модель', value: 'gpt-4.1-mini', format: 'mono' }]} onDark />);
    const key = screen.getByText('модель');
    const value = screen.getByText('gpt-4.1-mini');
    expect(key.className).toMatch(/onDark/);
    expect(value.className).toMatch(/onDark/);
  });
});
