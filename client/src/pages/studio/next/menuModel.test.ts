import { describe, expect, it, vi } from 'vitest';

import { buildMenu, findMenuItem, runMenuItem, type MenuInputs } from './menuModel';

/** Все обработчики — шпионы: тест смотрит, какой пункт какой из них дёрнул. */
function inputs(over: Partial<MenuInputs> = {}) {
  const spies = {
    onNewProject: vi.fn(),
    onOpenProject: vi.fn(),
    onSwitchProject: vi.fn(),
    onSaveProject: vi.fn(),
    onSaveProjectAs: vi.fn(),
    onOpenBrief: vi.fn(),
    onImportBrief: vi.fn(),
    onDiscardDraft: vi.fn(),
    onExport: vi.fn(),
    onRun: vi.fn(),
    onStop: vi.fn(),
    onCheckStory: vi.fn(),
    onSidebarTab: vi.fn(),
    onBottomTab: vi.fn(),
    onToggleDock: vi.fn(),
  };

  const base: MenuInputs = {
    running: false,
    projectBusy: false,
    hasStory: true,
    hasDraft: false,
    exportBlocked: false,
    sidebarTab: 'structure',
    bottomTab: 'pipeline',
    dockOpen: true,
    ...spies,
    ...over,
  };

  return { menu: buildMenu(base), spies };
}

describe('buildMenu', () => {
  it('у каждого пункта есть действие — витрин в меню нет', () => {
    const { menu } = inputs();
    const items = menu.flatMap(column => column.items);

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(typeof item.run, item.label).toBe('function');
    }
  });

  it('пункт вызывает свой обработчик', () => {
    const { menu, spies } = inputs();

    expect(runMenuItem(menu, 'Файл', 'Сохранить')).toBe(true);
    expect(spies.onSaveProject).toHaveBeenCalledTimes(1);

    expect(runMenuItem(menu, 'Правка', 'Бриф истории…')).toBe(true);
    expect(spies.onOpenBrief).toHaveBeenCalledTimes(1);

    expect(runMenuItem(menu, 'Прогон', 'Продолжить конвейер')).toBe(true);
    expect(spies.onRun).toHaveBeenCalledTimes(1);
  });

  it('несуществующий пункт ничего не запускает', () => {
    const { menu } = inputs();
    expect(runMenuItem(menu, 'Файл', 'Телепортировать')).toBe(false);
    expect(runMenuItem(menu, 'Меню-призрак', 'Сохранить')).toBe(false);
  });

  it('во время прогона заперты файловые пункты и запуск, открыт только стоп', () => {
    const { menu, spies } = inputs({ running: true });

    expect(findMenuItem(menu, 'Файл', 'Сохранить')?.disabled).toBe(true);
    expect(findMenuItem(menu, 'Файл', 'Новый проект…')?.disabled).toBe(true);
    expect(findMenuItem(menu, 'Прогон', 'Продолжить конвейер')?.disabled).toBe(true);
    expect(findMenuItem(menu, 'Прогон', 'Остановить')?.disabled).toBe(false);

    expect(runMenuItem(menu, 'Файл', 'Сохранить')).toBe(false);
    expect(spies.onSaveProject).not.toHaveBeenCalled();

    expect(runMenuItem(menu, 'Прогон', 'Остановить')).toBe(true);
    expect(spies.onStop).toHaveBeenCalledTimes(1);
  });

  it('вне прогона «Остановить» заперт', () => {
    const { menu } = inputs({ running: false });
    expect(findMenuItem(menu, 'Прогон', 'Остановить')?.disabled).toBe(true);
  });

  it('файловая операция запирает файловые пункты, но не переход к списку проектов', () => {
    const { menu } = inputs({ projectBusy: true });
    expect(findMenuItem(menu, 'Файл', 'Открыть…')?.disabled).toBe(true);
    expect(findMenuItem(menu, 'Файл', 'Все проекты…')?.disabled).toBe(true);
  });

  it('сброс черновика доступен только когда черновик есть', () => {
    expect(findMenuItem(inputs({ hasDraft: false }).menu, 'Правка', 'Сбросить черновик…')?.disabled).toBe(true);
    expect(findMenuItem(inputs({ hasDraft: true }).menu, 'Правка', 'Сбросить черновик…')?.disabled).toBe(false);
  });

  it('проверка истории требует истории', () => {
    expect(findMenuItem(inputs({ hasStory: false }).menu, 'Прогон', 'Проверить историю')?.disabled).toBe(true);
    expect(findMenuItem(inputs({ hasStory: true }).menu, 'Прогон', 'Проверить историю')?.disabled).toBe(false);
  });

  it('заблокированный экспорт называет себя, но остаётся кликабельным — модалка объясняет причины', () => {
    const { menu, spies } = inputs({ exportBlocked: true });
    const item = findMenuItem(menu, 'Проект', 'Экспорт игры — заблокирован');

    expect(item?.disabled).toBe(false);
    expect(runMenuItem(menu, 'Проект', 'Экспорт игры — заблокирован')).toBe(true);
    expect(spies.onExport).toHaveBeenCalledTimes(1);
  });

  it('«Вид» отмечает текущую панель и открытую вкладку дока', () => {
    const { menu, spies } = inputs({ sidebarTab: 'pipeline', bottomTab: 'feed', dockOpen: true });

    expect(findMenuItem(menu, 'Вид', 'Слева: Пайплайн')?.mark).toBe('radio');
    expect(findMenuItem(menu, 'Вид', 'Слева: Структура')?.mark).toBe('none');
    expect(findMenuItem(menu, 'Вид', 'Док: Лента')?.mark).toBe('check');
    expect(findMenuItem(menu, 'Вид', 'Док: Пайплайн')?.mark).toBe('none');
    expect(findMenuItem(menu, 'Вид', 'Нижняя панель')?.mark).toBe('check');

    runMenuItem(menu, 'Вид', 'Слева: Структура');
    expect(spies.onSidebarTab).toHaveBeenCalledWith('structure');

    runMenuItem(menu, 'Вид', 'Док: Прогоны');
    expect(spies.onBottomTab).toHaveBeenCalledWith('runs');
  });

  it('свёрнутый док не отмечен галкой ни одной вкладкой', () => {
    const { menu } = inputs({ dockOpen: false, bottomTab: 'feed' });
    expect(findMenuItem(menu, 'Вид', 'Док: Лента')?.mark).toBe('none');
    expect(findMenuItem(menu, 'Вид', 'Нижняя панель')?.mark).toBe('none');
  });

  it('библиотека префабов ведёт во вкладку дока', () => {
    const { menu, spies } = inputs();
    expect(runMenuItem(menu, 'Проект', 'Библиотека префабов')).toBe(true);
    expect(spies.onBottomTab).toHaveBeenCalledWith('prefabs');
  });
});
