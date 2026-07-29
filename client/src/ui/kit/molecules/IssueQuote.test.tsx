/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import IssueQuote from './IssueQuote';

afterEach(cleanup);

describe('IssueQuote', () => {
  it('показывает подпись и цитату в кавычках', () => {
    render(<IssueQuote quote="Вы ведь обещали вернуться до шторма…" />);
    expect(screen.getByText('цитата: «Вы ведь обещали вернуться до шторма…»')).toBeTruthy();
  });

  it('поддерживает свою подпись перед цитатой', () => {
    render(<IssueQuote quote="меньше пафоса" quoteLabel="реплика:" />);
    expect(screen.getByText('реплика: «меньше пафоса»')).toBeTruthy();
    expect(screen.queryByText('цитата: «меньше пафоса»')).toBeNull();
  });

  it('показывает сноску, если она задана', () => {
    render(<IssueQuote quote="х" note="бриф: Кира со 2-й ступени на «ты»" />);
    expect(screen.getByText('бриф: Кира со 2-й ступени на «ты»')).toBeTruthy();
  });

  it('без сноски ничего лишнего не рисует', () => {
    const { container } = render(<IssueQuote quote="х" />);
    expect(container.querySelector('br')).toBeNull();
  });

  it('задаёт ширину карточки', () => {
    const { container } = render(<IssueQuote quote="х" width={480} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('480px');
  });

  it('без явной ширины подставляет ширину по умолчанию', () => {
    const { container } = render(<IssueQuote quote="х" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('340px');
  });
});
