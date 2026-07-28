/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Input from './Input';

afterEach(cleanup);

describe('Input, однострочный', () => {
  it('рендерит текстовое поле с плейсхолдером и начальным значением', () => {
    render(<Input placeholder="поиск: персонаж, мир, аудио…" value="детектив" />);

    const input = screen.getByPlaceholderText('поиск: персонаж, мир, аудио…') as HTMLInputElement;
    expect(input.tagName).toBe('INPUT');
    expect(input.value).toBe('детектив');
  });

  it('вызывает onChange со значением поля', () => {
    const onChange = vi.fn();
    render(<Input placeholder="имя" onChange={onChange} />);

    const input = screen.getByPlaceholderText('имя');
    fireEvent.change(input, { target: { value: 'Ирина' } });

    expect(onChange).toHaveBeenCalledWith('Ирина');
  });

  it('получает фокус по клавиатуре (focus-visible через CSS-класс)', () => {
    render(<Input placeholder="имя" />);

    const input = screen.getByPlaceholderText('имя');
    input.focus();
    expect(document.activeElement).toBe(input);
  });
});

describe('Input, multiline', () => {
  it('рендерит textarea вместо input', () => {
    render(<Input placeholder="заметка" multiline />);

    const field = screen.getByPlaceholderText('заметка');
    expect(field.tagName).toBe('TEXTAREA');
    expect((field as HTMLTextAreaElement).rows).toBe(3);
  });

  it('получает отдельный класс от однострочного', () => {
    const { container: single } = render(<Input placeholder="имя" />);
    const singleClass = single.firstElementChild?.className ?? '';
    cleanup();

    const { container: multi } = render(<Input placeholder="имя" multiline />);
    expect(multi.firstElementChild?.className).not.toBe(singleClass);
  });
});

describe('Input, mono', () => {
  it('получает отдельный класс от обычного шрифта', () => {
    const { container: regular } = render(<Input placeholder="код" />);
    const regularClass = regular.firstElementChild?.className ?? '';
    cleanup();

    const { container: mono } = render(<Input placeholder="код" mono />);
    expect(mono.firstElementChild?.className).not.toBe(regularClass);
  });
});

describe('Input, на тёмном', () => {
  it('получает отдельный класс от светлого', () => {
    const { container: light } = render(<Input placeholder="имя" />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<Input placeholder="имя" onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
  });
});

describe('Input, состояния', () => {
  it('disabled отключает поле', () => {
    render(<Input placeholder="имя" disabled />);

    const input = screen.getByPlaceholderText('имя') as HTMLInputElement;
    expect(input.disabled).toBe(true);
  });

  it('error получает отдельный класс от обычного состояния', () => {
    const { container: normal } = render(<Input placeholder="имя" />);
    const normalClass = normal.firstElementChild?.className ?? '';
    cleanup();

    const { container: error } = render(<Input placeholder="имя" error />);
    expect(error.firstElementChild?.className).not.toBe(normalClass);
  });
});
