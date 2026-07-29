/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import FileRow from './FileRow';

afterEach(cleanup);

describe('FileRow', () => {
  it('показывает имя файла и мета-строку', () => {
    render(<FileRow fileName="sample-brief.json" meta="3.5 КБ · version 0.1 ✓ схема валидна" />);
    expect(screen.getByText('sample-brief.json')).toBeTruthy();
    expect(screen.getByText('3.5 КБ · version 0.1 ✓ схема валидна')).toBeTruthy();
  });

  it('без actionLabel подпись действия по умолчанию — «заменить…»', () => {
    render(<FileRow fileName="sample-brief.json" meta="3.5 КБ" />);
    expect(screen.getByText('заменить…')).toBeTruthy();
  });

  it('actionLabel переопределяет подпись действия', () => {
    render(<FileRow fileName="sample-brief.json" meta="3.5 КБ" actionLabel="удалить" />);
    expect(screen.getByText('удалить')).toBeTruthy();
    expect(screen.queryByText('заменить…')).toBeNull();
  });

  it('без onAction действие нерактивно: кнопки нет', () => {
    render(<FileRow fileName="sample-brief.json" meta="3.5 КБ" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onAction действие — кнопка с доступным именем и вызывает колбэк по клику', () => {
    let calls = 0;
    render(
      <FileRow fileName="sample-brief.json" meta="3.5 КБ" actionLabel="заменить…" onAction={() => (calls += 1)} />,
    );
    const button = screen.getByRole('button', { name: 'заменить…' });
    fireEvent.click(button);
    expect(calls).toBe(1);
  });

  it('ширина по умолчанию 480px', () => {
    const { container } = render(<FileRow fileName="sample-brief.json" meta="3.5 КБ" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('480px');
  });

  it('width задаёт ширину строки в px', () => {
    const { container } = render(<FileRow fileName="sample-brief.json" meta="3.5 КБ" width={320} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('320px');
  });
});
