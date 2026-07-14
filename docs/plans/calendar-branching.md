# План: календарное время, агенды персонажей, истинные ветки сюжета

## Context

Диагноз (разобран ранее): в текущей архитектуре «срез времени = якорь outline» — у `StoryAnchor` одна
`location` и непарсимый текстовый `timeMarker`, srez z = топологический индекс якоря (sliceModel.ts:164).
В один момент времени существует ровно одна локация с событиями; игрок никогда не выбирает, куда пойти;
реиграбельность сводится к брекетам диалогов. Нужно: время как первоклассная дискретная ось, несколько
локаций с событиями на каждый «тик», многопроходная генерация (сначала персонажи, потом события),
ветвящийся сюжетный хребет — и всё это без комбинаторного взрыва контента и LLM-вызовов.

Решения пользователя: (1) влить feat/playground-montage в локальный main без push, работать в новой ветке;
(2) истинные глобальные ветки сюжета (без принудительного схождения); (3) весь контент генерируется
заранее в редакторе, standalone-сборка сохраняется; (4) многоуровневые модели, но провайдер текста —
только OpenAI (gpt-4.1-mini уже legacy); (5) обязательный этап верификации сгенерированной истории:
непротиворечивость битов, достижимость всех веток, полнота диалогов — никаких обрывов «спросил персонажа →
экран перехода в локацию»; (6) диалоги продумать отдельно и выделить в собственную сущность,
отвязанную от истории/перемещения.

Опора на готовые паттерны (research): storylets/QBN (guard-ы вместо рёбер → O(units), не O(paths)),
календарь-хабы dating-sim (Persona/Tokimeki), агенды персонажей (Generative Agents / StoryVerse abstract
acts), beat-manager для хребта (Façade). Опубликованные системы этого стека: StoryVerse (arxiv 2405.13042),
Anansi (ICIDS 2024). Ключевой актив в коде: модель событий `events.ts` (guard/effect-алгебра, позиции
per-character, evaluateSlice с каскадами) — построена ровно для этого, но не подключена никуда, кроме
тестов и MontageBoard.

## Step 0 — git

```
git checkout main
git merge --ff-only feat/playground-montage   # ветка ровно на 1 коммит впереди — проверено
git checkout -b feat/calendar-branching
```
Без push (по договорённости). Этот план закоммитить в ветку как `docs/plans/calendar-branching.md`.

## Ключевые проектные решения

- **Слот = (день, время суток)**: `slot = day*3 + daypart` (утро/день/вечер), единый integer — ложится на
  численные условия движка `{path, gte, lte}` без изменений engine. `slotCount = clamp(minutes/3, 9, 36)`.
  Биты хребта НЕ пришпилены к слоту — несут окно `{fromSlot, toSlot}` (+deadline для act-gate) — иначе
  воспроизведём конфляцию якорь=время.
- **availableLIs умирает** → `CharacterSchedule` (char × slot → locationId|null), детерминированно
  разворачивается в клиенте (`buildSchedule.ts`) из LLM-агенд (weekly-паттерны по тегам локаций) +
  привязок к битам хребта. Ноль LLM-вызовов на расписание; валидируемо и переигрываемо.
- **Истинные ветки = branchPoint-биты + spine-флаги в ОДНОМ общем календаре**: бюджет
  `Brief.scale.branchPointBudget` (default 2, максимум 3; листьев ≤8). Ветка добавляет флаги, которые
  guard-ы контента проверяют, а не копии контента. Общие биты пишутся один раз без spine-guard-а.
  Концовки — guarded-юниты (spine-флаги + брекет LI), роутер: сначала флаги, потом affection.
- **Монтажка: z = индекс слота**, срез содержит НЕСКОЛЬКО локаций-боксов; вкладка «Граф якорей»
  перепрофилируется в граф битов хребта (ромбы = branchPoints, рёбра = флаговые зависимости);
  селектор веток фильтрует reachability (переиспользуя evaluateSlice для превью).
- **Диалоги: ровно 3 брекета на encounter-юнит, НЕ умножаем на ветки.** Ветвовой колорит — через
  отдельные branch-guarded юниты, посчитанные в бюджете битов.
- **Диалог — первоклассная сущность, отвязанная от истории/перемещения (`DialogueUnit`).** Причина:
  сегодня выход из диалога = choice с `nextSceneId:null`, компилируемый ребром прямо в хаб
  (compileWorldGame.ts:399), а «вопрос не может быть выходом» держится на регэксп-эвристике
  isQuestionChoice (types.ts:1059) — отсюда обрывы «спросил → экран локации». Новый контракт:
  * У choice появляется обязательный typed `kind: ask | say | react | farewell` (LLM обязан его выдать —
    эвристика заменяется структурой; isQuestionChoice остаётся warning-линтом рассинхрона kind/text).
  * `nextSceneId:null` исчезает. ask/say/react обязаны вести к сцене внутри юнита; farewell ведёт к
    **closing-узлу** (прощальная сцена с финальной репликой персонажа) — и только closing-узлы
    компилируются в возврат в хаб.
  * Эффекты движения (met, slot+1, возврат в хаб) переезжают из choices диалога на closing-переход
    encounter-обёртки компилятора — диалог мутирует только relationship/флаги и ничего не знает о
    локациях/слотах. Это и есть отделение сущности диалога от сущности истории/перемещения.
  * Структурный валидатор полноты: каждый узел достижим из entry; каждый путь достигает closing-узла
    за ≤maxDepth; ≥1 closing-узел с непустой репликой LI; у ask следующая сцена содержит ответ (dialogue
    от спрошенного персонажа непуст).
- **Легаси (OutlinePlan/segments/narrationWebs/legacy-конвертеры) удаляем только в финальной фазе**;
  `convertToGameProject.ts` остаётся как модуль утилит (bracketCondition, buildStoryStateSchema и др.).

## Новая модель данных (`client/src/narrative/calendarTypes.ts`, новый файл)

`Calendar {days, dayparts[], slotCount, actBoundaries[], specialDays?}`;
`CastPlan {members: [{id, isLI, agenda: {goals[], weeklyPattern, locationTags}}]}`;
`SpinePlan {title, logline, beats: SpineBeat[], endings: [{id, kind, liId?, guard}]}` где
`SpineBeat {id, kind: beat|branchPoint|actGate|finale, act, window, locationId, participants[]
 (допустимы placeholder-ы "$closestLI"), summary, establishes[], guard, outcomes?}`;
`CharacterSchedule = Record<charId, (locId|null)[]>`;
`EventUnit = EventDef & {goal, arcStage?, source: spine|agenda|filler}`.

`events.ts` — минимальные аддитивные правки: `TimeSlice.slot`, slot-окно в `matchesSlice`, guard
`{slot: {op, value}}`. events.test.ts остаётся зелёным (legacy-поля опциональны).
`Brief.scale` + `branchPointBudget` (briefStore v1→v2). narrativeStore v8→v9: новые поля
(castPlan, calendar, spine, schedule, eventUnits, unitProse, spineBeatProse) + каскадные сеттеры
по образцу setStoryOutline (narrativeStore.ts:236); v10 (в финале) выкидывает legacy-поля.

## Многопроходный пайплайн генерации

Сохраняем всю механику text_gen: endpoint → in-memory batch → polling `/status/:batchId`; retry-цикл
previousAttempt/previousIssues + best-of (шаблон — useBulkStoryGeneration.ts:89-153). Новые endpoint-ы —
в openapi.yaml + регенерация generated_client тем же коммитом.

| # | Стадия | Tier | Выход | Валидатор (ключевые проверки) |
|---|--------|------|-------|-------------------------------|
| A1 | castPlan | A | персоны+цели+weekly-паттерны по тегам | цели на каждую стадию арки; покрытие dayparts |
| A2 | worldCalendar | B | WorldModel + Calendar + tagMap | BFS-связность (реюз validateWorldModel); каждый тег → ≥1 локация |
| A3 | spine | A | SpinePlan | DAG флагов ацикличен; ровно branchPointBudget развилок; каждый лист достигает финала и ≥1 выполнимой концовки; окна в актах; арки LI завершимы |
| B1 | schedule (без LLM) | — | CharacterSchedule | каждый слот: ≥2 осмысленные локации; LI на сцене ≥K слотов/акт |
| B2 | eventPool (параллельно, char×arcStage) | B | EventUnit[] — шеллы guard+goal+effects, БЕЗ прозы | известные флаги; rel-дельты в границах архетипа; цепочки через fired |
| B3 | reachability (без LLM) | — | множество достижимых юнитов | BFS по абстрактному состоянию (slot × ветвовые флаги × брекеты); недостижимым прозу не генерируем |
| C1 | beatProse (адаптация anchorBeat) | A для branchPoint/finale, B для рядовых | beatText+transitions | реюз validateAnchorBeat; branchPoint подаёт outcomes как выборы |
| C2 | dialogueUnit (эволюция dialogueVariant) | C | DialogueUnit c typed choices и closing-узлами | новый validateDialogueUnit: структурная полнота (см. контракт диалога выше) |
| C3 | ending (существующий) | B | без изменений формы | + упоминание исхода ветки |
| D1 | dialogueQA — LLM-критик на юнит | B | issues[] | «каждый ask получает содержательный ответ», «тон = брекету», «closing звучит завершением»; issues → общий retry-цикл |
| D2 | storyQA-структурный (без LLM) | — | отчёт | флаговые противоречия (guard требует флаг, который не establish-ится ни на одном достижимом пути); достижимость каждого листа/концовки; коллизии окон |
| D3 | storyQA-симуляция (без LLM) | — | отчёт | прогон N политик по evaluateSlice (greedy-LI, round-robin, spine-only, seeded random): каждый прогон достигает концовки, нет мёртвых слотов, арки LI прогрессируют |
| D4 | storyQA-критик листьев | A | issues[] на лист ветки | лента summary битов одного листа → противоречия сюжета, непрерывность знаний персонажей (≤8 вызовов при бюджете 2 развилок) |

Оркестрация: новый `useBulkCalendarGeneration.ts` (cast → world_calendar → spine → schedule → event_pool
→ prune → beat_prose → dialogue_variants → endings), CONCURRENCY=3 — паттерны копируются.

## Почему нет комбинаторного взрыва

Пример (3 LI, 8 локаций, 27 слотов, 2 бинарные развилки = 4 листа): ~26 битов хребта (14 общих + 4×3
ветвовых), ~30 encounter-юнитов, ≤90 диалоговых проз (реже — pruning режет 10-25%), ≤8 концовок →
**~130 LLM-вызовов против ~140 сегодня**. Механизмы: (1) guard-ы вместо рёбер — ветка добавляет флаги,
а не копии контента; (2) вся абстракция состояния = 3 брекета × ≤8 листьев; (3) контекст каждого вызова
O(1): бриф-выжимка + карточка персонажа + ≤4 локальных summary (дисциплина last-4 уже в
buildAnchorBeatRequest). Reachability-pruning заменяет play-time-ленивость при полной прегенерации.

## Компиляция и рантайм

Новый `compileCalendarGame.ts` (шаблон — compileWorldGame.ts: хабы, роутеры, ending-router, манифест мира;
старый компилятор не трогаем до финала, экспорт выбирает новый при `spine != null`). Маппинг EventDef →
движок: slot-окно → `[{path:'slot',gte},{path:'slot',lte}]` — впервые условия ЧИТАЮТ время; flag/fired →
0/1-переменные (паттерн evt[...]); bracket → существующий bracketCondition; at(char,loc) компилируется
статически через расписание. **Тик: перемещение бесплатно, слот двигает потребление контента** (бит/встреча
= slot+1, прямой наследник сегодняшних time-дельт) + кнопка «Подождать» (slot+1) на каждом хабе.
Движок game/src/engine.ts НЕ меняется; .gu.json settings + `calendar`; новый `game/src/calendarState.ts`
(HUD «День 3 · вечер») по образцу worldState.ts. evaluateSlice становится общей семантикой для
валидации/превью/компиляции.

## Монтажка / UI

`deriveMontageModel` остаётся единой точкой деривации; `MontageSlice.locations[]` вместо одной локации;
кадры рендерят 1-3 бокса, лейблы «день N · daypart» из Calendar; OutlineGraph → граф битов
(x = window.fromSlot, y = ветвовая дорожка); селектор веток над доской, недостижимое гасится;
CharacterRelationshipPanel переходит на schedule × arcStage.

## Модели (Tier A/B/C) — ТОЛЬКО OpenAI (решение пользователя)

По ценовому research июль-2026 (официальная страница цен OpenAI; gpt-4.1-mini оттуда уже исчез — legacy):
**A → gpt-5.6-terra** ($2.5/$15: ≈$0.58/история), **B → gpt-5.4-mini** ($0.75/$4.5: ≈$0.68),
**C → gpt-5.4-mini** (≈$1.65) → **итого ≈$2.9/история**; эксперимент для C — gpt-5.4-nano
($0.2/$1.25: ≈$0.46, итого ≈$1.7) с обязательной проверкой русской прозы (в русском топ-15 LMArena
у OpenAI только старшие модели: gpt-5.4-high #12). Реализация: `resolveModel(stage)` c env
`TEXTGEN_MODEL_<STAGE>` / `TEXTGEN_MODEL_TIER_<A|B|C>`, дефолт — текущее поведение; архитектурно
провайдер-агностично (Vercel AI SDK), но другие провайдеры — вне скоупа этой работы.

## Фазы (каждая — рабочее приложение, conventional commits)

1. **feat(narrative): calendar data model, spine-v1, montage slots** — calendarTypes, events.ts+slot,
   briefStore v2, narrativeStore v9, стадии worldCalendar+spine (пока без развилок), validateSpine/
   validateCalendar, useBulkCalendarGeneration (cast — детерминированный стаб), мультилокационная
   монтажка. **Адаптер `deriveLegacyOutline(spine,calendar,schedule)`** держит старый компилятор,
   экспорт и «Граф якорей» рабочими.
2. **feat(game): calendar compiler** — compileCalendarGame, slot-переменная читаемая условиями,
   «Подождать», settings.calendar, calendarState+HUD; регресс: старые истории экспортируются по-старому.
3. **feat(narrative): диалог как сущность** — DialogueUnit (typed choices, closing-контракт),
   validateDialogueUnit, обновлённый промпт dialogueVariant → dialogueUnit (обязательный kind и farewell),
   encounter-обёртка: movement-эффекты переезжают на closing-переход (wireEncounter в компиляторе),
   dialogueQA-критик (D1), адаптер/миграция dialogueVariants в сторе. Работает и со старым
   компилятором (фаза применима до/независимо от агенд).
4. **feat(narrative): агенды, пул событий, pruning** — castPlan+eventPool в text_gen, buildSchedule-солвер,
   EventUnit-стор, reachability.ts, проза по юнитам.
5. **feat(narrative): истинные ветки** — branchPoint+outcomes+спайн-флаги в промпте/парсере/валидаторе,
   guarded-концовки, селектор веток в монтажке, дорожки в графе битов, branchPointBudget в BriefEditor.
6. **feat(narrative): story QA** — структурный отчёт (D2), симуляция политик по evaluateSlice (D3),
   LLM-критик листьев веток (D4), QA-панель в playground: список issues со scope (бит/слот/юнит/лист)
   и кнопкой «регенерировать с фидбеком» (issues → previousIssues соответствующей стадии).
   Экспорт блокируется при error-severity issues (обходимо явным флагом).
7. **feat(text_gen): tiering моделей через env (OpenAI-only)** — resolveModel + 12 call-site-ов +
   .env.example.
8. **refactor(narrative): снос легаси** — OutlinePlan/segments/narrationWebs/legacy-конвертеры,
   store v10, чистка openapi/server.

## Верификация

- Каждая фаза: `pnpm test` в client (events.test.ts обязан оставаться зелёным), typecheck, lint.
- Новые vitest-сьюты: validateSpine, validateCalendar, buildSchedule (пины участников битов, инвариант
  «≥2 локации на слот»), reachability (сконструированный недостижимый юнит исключён), migrate-тесты
  стора (fixture v8 JSON → кэши выживают), **validateDialogueUnit** (вопрос без ответа → error; путь,
  не достигающий closing → error; движенческий эффект внутри юнита → error), **симуляция политик**
  (fixture-история: каждая политика доигрывает до концовки).
- Диалоговый регресс: собрать мини-игру и убедиться, что из любого вопроса нельзя попасть на экран
  перехода — выход только через прощальную сцену (проверяется и структурным тестом на скомпилированном
  графе: ни одно ребро из dialogue-узла с ask-выбором не ведёт в hub_*).
- Ручной сквозной прогон в playground: бриф → генерация → монтажка (N слотов × ≥2 бокса) → экспорт →
  `pnpm build:game` → пройти игру: перемещение бесплатно, контент двигает слот, биты вне окна не
  стреляют, обе ветки развилки ведут к разным битам акта 3 и разным концовкам; `?gudebug` показывает
  slot-условия. Тест игры — в обычной вкладке браузера пользователя (медиа глохнет в автоматизации).
- Ассерты линейного роста контента в WorldCompileStats при добавлении развилки.

## Риски

- Слишком строгий validateSpine заморит retry-цикл → в фазе 1 принимаем только структурные проверки,
  feasibility ужесточаем в фазе 4 с адресными previousIssues (по имени бита/слота).
- Потеря данных при миграции стора → migrate-тест на fixture каждой версии.
- ROUTER_DEAD_END в новом компиляторе → безусловный fallback-выход у каждого роутера (паттерн
  compileWorldGame:422-428) + компил-линт.
- Регенерация generated_client — тем же коммитом, что и openapi.yaml.
