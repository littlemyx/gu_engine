/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BlueprintGrid from './BlueprintGrid';

afterEach(cleanup);

describe('BlueprintGrid', () => {
  it('без пропсов считает лейбл из zoom/step по умолчанию и показывает заглушку', () => {
    render(<BlueprintGrid />);

    expect(screen.getByText('100% · сетка 20px')).toBeTruthy();
    expect(screen.getByText('вьюпорт — содержимое кладётся поверх сетки')).toBeTruthy();
  });

  it('пересчитывает дефолтный лейбл из заданных zoom и step', () => {
    render(<BlueprintGrid zoom={150} step={10} />);

    expect(screen.getByText('150% · сетка 10px')).toBeTruthy();
  });

  it('явный label переопределяет вычисленный текст', () => {
    render(<BlueprintGrid label="кастомная подпись" zoom={200} step={30} />);

    expect(screen.getByText('кастомная подпись')).toBeTruthy();
    expect(screen.queryByText('200% · сетка 30px')).toBeNull();
  });

  it('пустой label скрывает лейбл', () => {
    render(<BlueprintGrid label="" />);

    expect(screen.queryByText('100% · сетка 20px')).toBeNull();
  });

  it('step управляет шагом сетки через backgroundSize', () => {
    const { container } = render(<BlueprintGrid step={40} />);
    const root = container.firstElementChild as HTMLDivElement;

    expect(root.style.backgroundSize).toBe('40px 40px');
  });

  it('children заменяет текст-заглушку', () => {
    render(
      <BlueprintGrid>
        <span>кадр вьюпорта</span>
      </BlueprintGrid>,
    );

    expect(screen.getByText('кадр вьюпорта')).toBeTruthy();
    expect(screen.queryByText('вьюпорт — содержимое кладётся поверх сетки')).toBeNull();
  });

  it('placeholder переопределяет дефолтный текст заглушки', () => {
    render(<BlueprintGrid placeholder="пусто — перетащите сюда сцену" />);

    expect(screen.getByText('пусто — перетащите сюда сцену')).toBeTruthy();
  });
});
