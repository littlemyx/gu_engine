/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ToolbarActions from './ToolbarActions';

afterEach(cleanup);

const buttons = () => screen.getAllByRole('button') as HTMLButtonElement[];
const runButton = (price = '≈$3.46') => buttons().find(b => b.textContent?.includes(price))!;
const previewButton = (label = '▶ Превью') => buttons().find(b => b.textContent?.includes(label))!;

// Без onPreview кнопка предпросмотра не интерактивна (правило кита: нет
// колбэка — нет <button>), поэтому её текст проверяем через getByText.
describe('ToolbarActions, состав', () => {
  it('печатает подписи и смету по умолчанию', () => {
    render(<ToolbarActions />);

    expect(screen.getByText('▶ Превью')).toBeTruthy();
    expect(runButton().textContent).toContain('Продолжить конвейер');
    expect(runButton().textContent).toContain('≈$3.46');
  });

  it('принимает свои тексты пропсами', () => {
    render(<ToolbarActions label="Сгенерировать акт" price="≈$1.10" previewLabel="Смотреть" />);

    expect(runButton('≈$1.10').textContent).toContain('Сгенерировать акт');
    expect(runButton('≈$1.10').textContent).toContain('≈$1.10');
    expect(screen.getByText('Смотреть')).toBeTruthy();
  });
});

describe('ToolbarActions, предпросмотр', () => {
  it('без onPreview кнопки предпросмотра нет (выключенный вид)', () => {
    render(<ToolbarActions previewActive={false} />);

    expect(screen.queryByRole('button', { name: /Превью/ })).toBeNull();
    expect(screen.getByText('▶ Превью')).toBeTruthy();
  });

  it('без onPreview кнопки предпросмотра нет (включённый вид)', () => {
    render(<ToolbarActions previewActive />);

    expect(screen.queryByRole('button', { name: /Превью/ })).toBeNull();
    expect(screen.getByText('▶ Превью')).toBeTruthy();
  });

  it('в выключенном виде кликает по колбэку onPreview', () => {
    const onPreview = vi.fn();
    render(<ToolbarActions previewActive={false} onPreview={onPreview} />);

    fireEvent.click(previewButton());
    expect(onPreview).toHaveBeenCalledTimes(1);
  });

  it('во включённом виде тоже кликает по колбэку onPreview', () => {
    const onPreview = vi.fn();
    render(<ToolbarActions previewActive onPreview={onPreview} />);

    fireEvent.click(previewButton());
    expect(onPreview).toHaveBeenCalledTimes(1);
  });
});

describe('ToolbarActions, состояния кнопки запуска', () => {
  it('disabled запирает кнопку и не пускает клик', () => {
    const onRun = vi.fn();
    render(<ToolbarActions disabled onRun={onRun} />);

    expect(runButton().disabled).toBe(true);
    fireEvent.click(runButton());
    expect(onRun).not.toHaveBeenCalled();
  });

  it('loading не отключает кнопку, но клик всё равно не проходит', () => {
    const onRun = vi.fn();
    render(<ToolbarActions loading onRun={onRun} />);

    expect(runButton().disabled).toBe(false);
    fireEvent.click(runButton());
    expect(onRun).not.toHaveBeenCalled();
  });

  it('в обычном виде клик доходит до onRun', () => {
    const onRun = vi.fn();
    render(<ToolbarActions onRun={onRun} />);

    fireEvent.click(runButton());
    expect(onRun).toHaveBeenCalledTimes(1);
  });
});
