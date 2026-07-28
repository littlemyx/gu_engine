/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SelectValue from './SelectValue';

afterEach(cleanup);

describe('SelectValue, содержимое', () => {
  it('печатает значение и стрелку', () => {
    render(<SelectValue value="спрайт-лист А" onClick={() => {}} />);

    const btn = screen.getByRole('button', { name: 'спрайт-лист А' });
    expect(btn.textContent).toBe('спрайт-лист А▾');
  });

  it('empty подменяет значение на placeholder', () => {
    render(<SelectValue value="спрайт-лист А" empty onClick={() => {}} />);

    expect(screen.getByRole('button', { name: 'выбрать…' })).toBeTruthy();
    expect(screen.queryByText('спрайт-лист А')).toBeNull();
  });

  it('placeholder настраивается пропом', () => {
    render(<SelectValue value="х" empty placeholder="ничего не выбрано" onClick={() => {}} />);

    expect(screen.getByRole('button', { name: 'ничего не выбрано' })).toBeTruthy();
  });
});

describe('SelectValue, варианты', () => {
  it('changed получает отдельный класс от обычного', () => {
    const { container: plain } = render(<SelectValue value="х" onClick={() => {}} />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: changed } = render(<SelectValue value="х" changed onClick={() => {}} />);
    expect(changed.firstElementChild?.className).not.toBe(plainClass);
  });

  it('empty получает отдельный класс от обычного', () => {
    const { container: plain } = render(<SelectValue value="х" onClick={() => {}} />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: empty } = render(<SelectValue value="х" empty onClick={() => {}} />);
    expect(empty.firstElementChild?.className).not.toBe(plainClass);
  });
});

describe('SelectValue, состояния', () => {
  it('disabled отключает кнопку и не вызывает onClick', () => {
    const onClick = vi.fn();
    render(<SelectValue value="х" disabled onClick={onClick} />);

    const btn = screen.getByRole('button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('error получает отдельный класс от обычного', () => {
    const { container: plain } = render(<SelectValue value="х" onClick={() => {}} />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: errored } = render(<SelectValue value="х" error onClick={() => {}} />);
    expect(errored.firstElementChild?.className).not.toBe(plainClass);
  });

  it('error побеждает changed в классе рамки', () => {
    const { container: changedOnly } = render(<SelectValue value="х" changed onClick={() => {}} />);
    const changedClass = changedOnly.firstElementChild?.className ?? '';
    cleanup();

    const { container: both } = render(<SelectValue value="х" changed error onClick={() => {}} />);
    expect(both.firstElementChild?.className).not.toBe(changedClass);
  });

  it('на тёмном получает отдельный класс от светлого', () => {
    const { container: light } = render(<SelectValue value="х" onClick={() => {}} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<SelectValue value="х" onDark onClick={() => {}} />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });

  it('фокусируется по клавиатуре', () => {
    render(<SelectValue value="х" onClick={() => {}} />);

    const btn = screen.getByRole('button');
    btn.focus();
    expect(document.activeElement).toBe(btn);
  });
});

describe('SelectValue, интерактивность', () => {
  it('вызывает onClick по клику', () => {
    const onClick = vi.fn();
    render(<SelectValue value="х" onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('без onClick рендерит неинтерактивный элемент', () => {
    render(<SelectValue value="спрайт-лист А" />);

    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.getByText('спрайт-лист А')).toBeTruthy();
  });
});
