/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Radio from './Radio';

afterEach(cleanup);

describe.each([true, false])('Radio, checked=%s', checked => {
  it('показывает подпись и корректный aria-checked', () => {
    render(<Radio label="по порядку" checked={checked} onChange={() => {}} />);

    const radio = screen.getByRole('radio', { name: 'по порядку' });
    expect(radio.getAttribute('aria-checked')).toBe(String(checked));
    expect(screen.getByText('по порядку')).toBeTruthy();
  });
});

describe('Radio, состояния', () => {
  it('disabled делает контрол неактивным и приглушённым', () => {
    render(<Radio label="по порядку" checked disabled onChange={() => {}} />);

    const radio = screen.getByRole('radio', { name: 'по порядку' }) as HTMLButtonElement;
    expect(radio.disabled).toBe(true);
  });

  it('disabled без onChange остаётся немым индикатором', () => {
    render(<Radio label="по порядку" checked disabled />);

    const radio = screen.getByRole('radio', { name: 'по порядку' });
    expect(radio.tagName).toBe('SPAN');
    expect(radio.getAttribute('aria-disabled')).toBe('true');
  });

  it('showLabel=false скрывает подпись', () => {
    render(<Radio label="по порядку" showLabel={false} onChange={() => {}} />);

    expect(screen.queryByText('по порядку')).toBeNull();
  });
});

describe('Radio, интерактивность', () => {
  it('без onChange рендерится как немой индикатор, а не кнопка', () => {
    render(<Radio label="по порядку" checked={false} />);

    expect(screen.queryByRole('button')).toBeNull();
    const radio = screen.getByRole('radio', { name: 'по порядку' });
    expect(radio.tagName).toBe('SPAN');
  });

  it('клик вызывает onChange(true)', () => {
    const onChange = vi.fn();
    render(<Radio label="по порядку" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'по порядку' }));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('disabled не пускает клик', () => {
    const onChange = vi.fn();
    render(<Radio label="по порядку" checked={false} disabled onChange={onChange} />);

    fireEvent.click(screen.getByRole('radio', { name: 'по порядку' }));
    expect(onChange).not.toHaveBeenCalled();
  });
});
