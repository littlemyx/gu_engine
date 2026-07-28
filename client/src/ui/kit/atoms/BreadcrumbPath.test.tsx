/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import BreadcrumbPath from './BreadcrumbPath';

afterEach(cleanup);

const PATH = 'Акт II › слот Д5в › Б5 «Ссора»';

describe('BreadcrumbPath, разбор пути', () => {
  it('рисует по одному сегменту на часть пути и разделители между ними', () => {
    render(<BreadcrumbPath path={PATH} />);

    expect(screen.getByText('Акт II')).toBeTruthy();
    expect(screen.getByText('слот Д5в')).toBeTruthy();
    expect(screen.getByText('Б5 «Ссора»')).toBeTruthy();
    expect(screen.getAllByText('›')).toHaveLength(2);
  });

  it('одиночный сегмент — без разделителей', () => {
    render(<BreadcrumbPath path="Акт II" />);

    expect(screen.getByText('Акт II')).toBeTruthy();
    expect(screen.queryByText('›')).toBeNull();
  });

  it('последний сегмент получает акцентный класс, остальные — нет', () => {
    render(<BreadcrumbPath path={PATH} />);

    const last = screen.getByText('Б5 «Ссора»');
    const first = screen.getByText('Акт II');

    expect(last.className).not.toBe(first.className);
  });
});

describe('BreadcrumbPath, состояние bold', () => {
  it('по умолчанию последний сегмент жирный', () => {
    render(<BreadcrumbPath path={PATH} />);

    expect(screen.getByText('Б5 «Ссора»').className).toContain('bold');
  });

  it('bold={false} убирает жирность у последнего сегмента', () => {
    render(<BreadcrumbPath path={PATH} bold={false} />);

    expect(screen.getByText('Б5 «Ссора»').className).not.toContain('bold');
  });
});

describe('BreadcrumbPath, светлое и тёмное', () => {
  it('на тёмном хроме получает отдельный класс корня', () => {
    const { container: light } = render(<BreadcrumbPath path={PATH} />);
    const lightClass = light.firstElementChild?.className ?? '';
    cleanup();

    const { container: dark } = render(<BreadcrumbPath path={PATH} onDark />);
    expect(dark.firstElementChild?.className).not.toBe(lightClass);
    expect(dark.firstElementChild?.className).toContain('onDark');
  });
});

describe('BreadcrumbPath, размер', () => {
  it('проп size идёт в font-size корня, по умолчанию 10.5px', () => {
    const { container } = render(<BreadcrumbPath path={PATH} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.fontSize).toBe('10.5px');
  });

  it('кастомный size переопределяет умолчание', () => {
    const { container } = render(<BreadcrumbPath path={PATH} size={13} />);
    const root = container.firstElementChild as HTMLElement;

    expect(root.style.fontSize).toBe('13px');
  });
});
