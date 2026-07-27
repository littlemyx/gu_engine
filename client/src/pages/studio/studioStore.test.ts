import { beforeEach, describe, expect, it } from 'vitest';

import { clampPanel, PANEL_LIMITS, useStudioStore } from './studioStore';

describe('размеры панелей', () => {
  beforeEach(() => useStudioStore.getState().resetPanelSizes());

  it('размер зажимается в границы панели', () => {
    expect(clampPanel('rail', 10)).toBe(PANEL_LIMITS.rail.min);
    expect(clampPanel('rail', 9999)).toBe(PANEL_LIMITS.rail.max);
    expect(clampPanel('inspector', 300)).toBe(300);
    // Дробные пиксели из перетаскивания округляются: субпиксельная ширина
    // колонки даёт дрожание рамки при каждом движении мыши.
    expect(clampPanel('dock', 240.6)).toBe(241);
  });

  it('перетаскивание за границу оставляет панель на пределе, а не ломает сетку', () => {
    useStudioStore.getState().setPanelSize('rail', -400);
    expect(useStudioStore.getState().railWidth).toBe(PANEL_LIMITS.rail.min);

    useStudioStore.getState().setPanelSize('inspector', 5000);
    expect(useStudioStore.getState().inspectorWidth).toBe(PANEL_LIMITS.inspector.max);
  });

  it('сброс возвращает и размеры, и свёрнутые панели', () => {
    useStudioStore.getState().setPanelSize('dock', 500);
    useStudioStore.getState().toggleRail();
    useStudioStore.getState().toggleInspector();
    expect(useStudioStore.getState().railOpen).toBe(false);

    useStudioStore.getState().resetPanelSizes();

    expect(useStudioStore.getState()).toMatchObject({
      railWidth: PANEL_LIMITS.rail.default,
      inspectorWidth: PANEL_LIMITS.inspector.default,
      dockHeight: PANEL_LIMITS.dock.default,
      railOpen: true,
      inspectorOpen: true,
      dockOpen: true,
    });
  });

  it('панели сворачиваются и разворачиваются независимо', () => {
    useStudioStore.getState().toggleRail();
    expect(useStudioStore.getState().railOpen).toBe(false);
    expect(useStudioStore.getState().inspectorOpen).toBe(true);

    useStudioStore.getState().toggleRail();
    expect(useStudioStore.getState().railOpen).toBe(true);
  });
});
