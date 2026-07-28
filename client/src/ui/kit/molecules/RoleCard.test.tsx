/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import RoleCard, { type RoleCardCast } from './RoleCard';

afterEach(cleanup);

describe('RoleCard, слот и имя', () => {
  it('показывает слот и имя роли', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" />);
    expect(screen.getByText('LI-1')).toBeTruthy();
    expect(screen.getByText('Кира')).toBeTruthy();
  });
});

describe('RoleCard, происхождение роли (cast)', () => {
  it('linked: показывает бейдж с подписью префаба и меткой linked', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" cast="linked" castLabel="префаб «Кира» v2" />);
    expect(screen.getByText('префаб «Кира» v2 · linked')).toBeTruthy();
    expect(screen.getByText('⇄')).toBeTruthy();
  });

  it('manual: показывает бейдж «руками»', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" cast="manual" />);
    expect(screen.getByText('руками')).toBeTruthy();
    expect(screen.getByText('✎')).toBeTruthy();
  });

  it('generated: показывает бейдж «сгенерировать»', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" cast="generated" />);
    expect(screen.getByText('сгенерировать')).toBeTruthy();
    expect(screen.getByText('⚙')).toBeTruthy();
  });

  it('unassigned: бейдж происхождения не рисуется', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" cast="unassigned" castLabel="префаб «Кира» v2" />);
    expect(screen.queryByText(/линкован|linked/)).toBeNull();
    expect(screen.queryByText('руками')).toBeNull();
    expect(screen.queryByText('сгенерировать')).toBeNull();
  });

  it('по умолчанию cast=linked', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" castLabel="префаб «Кира» v2" />);
    expect(screen.getByText('префаб «Кира» v2 · linked')).toBeTruthy();
  });
});

describe('RoleCard, заметка', () => {
  it('показывает note, если она задана', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" note="2 оверрайда: speechPattern, палитра" />);
    expect(screen.getByText('2 оверрайда: speechPattern, палитра')).toBeTruthy();
  });

  it('не рисует блок заметки при пустой note', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" note="" />);
    expect(screen.queryByText(/оверрайда/)).toBeNull();
  });
});

describe('RoleCard, бейдж обновления', () => {
  it('hasUpdate=false — бейдж обновления не рисуется', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" hasUpdate={false} />);
    expect(screen.queryByText(/diff/)).toBeNull();
  });

  it('hasUpdate=true без onDiff — бейдж виден, но кнопки нет', () => {
    render(<RoleCard slot="LI-1" roleName="Кира" hasUpdate updateLabel="есть v3 · diff ▾" />);
    expect(screen.getByText('есть v3 · diff ▾')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hasUpdate=true с onDiff — клик по бейджу вызывает колбэк', () => {
    const onDiff = vi.fn();
    render(<RoleCard slot="LI-1" roleName="Кира" hasUpdate updateLabel="есть v3 · diff ▾" onDiff={onDiff} />);
    const button = screen.getByRole('button', { name: 'есть v3 · diff ▾' });
    fireEvent.click(button);
    expect(onDiff).toHaveBeenCalledTimes(1);
  });
});

describe('RoleCard, выделение', () => {
  it('selected меняет класс корня карточки', () => {
    const { container: plain } = render(<RoleCard slot="LI-1" roleName="Кира" />);
    const plainClass = plain.firstElementChild?.className ?? '';
    cleanup();

    const { container: picked } = render(<RoleCard slot="LI-1" roleName="Кира" selected />);
    expect(picked.firstElementChild?.className).not.toBe(plainClass);
  });
});

const CASTS: RoleCardCast[] = ['linked', 'manual', 'generated', 'unassigned'];

describe.each(CASTS)('RoleCard, вариант cast=%s', cast => {
  it('рендерится без ошибок и показывает слот', () => {
    render(<RoleCard slot="LI-2" roleName="Феликс" cast={cast} />);
    expect(screen.getByText('LI-2')).toBeTruthy();
    expect(screen.getByText('Феликс')).toBeTruthy();
  });
});
