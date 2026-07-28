/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import ArtifactRow, { type ArtifactMark } from './ArtifactRow';

afterEach(cleanup);

const MARKS: ArtifactMark[] = ['authored', 'fresh', 'stale', 'none'];

describe.each(MARKS)('ArtifactRow, отметка %s', mark => {
  it('показывает имя артефакта и слово отметки', () => {
    render(<ArtifactRow artifactName="каст-план" mark={mark} />);
    expect(screen.getByText('каст-план')).toBeTruthy();
    const word = mark === 'none' ? 'нет' : mark;
    expect(screen.getByText(word)).toBeTruthy();
  });
});

describe('ArtifactRow, частные случаи', () => {
  it('без mark по умолчанию fresh', () => {
    render(<ArtifactRow artifactName="спайн" />);
    expect(screen.getByText('fresh')).toBeTruthy();
  });

  it('mark=authored рисует локальный глиф-карандаш, а не StatusGlyph', () => {
    render(<ArtifactRow artifactName="спайн" mark="authored" />);
    expect(screen.getByText('✎')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('mark=fresh отдаёт глиф StatusGlyph с доступным именем', () => {
    render(<ArtifactRow artifactName="спайн" mark="fresh" />);
    expect(screen.getByRole('img', { name: 'fresh' })).toBeTruthy();
  });

  it('mark=stale отдаёт глиф StatusGlyph с доступным именем', () => {
    render(<ArtifactRow artifactName="спайн" mark="stale" />);
    expect(screen.getByRole('img', { name: 'stale' })).toBeTruthy();
  });

  it('mark=none отдаёт глиф StatusGlyph с доступным именем', () => {
    render(<ArtifactRow artifactName="спайн" mark="none" />);
    expect(screen.getByRole('img', { name: 'none' })).toBeTruthy();
  });

  it('строка не интерактивна: кнопок нет', () => {
    render(<ArtifactRow artifactName="спайн" mark="fresh" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('разделитель между именем и отметкой — точка', () => {
    render(<ArtifactRow artifactName="спайн" mark="fresh" />);
    expect(screen.getByText('·')).toBeTruthy();
  });
});
