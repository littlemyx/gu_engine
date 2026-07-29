/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BeforeAfterPair from './BeforeAfterPair';

afterEach(cleanup);

describe('BeforeAfterPair', () => {
  it('показывает обе подписи и оба текста', () => {
    render(
      <BeforeAfterPair
        beforeLabel="было:"
        beforeText="«суше, ироничнее»"
        afterLabel="станет:"
        afterText="«мягче, без иронии»"
      />,
    );

    expect(screen.getByText('было:')).toBeTruthy();
    expect(screen.getByText('«суше, ироничнее»')).toBeTruthy();
    expect(screen.getByText('станет:')).toBeTruthy();
    expect(screen.getByText('«мягче, без иронии»')).toBeTruthy();
  });

  it('по умолчанию берёт ширину 400px', () => {
    const { container } = render(
      <BeforeAfterPair beforeLabel="было:" beforeText="а" afterLabel="станет:" afterText="б" />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('400px');
  });

  it('ширину можно переопределить', () => {
    const { container } = render(
      <BeforeAfterPair beforeLabel="было:" beforeText="а" afterLabel="станет:" afterText="б" width={520} />,
    );

    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('520px');
  });

  it('не рендерит кнопок — компонент не кликабельный', () => {
    render(<BeforeAfterPair beforeLabel="было:" beforeText="а" afterLabel="станет:" afterText="б" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('левая и правая карточки получают разные тона рамки', () => {
    const { container } = render(
      <BeforeAfterPair beforeLabel="было:" beforeText="а" afterLabel="станет:" afterText="б" />,
    );

    const [before, after] = Array.from(container.querySelectorAll('[class*="cell"] > div'));
    expect(before.className).not.toBe(after.className);
  });
});
