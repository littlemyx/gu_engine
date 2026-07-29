/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PanelFootnote from './PanelFootnote';

afterEach(cleanup);

const TEXT = 'ветка ещё не проверена QA';

describe('PanelFootnote', () => {
  it('показывает текст подписи', () => {
    render(<PanelFootnote text={TEXT} />);
    expect(screen.getByText(TEXT)).toBeTruthy();
  });

  it('по умолчанию живёт на тёмном хроме — так же, как в макете', () => {
    const { container } = render(<PanelFootnote text={TEXT} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain('onDark');
  });

  it('на светлом хроме получает свой класс', () => {
    const { container } = render(<PanelFootnote text={TEXT} onDark={false} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain('onLight');
    expect(root.className).not.toContain('onDark');
  });

  it('не кликабельная: кнопок нет', () => {
    render(<PanelFootnote text={TEXT} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});
