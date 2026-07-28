import { deriveHierarchy } from './hierarchyModel';

import type { HierarchyInputs, HierarchyNode } from './hierarchyModel';

/**
 * «Структура истории» — дерево из актов, битов, персонажей и локаций, и только.
 *
 * Сегодняшнее дерево иерархии смешивает два вопроса: как устроена история и
 * что из неё уже произведено. Поэтому строка про бит одновременно и «сцена в
 * кафе», и «генерируется, попытка 2», а автору, который ищет, куда вставить
 * поворот, приходится читать сквозь производственный шум.
 *
 * Разделение сделано в два хода. Здесь — первый: дерево строит по-прежнему
 * `deriveHierarchy` (одна реализация обхода лучше двух расходящихся), но
 * производственное состояние с него снимается. Ведомость производства живёт
 * отдельно, в `pipelineModel`. Второй ход — вынести саму сборку дерева из
 * `hierarchyModel` — делается, когда старый шелл перестанет её звать.
 */

export type StructureInputs = Omit<HierarchyInputs, 'issues' | 'runPhase' | 'audio'>;

export type StructureNode = Omit<HierarchyNode, 'state'> & {
  /** Только нарративные состояния: выделено или приглушено. Сбоев тут нет. */
  state: 'normal' | 'selected' | 'dim';
};

export function deriveStructure(inputs: StructureInputs): StructureNode[] {
  // Аудио-банк, сбои и фаза прогона не передаются намеренно: это производство.
  const nodes = deriveHierarchy({ ...inputs, issues: [], runPhase: null, audio: null });

  return nodes.map(node => ({
    ...node,
    // 'failed' и 'running' — производственные состояния; в структуре строка,
    // которую сейчас пересобирают, ничем не отличается от любой другой.
    state: node.state === 'dim' ? 'dim' : node.state === 'selected' ? 'selected' : 'normal',
  }));
}
