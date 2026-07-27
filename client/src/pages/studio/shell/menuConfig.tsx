import type { MenuGroup } from './MenuBar';
import type { DockTab, ViewportTab } from '../studioStore';

export type MenuConfigInputs = {
  running: boolean;
  hasSpine: boolean;
  hasDraft: boolean;
  /** Экспорт заблокирован (QA или неполный стек) — пункт ведёт в модалку. */
  exportBlocked: boolean;
  viewportTab: ViewportTab;
  dockTab: DockTab;
  dockOpen: boolean;
  setViewportTab: (tab: ViewportTab) => void;
  setDockTab: (tab: DockTab) => void;
  onGenerate: () => void;
  onContinueDraft: () => void;
  onCheckStory: () => void;
  onDiscardDraft: () => void;
  onStop: () => void;
  onOpenRun: () => void;
  onExport: () => void;
  onImportBrief: () => void;
  onOpenBrief: () => void;
  onOpenSelector: () => void;
  onOpenLocationMoods: () => void;
  onOpenPoses: () => void;
  /** Открыть закрываемую вкладку «Аудио» с инспектором запуска. */
  onOpenAudio: () => void;
  /** Открыть вкладку «Отношения»: присутствие и покрытие брекетов. */
  onOpenRelations: () => void;
  onNewProject: () => void;
  onOpenProject: () => void;
  /** Уход на экран выбора проекта: вкладка ведёт ровно один проект. */
  onSwitchProject: () => void;
  onSaveProject: () => void;
  onSaveProjectAs: () => void;
  /** Идёт сохранение или открытие файла: файловые пункты на это время заперты. */
  projectBusy: boolean;
  onSavePrefab: () => void;
  /** Есть что сохранять префабом: выделен персонаж или локация. */
  canSavePrefab: boolean;
  onResetBranches: () => void;
  hasBranchChoice: boolean;
  railOpen: boolean;
  inspectorOpen: boolean;
  onToggleRail: () => void;
  onToggleInspector: () => void;
  onToggleDock: () => void;
  onResetPanels: () => void;
};

const VIEW_TABS: { id: ViewportTab; label: string }[] = [
  { id: 'blueprint', label: 'Чертёж' },
  { id: 'score', label: 'Партитура' },
  { id: 'script', label: 'Сценарий' },
  { id: 'world', label: 'Карта мира' },
];

const DOCK_TABS: { id: DockTab; label: string }[] = [
  { id: 'prefabs', label: 'Док: Префабы' },
  { id: 'assets', label: 'Док: Ассеты' },
  { id: 'qa', label: 'Док: QA' },
];

/**
 * Меню шелла. Правила дизайна: стоимость печатается прямо в пункте,
 * разрушающие действия стоят за разделителем и ведут в модалку,
 * «Остановить прогон» активен только во время прогона, • отмечает текущую
 * вкладку вьюпорта, ✓ — включённую панель.
 */
export function buildMenuGroups(inputs: MenuConfigInputs): MenuGroup[] {
  const {
    running,
    hasSpine,
    hasDraft,
    exportBlocked,
    viewportTab,
    dockTab,
    dockOpen,
    setViewportTab,
    setDockTab,
    onGenerate,
    onContinueDraft,
    onCheckStory,
    onDiscardDraft,
    onStop,
    onOpenRun,
    onExport,
    onImportBrief,
    onOpenBrief,
    onOpenSelector,
    onOpenLocationMoods,
    onOpenPoses,
    onOpenAudio,
    onOpenRelations,
    onNewProject,
    onOpenProject,
    onSwitchProject,
    onSaveProject,
    onSaveProjectAs,
    projectBusy,
    onSavePrefab,
    canSavePrefab,
    onResetBranches,
    hasBranchChoice,
    railOpen,
    inspectorOpen,
    onToggleRail,
    onToggleInspector,
    onToggleDock,
    onResetPanels,
  } = inputs;

  return [
    {
      label: 'Файл',
      items: [
        { label: 'Новый', disabled: running || projectBusy, onSelect: onNewProject },
        { label: 'Открыть…', disabled: running || projectBusy, onSelect: onOpenProject },
        { label: 'Все проекты…', disabled: projectBusy, onSelect: onSwitchProject },
        { kind: 'separator' },
        { label: 'Сохранить', disabled: running || projectBusy, onSelect: onSaveProject },
        { label: 'Сохранить как…', disabled: running || projectBusy, onSelect: onSaveProjectAs },
        { kind: 'separator' },
        { label: 'Импорт брифа…', disabled: running, onSelect: onImportBrief },
        { kind: 'separator' },
        {
          label: exportBlocked ? 'Скачать бандл (v2) — заблокирован' : 'Скачать бандл (v2)',
          disabled: !hasSpine || running,
          onSelect: onExport,
        },
      ],
    },
    {
      label: 'Правка',
      items: [
        {
          label: 'Сбросить выбор веток',
          disabled: !hasBranchChoice,
          onSelect: onResetBranches,
        },
        { kind: 'separator' },
        {
          label: 'Сбросить черновик…',
          danger: true,
          disabled: !hasDraft || running,
          onSelect: onDiscardDraft,
        },
      ],
    },
    {
      label: 'Проект',
      items: [
        { label: 'Бриф истории…', disabled: running, onSelect: onOpenBrief },
        { kind: 'separator' as const },
        { label: 'Библиотека префабов', onSelect: () => setDockTab('prefabs') },
        {
          label: 'Выделенное → префаб…',
          disabled: !canSavePrefab,
          onSelect: onSavePrefab,
        },
      ],
    },
    {
      label: 'Генерация',
      items: [
        {
          label: hasSpine ? 'Перегенерировать историю' : 'Сгенерировать историю',
          cost: '≈ $0.50',
          disabled: running,
          onSelect: onGenerate,
        },
        {
          label: 'Продолжить черновик',
          disabled: !hasDraft || running,
          onSelect: onContinueDraft,
        },
        { label: 'Показать прогон в инспекторе', onSelect: onOpenRun },
        { kind: 'separator' },
        // Ручки медиа-конвейера: настройки выставляются до запуска генерации.
        { label: 'Режиссура · веса…', onSelect: onOpenSelector },
        { label: 'Аудио · банк и запуск', onSelect: onOpenAudio },
        { label: 'Настроения локаций…', onSelect: onOpenLocationMoods },
        { label: 'Недостающие позы…', onSelect: onOpenPoses },
        { kind: 'separator' },
        { label: 'Остановить прогон', disabled: !running, danger: true, onSelect: onStop },
      ],
    },
    {
      label: 'QA',
      items: [
        { label: 'Проверить историю', cost: 'бесплатно', disabled: running, onSelect: onCheckStory },
        { label: 'Открыть отчёт', onSelect: () => setDockTab('qa') },
        { label: 'Отношения · покрытие', onSelect: onOpenRelations },
      ],
    },
    {
      label: 'Вид',
      items: [
        ...VIEW_TABS.map(tab => ({
          label: tab.label,
          current: viewportTab === tab.id,
          onSelect: () => setViewportTab(tab.id),
        })),
        { kind: 'separator' as const },
        ...DOCK_TABS.map(tab => ({
          label: tab.label,
          checked: dockOpen && dockTab === tab.id,
          onSelect: () => setDockTab(tab.id),
        })),
        { kind: 'separator' as const },
        { label: 'Панель: иерархия', checked: railOpen, onSelect: onToggleRail },
        { label: 'Панель: инспектор', checked: inspectorOpen, onSelect: onToggleInspector },
        { label: 'Панель: док', checked: dockOpen, onSelect: onToggleDock },
        { label: 'Размеры панелей по умолчанию', onSelect: onResetPanels },
      ],
    },
    {
      label: 'Справка',
      items: [{ label: 'О GU Engine', disabled: true }],
    },
  ];
}
