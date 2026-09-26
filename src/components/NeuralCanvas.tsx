import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from "d3-force";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import type { Neuron, NeuronConnection, Position3D } from "../types";

type NeuralCanvasProps = {
  neurons: Neuron[];
  connections: NeuronConnection[];
  selectedNeuronId: string | null;
  selectedConnectionId: string | null;
  focusNeuronId: string | null;
  resetSignal: number;
  onSelectNeuron: (neuronId: string) => void;
  onSelectConnection: (connectionId: string) => void;
  onLayoutSettled: (positions: Record<string, Position3D>) => void;
  neuronSpacing: number;
};

type GraphNode = SimulationNodeDatum & {
  id: string;
  name: string;
  radius: number;
};

type GraphLink = SimulationLinkDatum<GraphNode> & {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
};

type GraphTransform = { x: number; y: number; k: number };

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function nodeRadius(connectionCount: number) {
  return Math.min(8, 4.5 + Math.log2(connectionCount + 1) * 1.1);
}

function initialCoordinate(neuron: Neuron, index: number) {
  const hasUsefulPosition = Math.abs(neuron.position.x) > 10 || Math.abs(neuron.position.y) > 10;
  if (hasUsefulPosition) return { x: neuron.position.x, y: neuron.position.y };
  const distance = 36 + Math.sqrt(index + 1) * 22;
  const angle = index * GOLDEN_ANGLE;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

export function NeuralCanvas({
  neurons,
  connections,
  selectedNeuronId,
  selectedConnectionId,
  focusNeuronId,
  resetSignal,
  onSelectNeuron,
  onSelectConnection,
  onLayoutSettled,
  neuronSpacing,
}: NeuralCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const positionsRef = useRef<Record<string, { x: number; y: number }>>({});
  const sizeRef = useRef({ width: 1, height: 1 });
  const onLayoutSettledRef = useRef(onLayoutSettled);
  const animationFrameRef = useRef<number | null>(null);
  const lastFocusRef = useRef<string | null>(null);
  const lastResetRef = useRef(resetSignal);
  const initialFitRef = useRef(false);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [transform, setTransform] = useState<GraphTransform>({ x: 0, y: 0, k: 1 });

  onLayoutSettledRef.current = onLayoutSettled;
  positionsRef.current = positions;
  sizeRef.current = size;
  const neuronTopology = useMemo(() => neurons.map((neuron) => neuron.id).join("|"), [neurons]);
  const connectionTopology = useMemo(
    () => connections.map((connection) => `${connection.id}:${connection.sourceNeuronId}:${connection.targetNeuronId}`).join("|"),
    [connections],
  );

  const connectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    connections.forEach((connection) => {
      counts.set(connection.sourceNeuronId, (counts.get(connection.sourceNeuronId) ?? 0) + 1);
      counts.set(connection.targetNeuronId, (counts.get(connection.targetNeuronId) ?? 0) + 1);
    });
    return counts;
  }, [connections]);

  const adjacencyMap = useMemo(() => {
    const adjacency = new Map<string, Set<string>>();
    neurons.forEach((neuron) => adjacency.set(neuron.id, new Set()));
    connections.forEach((connection) => {
      adjacency.get(connection.sourceNeuronId)?.add(connection.targetNeuronId);
      adjacency.get(connection.targetNeuronId)?.add(connection.sourceNeuronId);
    });
    return adjacency;
  }, [connections, neurons]);

  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return new Set<string>();
    const ids = new Set([hoveredNodeId]);
    adjacencyMap.get(hoveredNodeId)?.forEach((neighborId) => ids.add(neighborId));
    return ids;
  }, [adjacencyMap, hoveredNodeId]);

  const fitGraph = (graphNodes = nodesRef.current) => {
    const viewport = sizeRef.current;
    if (!graphNodes.length || viewport.width <= 1 || viewport.height <= 1) {
      setTransform({ x: 0, y: 0, k: 1 });
      return;
    }
    const xs = graphNodes.map((node) => node.x ?? 0);
    const ys = graphNodes.map((node) => node.y ?? 0);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const graphWidth = Math.max(160, maxX - minX + 140);
    const graphHeight = Math.max(120, maxY - minY + 100);
    const k = Math.min(1.35, Math.max(0.35, Math.min(viewport.width / graphWidth, viewport.height / graphHeight) * 0.9));
    setTransform({ x: -((minX + maxX) / 2) * k, y: -((minY + maxY) / 2) * k, k });
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const activeIds = new Set(neurons.map((neuron) => neuron.id));
    const graphNodes: GraphNode[] = neurons.map((neuron, index) => {
      const initial = initialCoordinate(neuron, index);
      const current = positionsRef.current[neuron.id];
      return {
        id: neuron.id,
        name: neuron.name,
        radius: nodeRadius(connectionCounts.get(neuron.id) ?? 0),
        x: current?.x ?? initial.x,
        y: current?.y ?? initial.y,
        vx: 0,
        vy: 0,
      };
    });
    const graphLinks: GraphLink[] = connections
      .filter((connection) => activeIds.has(connection.sourceNeuronId) && activeIds.has(connection.targetNeuronId))
      .map((connection) => ({ id: connection.id, source: connection.sourceNeuronId, target: connection.targetNeuronId }));
    nodesRef.current = graphNodes;

    const publishPositions = () => {
      setPositions(Object.fromEntries(graphNodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0 }])));
    };

    let layoutCommitted = false;
    let lastPublishedAt = 0;
    const commitSettledLayout = () => {
      if (layoutCommitted) return;
      layoutCommitted = true;
      publishPositions();
      onLayoutSettledRef.current(
        Object.fromEntries(graphNodes.map((node) => [node.id, { x: node.x ?? 0, y: node.y ?? 0, z: 0 }])),
      );
      if (!initialFitRef.current) {
        initialFitRef.current = true;
        window.requestAnimationFrame(() => fitGraph(graphNodes));
      }
    };

    const simulation = forceSimulation<GraphNode>(graphNodes)
      .force(
        "link",
        forceLink<GraphNode, GraphLink>(graphLinks)
          .id((node) => node.id)
          .distance(90 * (neuronSpacing / 2.4))
          .strength(0.25),
      )
      .force("charge", forceManyBody<GraphNode>().strength(-140).distanceMax(neuronSpacing * 180))
      .force(
        "collision",
        forceCollide<GraphNode>()
          .radius((node) => node.radius + Math.min(42, 18 + node.name.length * 2.2))
          .strength(0.8)
          .iterations(2),
      )
      .force("center", forceCenter<GraphNode>(0, 0).strength(0.025))
      .alpha(0.9)
      .alphaDecay(0.045)
      .alphaTarget(0.01)
      .velocityDecay(0.4)
      .on("tick", () => {
        if (!layoutCommitted && simulation.alpha() < 0.025) commitSettledLayout();
        const now = performance.now();
        if (now - lastPublishedAt < 32) return;
        lastPublishedAt = now;
        if (animationFrameRef.current !== null) return;
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = null;
          publishPositions();
        });
      });

    return () => {
      simulation.stop();
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    };
    // Simulation restarts only when graph topology or spacing changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionTopology, neuronSpacing, neuronTopology]);

  useEffect(() => {
    if (lastResetRef.current === resetSignal) return;
    lastResetRef.current = resetSignal;
    fitGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal, size]);

  useEffect(() => {
    if (!focusNeuronId || lastFocusRef.current === focusNeuronId) return;
    const position = positions[focusNeuronId];
    if (!position) return;
    lastFocusRef.current = focusNeuronId;
    setTransform((current) => {
      const k = Math.max(1.15, current.k);
      return { x: -position.x * k, y: -position.y * k, k };
    });
  }, [focusNeuronId, positions]);

  const beginPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
    };
  };

  const movePan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    setTransform((current) => ({
      ...current,
      x: pan.originX + event.clientX - pan.startX,
      y: pan.originY + event.clientY - pan.startY,
    }));
  };

  const endPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (panRef.current?.pointerId === event.pointerId) panRef.current = null;
  };

  const zoomGraph = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left - size.width / 2;
    const pointerY = event.clientY - rect.top - size.height / 2;
    setTransform((current) => {
      const nextK = Math.min(3, Math.max(0.25, current.k * Math.exp(-event.deltaY * 0.0012)));
      const ratio = nextK / current.k;
      return {
        k: nextK,
        x: pointerX - (pointerX - current.x) * ratio,
        y: pointerY - (pointerY - current.y) * ratio,
      };
    });
  };

  return (
    <div ref={containerRef} className="h-full min-h-[420px] w-full overflow-hidden rounded-lg border border-slate-200 bg-[#f8fafc]">
      <svg
        width="100%"
        height="100%"
        className="block cursor-grab touch-none select-none active:cursor-grabbing"
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={zoomGraph}
        onClick={() => {
          onSelectNeuron("");
          onSelectConnection("");
        }}
      >
        <g transform={`translate(${size.width / 2 + transform.x} ${size.height / 2 + transform.y}) scale(${transform.k})`}>
          {connections.map((connection) => {
            const source = positions[connection.sourceNeuronId];
            const target = positions[connection.targetNeuronId];
            if (!source || !target) return null;
            const related = hoveredNodeId === connection.sourceNeuronId || hoveredNodeId === connection.targetNeuronId;
            const dimmed = Boolean(hoveredNodeId) && !related;
            const selected = selectedConnectionId === connection.id;
            return (
              <g key={connection.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={selected || related ? "#8b5cf6" : "#94a3b8"}
                  strokeWidth={selected ? 2.2 : related ? 1.8 : 1}
                  opacity={dimmed ? 0.07 : selected || related ? 0.92 : 0.28}
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none transition-opacity duration-150"
                />
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="transparent"
                  strokeWidth={12 / transform.k}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectConnection(connection.id);
                  }}
                  className="cursor-pointer"
                />
              </g>
            );
          })}

          {neurons.map((neuron) => {
            const position = positions[neuron.id];
            if (!position) return null;
            const radius = nodeRadius(connectionCounts.get(neuron.id) ?? 0);
            const hovered = hoveredNodeId === neuron.id;
            const related = connectedNodeIds.has(neuron.id);
            const dimmed = Boolean(hoveredNodeId) && !related;
            const selected = selectedNeuronId === neuron.id;
            return (
              <g
                key={neuron.id}
                transform={`translate(${position.x} ${position.y})`}
                opacity={dimmed ? 0.14 : 1}
                className="cursor-pointer transition-opacity duration-150"
                onPointerEnter={() => setHoveredNodeId(neuron.id)}
                onPointerLeave={() => setHoveredNodeId(null)}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectNeuron(neuron.id);
                }}
              >
                <circle
                  r={hovered || selected ? radius * 1.35 : related ? radius * 1.12 : radius}
                  fill={hovered || selected ? "#7c3aed" : related ? "#64748b" : "#475569"}
                  stroke={selected ? "#4c1d95" : hovered ? "#a78bfa" : "#ffffff"}
                  strokeWidth={selected ? 2 : 1}
                  vectorEffect="non-scaling-stroke"
                  className="transition-all duration-150"
                />
                <text
                  x={radius + 6}
                  y={4}
                  fill={hovered || related || selected ? "#1e1b4b" : "#334155"}
                  fontSize={12}
                  fontWeight={hovered || selected ? 700 : 500}
                  stroke="#f8fafc"
                  strokeWidth={3}
                  paintOrder="stroke"
                  strokeLinejoin="round"
                  className="pointer-events-none"
                >
                  {neuron.name}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
