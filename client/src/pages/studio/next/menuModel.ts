import type { MenuItemMark } from '@/ui/kit/atoms/MenuItem';
import type { BottomTab, SidebarTab } from '../studioStore';

/**
 * Меню шелла «Конвейер»: из чего состоят столбцы и что делает каждый пункт.
 *
 * Вынесено из index.tsx отдельным слоем не ради красоты. Пункт меню без
 * действия — единственная поломка, которой не видно на экране: столбец
 * раскрывается, строка подсвечивается, клик не делает ничего. Здесь действие —
 * обязательное поле типа, а тест проходит по всем столбцам и проверяет, что
 * заперты ровно те пункты, которым сейчас нечего делать.
 *
 * MenuBar работает с парой строк («Файл», «Сохранить»), поэтому диспетчер тоже
 * ищет по паре — и сам сверяется с `disabled`, а не полагается на то, что
 * заблокированную кнопку нельзя нажать.
 */

export interface MenuAction {
  label: string;
  /** Хоткей mono-строкой у правого края. */
  hotkey?: string;
  /** Смета mono-строкой у правого края. */
  price?: string;
  mark?: MenuItemMark;
  /** Волосяная линия над пунктом — начало новой группы. */
  separator?: boolean;
  disabled?: boolean;
  run: () => void;
}

export interface MenuColumn {
  name: string;
  items: MenuAction[];
}

export interface MenuInputs {
  /** Идёт прогон: правки истории и файловые операции на это время заперты. */
  running: boolean;
  /** Идёт чтение или запись `.guproj`. */
  projectBusy: boolean;
  hasStory: boolean;
  /** Есть незакоммиченный черновик упавшего прогона. */
  hasDraft: boolean;
  /** Экспорт не пройдёт гейт — пункт ведёт в модалку с причинами. */
  exportBlocked: boolean;
  sidebarTab: SidebarTab;
  bottomTab: BottomTab;
  dockOpen: boolean;

  onNewProject: () => void;
  onOpenProject: () => void;
  /** Уход на экран выбора проекта: вкладка ведёт ровно один проект. */
  onSwitchProject: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  onOpenBrief: () => void;
  onImportBrief: () => void;
  onDiscardDraft: () => void;
  onExport: () => void;
  /** Открыть колл-щит: прогон подписывают, а не запускают из меню втихую. */
  onRun: () => void;
  onStop: () => void;
  onCheckStory: () => void;
  onSidebarTab: (tab: SidebarTab) => void;
  onBottomTab: (tab: BottomTab) => void;
  onToggleDock: () => void;
}

const DOCK_TABS: { id: BottomTab; label: string }[] = [
  { id: 'pipeline', label: 'Док: Пайплайн' },
  { id: 'feed', label: 'Док: Лента' },
  { id: 'runs', label: 'Док: Прогоны' },
  { id: 'prefabs', label: 'Док: Префабы' },
];

const SIDEBAR_TABS: { id: SidebarTab; label: string }[] = [
  { id: 'structure', label: 'Слева: Структура' },
  { id: 'pipeline', label: 'Слева: Пайплайн' },
];

export function buildMenu(i: MenuInputs): MenuColumn[] {
  // Файловые операции пишут в те же ключи, что и прогон: пока он идёт, файл
  // проекта — снимок наполовину собранной истории.
  const fileLocked = i.running || i.projectBusy;

  return [
    {
      name: 'Файл',
      items: [
        { label: 'Новый проект…', disabled: fileLocked, run: i.onNewProject },
        { label: 'Открыть…', disabled: fileLocked, run: i.onOpenProject },
        { label: 'Все проекты…', disabled: i.projectBusy, run: i.onSwitchProject },
        { label: 'Сохранить', separator: true, disabled: fileLocked, run: i.onSaveProject },
        { label: 'Сохранить как…', disabled: fileLocked, run: i.onSaveProjectAs },
      ],
    },
    {
      name: 'Правка',
      items: [
        { label: 'Бриф истории…', disabled: i.running, run: i.onOpenBrief },
        { label: 'Импорт брифа…', disabled: i.running, run: i.onImportBrief },
        { label: 'Сбросить черновик…', separator: true, disabled: !i.hasDraft || i.running, run: i.onDiscardDraft },
      ],
    },
    {
      name: 'Проект',
      items: [
        {
          label: 'Библиотека префабов',
          mark: i.dockOpen && i.bottomTab === 'prefabs' ? 'check' : 'none',
          run: () => i.onBottomTab('prefabs'),
        },
        {
          label: i.exportBlocked ? 'Экспорт игры — заблокирован' : 'Экспорт игры',
          separator: true,
          disabled: i.running,
          run: i.onExport,
        },
      ],
    },
    {
      name: 'Прогон',
      items: [
        { label: 'Продолжить конвейер', disabled: i.running, run: i.onRun },
        { label: 'Проверить историю', price: 'бесплатно', disabled: i.running || !i.hasStory, run: i.onCheckStory },
        { label: 'Остановить', separator: true, disabled: !i.running, run: i.onStop },
      ],
    },
    {
      name: 'Вид',
      items: [
        ...SIDEBAR_TABS.map(tab => ({
          label: tab.label,
          mark: (i.sidebarTab === tab.id ? 'radio' : 'none') as MenuItemMark,
          run: () => i.onSidebarTab(tab.id),
        })),
        ...DOCK_TABS.map((tab, index) => ({
          label: tab.label,
          separator: index === 0,
          mark: (i.dockOpen && i.bottomTab === tab.id ? 'check' : 'none') as MenuItemMark,
          run: () => i.onBottomTab(tab.id),
        })),
        { label: 'Нижняя панель', separator: true, mark: i.dockOpen ? 'check' : 'none', run: i.onToggleDock },
      ],
    },
  ];
}

/** Пункт по паре (столбец, подпись) — тем же ключом, каким его отдаёт MenuBar. */
export function findMenuItem(columns: MenuColumn[], menu: string, label: string): MenuAction | undefined {
  return columns.find(column => column.name === menu)?.items.find(item => item.label === label);
}

/**
 * Выполнить пункт меню. Возвращает, случилось ли что-нибудь: false значит
 * пункт заперт или его вовсе нет — обе ситуации интересны тесту.
 */
export function runMenuItem(columns: MenuColumn[], menu: string, label: string): boolean {
  const item = findMenuItem(columns, menu, label);
  if (!item || item.disabled) return false;
  item.run();
  return true;
}
