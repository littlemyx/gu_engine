/**
 * Компиляция игры из дампа narrative-стора (localStorage `gu-narrative-state`)
 * без браузера + статические проверки графа + симуляция прохождения.
 *
 * Запуск (tsx лежит в text_gen):
 *   ../text_gen/node_modules/.bin/tsx scripts/compile-world-game.ts <dump.json> <outDir>
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { compileWorldGameProject } from '../src/narrative/compileWorldGame';
import { SAMPLE_BRIEF } from '../src/narrative/sampleBrief';
import type { GameSceneEdge, GameSceneGraph, GameSceneNode } from '../src/narrative/convertToGameProject';

const [dumpPath, outDir] = process.argv.slice(2);
if (!dumpPath || !outDir) {
  console.error('usage: tsx scripts/compile-world-game.ts <dump.json> <outDir>');
  process.exit(1);
}

const dump = JSON.parse(fs.readFileSync(dumpPath, 'utf8'));
const state = dump.state ?? dump;
const brief = state.brief ?? readBriefStore();
const { storyOutline, worldModel, dialogueVariants, anchorBeats, endings, images, characters } = state;

function readBriefStore(): unknown {
  // Бриф живёт в отдельном сторе (gu-narrative-brief); если рядом с дампом
  // есть brief-dump.json — берём его, иначе деградируем к SAMPLE_BRIEF.
  const briefPath = path.join(path.dirname(dumpPath), 'brief-dump.json');
  if (fs.existsSync(briefPath)) {
    const parsed = JSON.parse(fs.readFileSync(briefPath, 'utf8'));
    return parsed.state?.brief ?? parsed.brief ?? parsed;
  }
  console.warn('[compile] в дампе нет brief — использую SAMPLE_BRIEF');
  return SAMPLE_BRIEF;
}

if (!storyOutline || !worldModel) {
  console.error('в дампе нет storyOutline или worldModel');
  process.exit(1);
}

const result = compileWorldGameProject(
  brief,
  storyOutline,
  worldModel,
  dialogueVariants ?? {},
  anchorBeats ?? {},
  endings ?? {},
  images ?? {},
  characters ?? {},
);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'project.gu.json'), JSON.stringify(result.project, null, 2));
fs.writeFileSync(path.join(outDir, 'scenes.json'), JSON.stringify(result.scenes, null, 2));
console.log('[compile] stats:', result.stats);

// ── Статические проверки графа ──────────────────────────────────────────────
const { nodes, edges } = result.scenes;
const nodeById = new Map(nodes.map(n => [n.id, n]));
const problems: string[] = [];

for (const e of edges) {
  if (!nodeById.has(e.source)) problems.push(`edge ${e.id}: source "${e.source}" не существует`);
  if (!nodeById.has(e.target)) problems.push(`edge ${e.id}: target "${e.target}" не существует`);
  const src = nodeById.get(e.source);
  if (src && !src.data.outputs.some(o => o.id === e.sourceHandle)) {
    problems.push(`edge ${e.id}: sourceHandle "${e.sourceHandle}" не найден в outputs узла ${e.source}`);
  }
}
const edgesBySource = new Map<string, GameSceneEdge[]>();
for (const e of edges) {
  if (!edgesBySource.has(e.source)) edgesBySource.set(e.source, []);
  edgesBySource.get(e.source)!.push(e);
}
for (const n of nodes) {
  for (const o of n.data.outputs) {
    if (!(edgesBySource.get(n.id) ?? []).some(e => e.sourceHandle === o.id)) {
      problems.push(`node ${n.id}: output "${o.id}" без ребра`);
    }
  }
}
const incoming = new Map<string, number>(nodes.map(n => [n.id, 0]));
for (const e of edges) incoming.set(e.target, (incoming.get(e.target) ?? 0) + 1);
const startNodes = nodes.filter(n => (incoming.get(n.id) ?? 0) === 0);
if (startNodes.length !== 1) {
  problems.push(`старт-узлов ${startNodes.length} (${startNodes.map(n => n.id).join(', ')}), ожидался ровно 1`);
}

if (problems.length > 0) {
  console.error('[static] FAIL:');
  for (const p of problems) console.error('  -', p);
  process.exit(1);
}
console.log('[static] OK: все рёбра/выходы/старт консистентны');

// ── Мини-движок (семантика game/src/engine.ts) ──────────────────────────────
class Sim {
  state: Record<string, number> = {};
  current: GameSceneNode | null = null;
  trace: string[] = [];

  constructor(private graph: GameSceneGraph) {
    const schema = result.project.settings.stateSchema;
    if (schema) for (const [k, d] of Object.entries(schema.vars)) this.state[k] = d.default;
  }

  private activeEdges(nodeId: string): GameSceneEdge[] {
    return (edgesBySource.get(nodeId) ?? []).filter(
      e =>
        !e.condition ||
        e.condition.every(c => {
          const val = this.state[c.path] ?? 0;
          if (c.gte !== undefined && val < c.gte) return false;
          if (c.lte !== undefined && val > c.lte) return false;
          return true;
        }),
    );
  }

  private applyEffects(effects?: { stateDeltas?: Record<string, number> }): void {
    if (effects?.stateDeltas) {
      for (const [k, d] of Object.entries(effects.stateDeltas)) this.state[k] = (this.state[k] ?? 0) + d;
    }
  }

  goTo(nodeId: string): void {
    const node = nodeById.get(nodeId);
    if (!node) throw new Error(`NODE_NOT_FOUND: ${nodeId}`);
    this.trace.push(nodeId);
    if (node.data.sceneType === 'router') {
      const e = this.activeEdges(nodeId)[0];
      if (!e) throw new Error(`ROUTER_DEAD_END: ${nodeId}`);
      this.goTo(e.target);
      return;
    }
    this.current = node;
  }

  start(): void {
    this.goTo(startNodes[0].id);
  }

  /** Выборы, которые реально видит игрок (output + активное ребро). */
  visibleChoices(): { id: string; text: string }[] {
    if (!this.current) return [];
    const active = new Set(this.activeEdges(this.current.id).map(e => e.sourceHandle));
    return this.current.data.outputs.filter(o => active.has(o.id)).map(o => ({ id: o.id, text: o.text }));
  }

  choose(outputId: string): void {
    if (!this.current) throw new Error('no current node');
    const output = this.current.data.outputs.find(o => o.id === outputId);
    this.applyEffects(output?.effects);
    const edge = this.activeEdges(this.current.id).find(e => e.sourceHandle === outputId);
    if (!edge) throw new Error(`no active edge for output ${outputId} at ${this.current.id}`);
    this.goTo(edge.target);
  }

  advance(): void {
    if (!this.current) throw new Error('no current node');
    const e = this.activeEdges(this.current.id)[0];
    if (!e) throw new Error(`END at ${this.current.id}`);
    const output = this.current.data.outputs.find(o => o.id === e.sourceHandle);
    this.applyEffects(output?.effects);
    this.goTo(e.target);
  }

  /** Пока на narration-сцене — жмём «дальше». */
  skipNarration(): void {
    let guard = 0;
    while (
      this.current &&
      this.current.data.sceneType === 'narration' &&
      this.activeEdges(this.current.id).length > 0
    ) {
      this.advance();
      if (++guard > 100) throw new Error('narration loop');
    }
  }

  chooseByText(prefix: string): void {
    const c = this.visibleChoices().find(ch => ch.text.startsWith(prefix));
    if (!c) {
      throw new Error(
        `нет выбора "${prefix}" в ${this.current?.id}; есть: ${this.visibleChoices()
          .map(ch => ch.text)
          .join(' | ')}`,
      );
    }
    this.choose(c.id);
  }

  isAt(nodeId: string): boolean {
    return this.current?.id === nodeId;
  }
}

const assert = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error('[sim] FAIL:', msg);
    process.exit(1);
  }
  console.log('[sim] OK:', msg);
};

const sim = new Sim(result.scenes);
sim.start();

// 1. Старт: событие setup играется сразу.
assert(sim.isAt('setup_university_arrival'), 'старт = событие setup_university_arrival');
sim.advance(); // событие → hub локации
assert(sim.isAt('hub_university_entrance'), 'после setup игрок в hub входа в университет');

// 2. Идём в библиотеку через аллею — событие библиотеки срабатывает на входе.
sim.chooseByText('Пойти: аллея кампуса');
assert(sim.isAt('hub_campus_alley'), 'на аллее событий нет — обычный hub');
sim.chooseByText('Пойти: университетская библиотека');
assert(sim.isAt('library_first_encounter'), 'вход в библиотеку триггерит событие library_first_encounter');
sim.advance();
assert(sim.isAt('hub_library'), 'после события — hub библиотеки');

// 3. Встреча с Кирой доступна, одноразова, двигает время.
const timeBefore = sim.state['time'];
assert(
  sim.visibleChoices().some(c => c.text.startsWith('Подойти:')),
  'в hub библиотеки есть encounter-кнопки',
);
sim.chooseByText('Подойти: Кира');
sim.skipNarration();
let guard = 0;
while (!sim.isAt('hub_library')) {
  // Идём по диалогу, всегда выбирая первый видимый вариант.
  const choices = sim.visibleChoices();
  if (choices.length === 0) break;
  sim.choose(choices[0].id);
  sim.skipNarration();
  if (++guard > 50) throw new Error('диалог не завершился за 50 шагов');
}
assert(sim.isAt('hub_library'), 'после диалога с Кирой игрок вернулся в hub библиотеки');
assert((sim.state['met[kira].library_first_encounter'] ?? 0) >= 1, 'met[kira] выставлен');
assert((sim.state['time'] ?? 0) > timeBefore, 'диалог сдвинул стрелу времени');
assert(!sim.visibleChoices().some(c => c.text === 'Подойти: Кира'), 'повторная встреча с Кирой скрыта');

// 4. БАГ-СЦЕНАРИЙ: выход из библиотеки в кофейню приводит В КОФЕЙНЮ.
sim.chooseByText('Пойти: аллея кампуса');
sim.chooseByText('Пойти: кофейня у университета');
assert(sim.isAt('coffee_shop_evening'), 'вход в кофейню триггерит событие coffee_shop_evening (а не библиотеку!)');
sim.advance();
assert(sim.isAt('hub_coffee_shop'), 'после события — hub кофейни');

// 5. Дорога до финала: события «созревают» на входе в свои локации по мере
// прохождения предков (по пути события могут играться и на промежуточных
// локациях — walk доигрывает их narration-сцены).
const walk = (target: string) => {
  sim.chooseByText(`Пойти: ${target}`);
  sim.skipNarration();
};
walk('аллея кампуса');
walk('столовая университета');
assert((sim.state['evt[cafeteria_rainy_afternoon]'] ?? 0) >= 1, 'событие столовой сыграло');
walk('коридор к аудиториям');
walk('аудитория для семинаров');
assert((sim.state['evt[seminar_room_discussion]'] ?? 0) >= 1, 'событие семинара сыграло');
walk('коридор к аудиториям');
walk('пустой класс');
assert((sim.state['evt[empty_classroom_conflict]'] ?? 0) >= 1, 'событие пустого класса сыграло');
walk('коридор к аудиториям');
walk('крыша университета');
assert((sim.state['evt[climax_rainy_rooftop]'] ?? 0) >= 1, 'кульминация на крыше сыграла');
walk('пустой кампус ночью');
walk('аллея кампуса');
walk('кампус университета');
assert((sim.state['evt[resolution_campus_sunrise]'] ?? 0) >= 1, 'резолюция на рассвете сыграла');
assert(sim.visibleChoices().length === 0, 'эпилог дочитан до конца («Конец»)');

console.log('\n[sim] Все проверки прошли. time =', sim.state['time']);
