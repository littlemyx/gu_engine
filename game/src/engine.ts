import {
  SceneGraph,
  SceneNode,
  SceneEdge,
  SceneType,
  StateCondition,
  OutputEffects,
  ProjectSettings,
  StateSchema,
} from "./types";

// Подробная трассировка каждого рендера включается query-флагом ?gudebug;
// дампы реальных ошибок графа (NODE_NOT_FOUND, ROUTER_DEAD_END) пишутся всегда.
const DEBUG_TRACE =
  typeof location !== "undefined" &&
  new URLSearchParams(location.search).has("gudebug");

export class GameEngine {
  private graph: SceneGraph;
  private settings: ProjectSettings;
  private nodeMap: Map<string, SceneNode>;
  private edgesBySource: Map<string, SceneEdge[]>;
  private incomingCount: Map<string, number>;
  private currentNode: SceneNode | null = null;
  private onSceneChange: (node: SceneNode, isEnd: boolean) => void;

  private state: Record<string, number> = {};
  private flags: Set<string> = new Set();
  private history: Array<{ id: string; sceneType: string; label: string }> = [];

  private projectTitle = '';
  private projectFile = '';
  private scenesFile = '';

  setProjectMeta(title: string, projectFile?: string, scenesFile?: string): void {
    this.projectTitle = title;
    this.projectFile = projectFile ?? '';
    this.scenesFile = scenesFile ?? '';
  }

  constructor(
    graph: SceneGraph,
    settings: ProjectSettings,
    onSceneChange: (node: SceneNode, isEnd: boolean) => void,
  ) {
    this.graph = graph;
    this.settings = settings;
    this.onSceneChange = onSceneChange;

    this.nodeMap = new Map();
    for (const node of graph.nodes) {
      this.nodeMap.set(node.id, node);
    }

    this.edgesBySource = new Map();
    this.incomingCount = new Map();

    for (const node of graph.nodes) {
      this.incomingCount.set(node.id, 0);
    }

    for (const edge of graph.edges) {
      const list = this.edgesBySource.get(edge.source) ?? [];
      list.push(edge);
      this.edgesBySource.set(edge.source, list);

      this.incomingCount.set(
        edge.target,
        (this.incomingCount.get(edge.target) ?? 0) + 1,
      );
    }

    this.initState(settings.stateSchema);
  }

  private initState(schema?: StateSchema): void {
    this.state = {};
    this.flags = new Set();
    if (!schema) return;
    for (const [key, def] of Object.entries(schema.vars)) {
      this.state[key] = def.default;
    }
  }

  getSettings(): ProjectSettings {
    return this.settings;
  }

  getState(): Readonly<Record<string, number>> {
    return this.state;
  }

  getFlags(): ReadonlySet<string> {
    return this.flags;
  }

  start(): void {
    this.initState(this.settings.stateSchema);
    const startNode = this.findStartNode();
    if (!startNode) {
      throw new Error("Не найдена стартовая сцена");
    }
    this.goTo(startNode.id);
  }

  choose(outputId: string): void {
    if (!this.currentNode) return;

    const output = this.currentNode.data.outputs.find(
      (o) => o.id === outputId,
    );
    if (output?.effects) {
      this.applyEffects(output.effects);
    }

    const edges = this.getActiveEdges(this.currentNode.id);
    const edge = edges.find((e) => e.sourceHandle === outputId);
    if (!edge) {
      console.warn('[engine] choose: no edge found', {
        outputId,
        currentNode: this.currentNode.id,
        allOutputs: this.currentNode.data.outputs.map(o => o.id),
        allEdges: edges.map(e => ({ handle: e.sourceHandle, target: e.target })),
      });
      return;
    }

    this.goTo(edge.target);
  }

  advance(): void {
    if (!this.currentNode) return;
    const edges = this.getActiveEdges(this.currentNode.id);
    if (edges.length > 0) {
      // Авто-выход тоже может нести эффекты (например, met-переменные
      // «встреча состоялась» на терминальной narration-сцене диалога).
      const output = this.currentNode.data.outputs.find(
        (o) => o.id === edges[0].sourceHandle,
      );
      if (output?.effects) {
        this.applyEffects(output.effects);
      }
      this.goTo(edges[0].target);
    }
  }

  getCurrentNode(): SceneNode | null {
    return this.currentNode;
  }

  getSceneType(): SceneType {
    return this.currentNode?.data.sceneType ?? "dialogue";
  }

  getConnectedOutputIds(): Set<string> {
    if (!this.currentNode) return new Set();
    const edges = this.getActiveEdges(this.currentNode.id);
    return new Set(edges.map((e) => e.sourceHandle));
  }

  private applyEffects(effects: OutputEffects): void {
    if (effects.stateDeltas) {
      for (const [key, delta] of Object.entries(effects.stateDeltas)) {
        this.state[key] = (this.state[key] ?? 0) + delta;
      }
    }
    if (effects.flagSet) {
      for (const f of effects.flagSet) this.flags.add(f);
    }
    if (effects.flagClear) {
      for (const f of effects.flagClear) this.flags.delete(f);
    }
  }

  private evaluateConditions(conditions: StateCondition[]): boolean {
    for (const c of conditions) {
      const val = this.state[c.path] ?? 0;
      if (c.gte !== undefined && val < c.gte) return false;
      if (c.lte !== undefined && val > c.lte) return false;
    }
    return true;
  }

  private getActiveEdges(nodeId: string): SceneEdge[] {
    const edges = this.edgesBySource.get(nodeId) ?? [];
    return edges.filter(
      (e) => !e.condition || this.evaluateConditions(e.condition),
    );
  }

  private goTo(nodeId: string): void {
    const node = this.nodeMap.get(nodeId);
    if (!node) {
      console.warn('[engine] node not found', nodeId);
      this.dumpTrace('NODE_NOT_FOUND: ' + nodeId);
      return;
    }

    const sceneType = node.data.sceneType ?? "dialogue";
    this.history.push({
      id: node.id,
      sceneType,
      label: node.data.label.slice(0, 60),
    });

    if (sceneType === "router") {
      const edges = this.getActiveEdges(node.id);
      if (edges.length > 0) {
        this.goTo(edges[0].target);
        return;
      }
      this.dumpTrace('ROUTER_DEAD_END');
      this.currentNode = node;
      this.onSceneChange(node, true);
      return;
    }

    this.currentNode = node;
    const activeEdges = this.getActiveEdges(node.id);
    if (DEBUG_TRACE) {
      this.dumpTrace(activeEdges.length === 0 ? 'END' : 'RENDER');
    } else {
      this.history = [];
    }
    this.onSceneChange(node, activeEdges.length === 0);
  }

  private dumpTrace(event: string): void {
    const current = this.currentNode;
    const typeCounts: Record<string, number> = {};
    for (const n of this.graph.nodes) {
      const t = n.data.sceneType ?? 'NO_TYPE';
      typeCounts[t] = (typeCounts[t] ?? 0) + 1;
    }
    console.log(`%c[engine] ${event}`, 'color: #f90; font-weight: bold', {
      project: this.projectTitle,
      projectFile: this.projectFile,
      scenesFile: this.scenesFile,
      graph: {
        totalNodes: this.graph.nodes.length,
        totalEdges: this.graph.edges.length,
        bySceneType: typeCounts,
      },
      path: this.history.map(h => `${h.id} (${h.sceneType})`),
      stoppedAt: current ? {
        id: current.id,
        sceneType: current.data.sceneType ?? 'dialogue',
        label: current.data.label.slice(0, 80),
        outputs: current.data.outputs.map(o => o.id),
        edges: (this.edgesBySource.get(current.id) ?? []).map(e => ({
          handle: e.sourceHandle,
          target: e.target,
          condition: e.condition,
        })),
      } : null,
    });
    this.history = [];
  }

  private findStartNode(): SceneNode | null {
    for (const node of this.graph.nodes) {
      if ((this.incomingCount.get(node.id) ?? 0) === 0) {
        return node;
      }
    }
    return this.graph.nodes[0] ?? null;
  }
}
