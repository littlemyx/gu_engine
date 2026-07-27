import React, { useState } from 'react';

import { truncate } from '@/narrative/sliceModel';

import Menu from './Menu';

import type { MenuItem } from './Menu';
import type { SpinePlan } from '@/narrative/calendarTypes';

export interface BranchPickerProps {
  spine: SpinePlan | null;
  /** branchPointId → выбранный outcomeId. */
  assignment: Record<string, string>;
  onPick: (branchPointId: string, outcomeId: string | null) => void;
  onReset: () => void;
}

/**
 * Выбор ветки в панели действий: чем смотреть историю. Это настройка показа,
 * а не параметр генерации — выбранный исход гасит контент чужих веток во всех
 * вьюпортах сразу, но в бандл едут все ветки целиком.
 */
const BranchPicker = ({ spine, assignment, onPick, onReset }: BranchPickerProps) => {
  const [open, setOpen] = useState(false);

  const branchPoints = (spine?.beats ?? []).filter(
    beat => beat.kind === 'branchPoint' && (beat.outcomes?.length ?? 0) > 0,
  );

  const chosenCount = Object.keys(assignment).filter(id => branchPoints.some(b => b.id === id)).length;

  const label = (() => {
    if (branchPoints.length === 0) return 'веток нет ▾';
    if (chosenCount === 0) return 'все ▾';
    if (chosenCount === 1) {
      const [branchId, outcomeId] = Object.entries(assignment)[0];
      const outcome = branchPoints.find(b => b.id === branchId)?.outcomes?.find(o => o.id === outcomeId);
      return `${truncate(outcome?.label || outcomeId, 22)} ▾`;
    }
    return `${chosenCount} веток ▾`;
  })();

  const items: MenuItem[] = [
    { label: 'Все ветки', checked: chosenCount === 0, onSelect: onReset },
    ...branchPoints.flatMap((beat): MenuItem[] => [
      { kind: 'separator' },
      // Заголовок развилки: неактивный пункт, чтобы исходы читались под ней.
      { label: truncate(beat.summary || beat.id, 42), disabled: true },
      ...(beat.outcomes ?? []).map((outcome): MenuItem => {
        const active = assignment[beat.id] === outcome.id;
        return {
          label: truncate(outcome.label || outcome.id, 42),
          checked: active,
          // Повторный выбор снимает фильтр — иначе из ветки было бы не выйти.
          onSelect: () => onPick(beat.id, active ? null : outcome.id),
        };
      }),
    ]),
  ];

  return (
    <Menu
      label={label}
      items={items}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      onHover={() => undefined}
      variant="toolbar"
      disabled={branchPoints.length === 0}
    />
  );
};

export default BranchPicker;
