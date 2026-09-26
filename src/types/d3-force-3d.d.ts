declare module "d3-force-3d" {
  export interface SimulationNodeDatum {
    index?: number;
    x?: number;
    y?: number;
    z?: number;
    vx?: number;
    vy?: number;
    vz?: number;
    fx?: number | null;
    fy?: number | null;
    fz?: number | null;
  }

  export interface SimulationLinkDatum<Node extends SimulationNodeDatum> {
    source: string | Node;
    target: string | Node;
    index?: number;
  }

  export interface Force<Node extends SimulationNodeDatum> {
    (alpha: number): void;
  }

  export interface Simulation<Node extends SimulationNodeDatum> {
    force(name: string, force: Force<Node> | null): this;
    alpha(value: number): this;
    alphaDecay(value: number): this;
    alphaMin(value: number): this;
    velocityDecay(value: number): this;
    restart(): this;
    stop(): this;
    on(event: "tick" | "end", listener: (() => void) | null): this;
  }

  export interface LinkForce<Node extends SimulationNodeDatum, Link extends SimulationLinkDatum<Node>> extends Force<Node> {
    id(accessor: (node: Node) => string): this;
    distance(value: number | ((link: Link) => number)): this;
    strength(value: number | ((link: Link) => number)): this;
    iterations(value: number): this;
  }

  export interface ManyBodyForce<Node extends SimulationNodeDatum> extends Force<Node> {
    strength(value: number | ((node: Node) => number)): this;
    distanceMin(value: number): this;
    distanceMax(value: number): this;
  }

  export interface CollideForce<Node extends SimulationNodeDatum> extends Force<Node> {
    radius(value: number | ((node: Node) => number)): this;
    strength(value: number): this;
    iterations(value: number): this;
  }

  export interface CenterForce<Node extends SimulationNodeDatum> extends Force<Node> {
    strength(value: number): this;
  }

  export interface AxisForce<Node extends SimulationNodeDatum> extends Force<Node> {
    strength(value: number | ((node: Node) => number)): this;
  }

  export function forceSimulation<Node extends SimulationNodeDatum>(nodes: Node[], numDimensions?: 1 | 2 | 3): Simulation<Node>;
  export function forceLink<Node extends SimulationNodeDatum, Link extends SimulationLinkDatum<Node>>(links: Link[]): LinkForce<Node, Link>;
  export function forceManyBody<Node extends SimulationNodeDatum>(): ManyBodyForce<Node>;
  export function forceCollide<Node extends SimulationNodeDatum>(): CollideForce<Node>;
  export function forceCenter<Node extends SimulationNodeDatum>(x?: number, y?: number, z?: number): CenterForce<Node>;
  export function forceX<Node extends SimulationNodeDatum>(x?: number | ((node: Node) => number)): AxisForce<Node>;
  export function forceY<Node extends SimulationNodeDatum>(y?: number | ((node: Node) => number)): AxisForce<Node>;
  export function forceZ<Node extends SimulationNodeDatum>(z?: number | ((node: Node) => number)): AxisForce<Node>;
}
