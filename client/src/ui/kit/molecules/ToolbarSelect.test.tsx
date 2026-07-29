/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ToolbarSelect from './ToolbarSelect';

afterEach(cleanup);

describe('ToolbarSelect, содержимое', () => {
  it('показывает подпись и значение со стрелкой', () => {
    render(<ToolbarSelect label="ветка:" value="все" onClick={() => {}} />);

    expect(screen.getByText('ветка:')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'все ▾' })).toBeTruthy();
  });

  it('пустая подпись скрывает её', () => {
    render(<ToolbarSelect label="" value="все" onClick={() => {}} />);
    expect(screen.queryByText('ветка:')).toBeNull();
  });

  it('подпись по умолчанию — «ветка:»', () => {
    render(<ToolbarSelect value="все" onClick={() => {}} />);
    expect(screen.getByText('ветка:')).toBeTruthy();
  });
});

describe('ToolbarSelect, стрелка', () => {
  it('по умолчанию стрелка есть', () => {
    render(<ToolbarSelect value="все" onClick={() => {}} />);
    expect(screen.getByRole('button').textContent).toBe('все ▾');
  });

  it('arrow=false убирает глиф из значения', () => {
    render(<ToolbarSelect value="все" arrow={false} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'все' }).textContent).toBe('все');
  });
});

describe('ToolbarSelect, шрифт', () => {
  it('mono получает отдельный класс от обычного', () => {
    const { container: normal } = render(<ToolbarSelect value="все" onClick={() => {}} />);
    const normalClass = normal.querySelector('button')?.className ?? '';
    cleanup();

    const { container: mono } = render(<ToolbarSelect value="все" mono onClick={() => {}} />);
    const monoClass = mono.querySelector('button')?.className ?? '';

    expect(monoClass).not.toBe(normalClass);
  });
});

describe('ToolbarSelect, состояния', () => {
  it('changed получает отдельный класс от обычного', () => {
    const { container: plain } = render(<ToolbarSelect value="все" onClick={() => {}} />);
    const plainClass = plain.querySelector('button')?.className ?? '';
    cleanup();

    const { container: changed } = render(<ToolbarSelect value="все" changed onClick={() => {}} />);
    expect(changed.querySelector('button')?.className).not.toBe(plainClass);
  });

  it('disabled отключает кнопку и не вызывает onClick', () => {
    const onClick = vi.fn();
    render(<ToolbarSelect value="все" disabled onClick={onClick} />);

    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ToolbarSelect, интерактивность', () => {
  it('вызывает onClick по клику', () => {
    const onClick = vi.fn();
    render(<ToolbarSelect value="все" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('без onClick рендерит неинтерактивный элемент', () => {
    render(<ToolbarSelect value="все" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('все ▾')).toBeTruthy();
  });
});
