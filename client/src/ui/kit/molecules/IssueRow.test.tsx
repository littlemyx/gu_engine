/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import IssueRow, { type IssueRowKind } from './IssueRow';

import styles from './IssueRow.module.css';

afterEach(cleanup);

const KINDS: IssueRowKind[] = ['blocker', 'warning'];

describe.each(KINDS)('IssueRow, вид %s', kind => {
  it('показывает текст проблемы и бейдж по умолчанию', () => {
    render(<IssueRow text="2 юнита без прозы — держат гейт" kind={kind} />);

    expect(screen.getByText('2 юнита без прозы — держат гейт')).toBeTruthy();
    expect(screen.getByText(kind === 'blocker' ? 'БЛОКЕР' : 'ПРЕДУПР')).toBeTruthy();
  });

  it('красит рамку под свой тон', () => {
    const { container } = render(<IssueRow text="текст" kind={kind} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain(kind === 'blocker' ? styles.blocker : styles.warning);
  });
});

describe('IssueRow, бейдж', () => {
  it('подпись бейджа переопределяется пропом badge', () => {
    render(<IssueRow text="текст" badge="ГЕЙТ" />);

    expect(screen.getByText('ГЕЙТ')).toBeTruthy();
    expect(screen.queryByText('БЛОКЕР')).toBeNull();
  });
});

describe('IssueRow, действие', () => {
  it('без action столбец действия не рисуется', () => {
    render(<IssueRow text="текст" />);

    expect(screen.queryByText(/→/)).toBeNull();
  });

  it('с action показывает строку действия', () => {
    render(<IssueRow text="текст" action="→ Проза · ≈$0.16" />);

    expect(screen.getByText('→ Проза · ≈$0.16')).toBeTruthy();
  });
});

describe('IssueRow, выделение', () => {
  it('selected добавляет класс рамки', () => {
    const { container } = render(<IssueRow text="текст" selected />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain(styles.selected);
  });

  it('без selected класса нет', () => {
    const { container } = render(<IssueRow text="текст" />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).not.toContain(styles.selected);
  });
});

describe('IssueRow, интерактивность', () => {
  it('без onClick рендерится неинтерактивный контейнер', () => {
    render(<IssueRow text="текст" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерится кнопка и клик вызывает колбэк', () => {
    const onClick = vi.fn();
    render(<IssueRow text="2 юнита без прозы — держат гейт" onClick={onClick} />);

    const button = screen.getByRole('button', { name: /2 юнита без прозы/ });
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
