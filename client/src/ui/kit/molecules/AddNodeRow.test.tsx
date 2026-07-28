/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import AddNodeRow from './AddNodeRow';

afterEach(cleanup);

describe('AddNodeRow', () => {
  it('показывает подпись по умолчанию', () => {
    render(<AddNodeRow />);
    expect(screen.getByText('+ добавить бит или ветку')).toBeTruthy();
  });

  it('показывает переданную подпись', () => {
    render(<AddNodeRow label="+ добавить ветку" />);
    expect(screen.getByText('+ добавить ветку')).toBeTruthy();
  });

  it('дописывает подсказку через тире', () => {
    render(<AddNodeRow label="+ добавить бит" hint="после «Ссора»" />);
    expect(screen.getByText('+ добавить бит — после «Ссора»')).toBeTruthy();
  });

  it('без подсказки тире не рисует', () => {
    render(<AddNodeRow label="+ добавить бит" />);
    expect(screen.queryByText(/—/)).toBeNull();
  });

  it('без onAdd не рендерит кнопку', () => {
    render(<AddNodeRow />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onAdd рендерит кнопку с доступным именем по тексту', () => {
    render(<AddNodeRow onAdd={() => {}} />);
    expect(screen.getByRole('button', { name: '+ добавить бит или ветку' })).toBeTruthy();
  });

  it('клик вызывает onAdd', () => {
    let calls = 0;
    render(<AddNodeRow onAdd={() => (calls += 1)} />);
    fireEvent.click(screen.getByRole('button'));
    expect(calls).toBe(1);
  });

  it('по умолчанию на светлом хроме', () => {
    render(<AddNodeRow />);
    const text = screen.getByText('+ добавить бит или ветку');
    expect(text.className.toLowerCase()).not.toContain('ondark');
  });

  it('на тёмном хроме передаёт onDark вниз по атомам', () => {
    render(<AddNodeRow onDark />);
    const text = screen.getByText('+ добавить бит или ветку');
    expect(text.className.toLowerCase()).toContain('ondark');
  });

  it('ширина по умолчанию — 240px', () => {
    render(<AddNodeRow />);
    const wrap = screen.getByText('+ добавить бит или ветку').parentElement as HTMLElement;
    expect(wrap.style.width).toBe('240px');
  });

  it('ширина переопределяется пропом', () => {
    render(<AddNodeRow width={320} />);
    const wrap = screen.getByText('+ добавить бит или ветку').parentElement as HTMLElement;
    expect(wrap.style.width).toBe('320px');
  });
});
