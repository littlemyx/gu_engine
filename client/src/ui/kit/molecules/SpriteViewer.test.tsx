/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import SpriteViewer from './SpriteViewer';

afterEach(cleanup);

describe('SpriteViewer, значения по умолчанию', () => {
  it('показывает дефолтный бейдж', () => {
    render(<SpriteViewer />);
    expect(screen.getByText('прозрачный PNG · хромакей снят')).toBeTruthy();
  });

  it('показывает дефолтные строки подписи, разбитые по «;»', () => {
    render(<SpriteViewer />);
    expect(screen.getByText(':3007/images/mia_happy.png')).toBeTruthy();
    expect(screen.getByText('poseFilenames.happy')).toBeTruthy();
  });

  it('без width берёт размер макета 220 и высоту по соотношению 2:3', () => {
    const { container } = render(<SpriteViewer />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('220px');
  });
});

describe('SpriteViewer, бейдж', () => {
  it('пустой badge скрывает бейдж', () => {
    render(<SpriteViewer badge="" />);
    expect(screen.queryByText('прозрачный PNG · хромакей снят')).toBeNull();
  });

  it('переданный badge заменяет дефолтный текст', () => {
    render(<SpriteViewer badge="ещё не сгенерирован" />);
    expect(screen.getByText('ещё не сгенерирован')).toBeTruthy();
  });
});

describe('SpriteViewer, подпись', () => {
  it('пустой caption скрывает блок подписи', () => {
    render(<SpriteViewer caption="" />);
    expect(screen.queryByText(':3007/images/mia_happy.png')).toBeNull();
  });

  it('одна строка caption без «;» рендерится одной строкой', () => {
    render(<SpriteViewer caption="mia_joy.png" />);
    expect(screen.getByText('mia_joy.png')).toBeTruthy();
  });

  it('лишние пробелы и пустые сегменты вокруг «;» отбрасываются', () => {
    render(<SpriteViewer caption=" a ; ; b " />);
    expect(screen.getByText('a')).toBeTruthy();
    expect(screen.getByText('b')).toBeTruthy();
  });
});

describe('SpriteViewer, размер', () => {
  it('width применяется к корню и масштабирует ширину/высоту шахматки', () => {
    const { container } = render(<SpriteViewer width={140} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.width).toBe('140px');
    const checker = root.querySelector('[style*="210px"]') as HTMLElement | null;
    expect(checker).not.toBeNull();
    expect(checker?.style.height).toBe('210px');
  });
});
