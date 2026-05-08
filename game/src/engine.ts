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
    if (!edge) return;

    this.goTo(edge.target);
  }

  advance(): void {
    if (!this.currentNode) return;
    const edges = this.getActiveEdges(this.currentNode.id);
    if (edges.length > 0) {
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
    if (!node) return;

    const sceneType = node.data.sceneType ?? "dialogue";

    if (sceneType === "router") {
      const edges = this.getActiveEdges(node.id);
      if (edges.length > 0) {
        this.goTo(edges[0].target);
      }
      return;
    }

    this.currentNode = node;
    const activeEdges = this.getActiveEdges(node.id);
    this.onSceneChange(node, activeEdges.length === 0);
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
