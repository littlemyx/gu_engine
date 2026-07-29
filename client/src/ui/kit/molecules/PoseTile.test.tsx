/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import PoseTile, { type PoseTileState } from './PoseTile';

afterEach(cleanup);

describe('PoseTile, состояние normal', () => {
  it('показывает имя и глиф-статус готовности', () => {
    render(<PoseTile name="happy" state="normal" />);
    expect(screen.getByText('happy')).toBeTruthy();
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('без onClick не рендерится кнопкой', () => {
    render(<PoseTile name="happy" state="normal" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick рендерится кнопкой и вызывает колбэк по клику', () => {
    let calls = 0;
    render(<PoseTile name="happy" state="normal" onClick={() => (calls += 1)} />);
    const tile = screen.getByRole('button');
    fireEvent.click(tile);
    expect(calls).toBe(1);
  });
});

describe('PoseTile, состояние selected', () => {
  it('показывает бейдж, когда передан badge', () => {
    render(<PoseTile name="happy" state="selected" badge="ВЫБРАНА" />);
    expect(screen.getByText('ВЫБРАНА')).toBeTruthy();
  });

  it('без badge бейдж не рисуется', () => {
    render(<PoseTile name="happy" state="selected" />);
    expect(screen.queryByText('ВЫБРАНА')).toBeNull();
  });
});

describe('PoseTile, состояние generating', () => {
  it('показывает вращающийся глиф генерации и подпись', () => {
    render(<PoseTile name="happy" state="generating" generatingLabel="генерация…" />);
    expect(screen.getByText('генерация…')).toBeTruthy();
    expect(screen.getAllByText('⟳').length).toBeGreaterThan(0);
  });

  it('в футере статус-глиф генерации не крутится', () => {
    render(<PoseTile name="happy" state="generating" />);
    const glyphs = screen.getAllByText('⟳');
    const footerGlyph = glyphs[glyphs.length - 1];
    expect(footerGlyph.className).not.toMatch(/spin/i);
  });
});

describe('PoseTile, состояние missing', () => {
  it('показывает пояснение и футер с прочерком', () => {
    render(<PoseTile name="happy" state="missing" missingNote="нет в poseFilenames" />);
    expect(screen.getByText('нет в poseFilenames')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
    expect(screen.getByText('✗')).toBeTruthy();
  });

  it('без onClick рендерится без role="button"', () => {
    render(<PoseTile name="happy" state="missing" />);
    expect(screen.queryByRole('button', { name: /Догенерировать/ })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('с onClick оборачивается в div[role=button], а не в <button> (кнопка догенерации вложена)', () => {
    let calls = 0;
    render(<PoseTile name="happy" state="missing" generateLabel="Догенерировать" onClick={() => (calls += 1)} />);
    const buttons = screen.getAllByRole('button');
    const outer = buttons.find(el => el.tagName === 'DIV') as HTMLElement;
    expect(outer).toBeTruthy();
    fireEvent.click(outer);
    expect(calls).toBe(1);
  });

  it('кнопка «Догенерировать» вызывает onGenerate и не всплывает до onClick', () => {
    let clicks = 0;
    let generates = 0;
    render(
      <PoseTile
        name="happy"
        state="missing"
        generateLabel="Догенерировать"
        onClick={() => (clicks += 1)}
        onGenerate={() => (generates += 1)}
      />,
    );
    const generateBtn = screen.getByText('Догенерировать');
    fireEvent.click(generateBtn);
    expect(generates).toBe(1);
    expect(clicks).toBe(0);
  });

  it('без generateLabel кнопка догенерации не рендерится (остаётся только внешняя область)', () => {
    render(<PoseTile name="happy" state="missing" onClick={() => {}} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].tagName).toBe('DIV');
  });
});

describe('PoseTile, значения по умолчанию', () => {
  it('без state рендерится как «normal»', () => {
    render(<PoseTile name="happy" />);
    expect(screen.getByText('✓')).toBeTruthy();
  });

  it('без width берёт размер макета 110×165', () => {
    render(<PoseTile name="happy" />);
    const glyph = screen.getByText('◐');
    const checker = glyph.parentElement?.parentElement as HTMLElement;
    expect(checker.style.width).toBe('110px');
    expect(checker.style.height).toBe('165px');
  });

  it('width применяется к плитке и высота считается из соотношения 2:3', () => {
    render(<PoseTile name="happy" width={100} />);
    const glyph = screen.getByText('◐');
    const checker = glyph.parentElement?.parentElement as HTMLElement;
    expect(checker.style.width).toBe('100px');
    expect(checker.style.height).toBe('150px');
  });
});

const STATES: PoseTileState[] = ['normal', 'selected', 'generating', 'missing'];

describe.each(STATES)('PoseTile, все состояния (%s) показывают имя', state => {
  it('рендерит имя в футере', () => {
    render(<PoseTile name="joy" state={state} />);
    expect(screen.getByText('joy')).toBeTruthy();
  });
});
