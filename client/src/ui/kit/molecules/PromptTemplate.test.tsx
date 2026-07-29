/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PromptTemplate from './PromptTemplate';

afterEach(cleanup);

describe('PromptTemplate, текст без токенов', () => {
  it('показывает текст целиком', () => {
    const { container } = render(<PromptTemplate text="soft anime painterly, pastel palette" />);
    expect(container.textContent).toContain('soft anime painterly, pastel palette');
  });
});

describe('PromptTemplate, токены', () => {
  it('подсвечивает одиночный токен отдельным элементом', () => {
    render(<PromptTemplate text="autumnal lighting, {scene_focus}" />);
    expect(screen.getByText('{scene_focus}')).toBeTruthy();
  });

  it('подсвечивает несколько токенов и сохраняет текст между ними', () => {
    const { container } = render(<PromptTemplate text="{a} и {b} рядом" />);
    expect(screen.getByText('{a}')).toBeTruthy();
    expect(screen.getByText('{b}')).toBeTruthy();
    expect(container.textContent).toContain('и');
    expect(container.textContent).toContain('рядом');
  });
});

describe('PromptTemplate, подсказка', () => {
  it('не рендерит подсказку по умолчанию', () => {
    render(<PromptTemplate text="{scene_focus}" />);
    expect(screen.queryByText(/конвейер подставит/)).toBeNull();
  });

  it('показывает подсказку, когда note задан', () => {
    render(<PromptTemplate text="{scene_focus}" note="подставится сам, по локации" />);
    expect(screen.getByText('подставится сам, по локации')).toBeTruthy();
  });
});

describe('PromptTemplate, контекст', () => {
  it('на тёмном хроме получает отдельный класс контейнера', () => {
    const { container: light } = render(<PromptTemplate text="{a}" />);
    const lightClass = light.querySelector('[class*="boxWrap"]')?.className ?? '';
    cleanup();

    const { container: dark } = render(<PromptTemplate text="{a}" onDark />);
    const darkClass = dark.querySelector('[class*="boxWrap"]')?.className ?? '';

    expect(darkClass).not.toBe(lightClass);
    expect(darkClass).not.toBe('');
  });
});

describe('PromptTemplate, ширина', () => {
  it('по умолчанию — 360px', () => {
    const { container } = render(<PromptTemplate text="{a}" />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.width).toBe('360px');
  });

  it('принимает произвольную ширину', () => {
    const { container } = render(<PromptTemplate text="{a}" width={480} />);
    const root = container.firstChild as HTMLElement;
    expect(root.style.width).toBe('480px');
  });
});
