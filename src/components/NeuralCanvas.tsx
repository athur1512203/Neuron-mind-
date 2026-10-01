import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from "d3-force";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
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
  onCreateConnection?: (sourceId: string, targetId: string) => void;
  connectionMode?: boolean;
  neuronSpacing: number;
};

type GraphNode = SimulationNodeDatum & {
  id: string;
  name: string;
  radius: number;
  color: string;
};

type GraphLink = SimulationLinkDatum<GraphNode> & {
  id: string;
  source: string | GraphNode;
  target: string | GraphNode;
};

type GraphTransform = { x: number; y: number; k: number };

const LINK_STROKE = "#CBD0D6";
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

function endpointNode(endpoint: string | GraphNode, nodesById: Map<string, GraphNode>) {
  return typeof endpoint === "string" ? nodesById.get(endpoint) : endpoint;
}

export type NeuralCanvasHandle = {
  fit: () => void;
  zoomBy: (factor: number) => void;
};

export const NeuralCanvas = forwardRef<NeuralCanvasHandle, NeuralCanvasProps>(function NeuralCanvas({
  neurons,
  connections,
  selectedNeuronId,
  selectedConnectionId,
  focusNeuronId,
  resetSignal,
  onSelectNeuron,
  onSelectConnection,
  onLayoutSettled,
  onCreateConnection,
  connectionMode = false,
  neuronSpacing,
}: NeuralCanvasProps, ref) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportGroupRef = useRef<SVGGElement>(null);
  const nodeElementRefs = useRef(new Map<string, SVGGElement>());
  const nodeCircleRefs = useRef(new Map<string, SVGCircleElement>());
  const nodeLabelRefs = useRef(new Map<string, SVGTextElement>());
  const linkLineRefs = useRef(new Map<string, SVGLineElement>());
  const linkHitRefs = useRef(new Map<string, SVGLineElement>());
  const nodesRef = useRef<GraphNode[]>([]);
  const nodesByIdRef = useRef(new Map<string, GraphNode>());
  const simulationRef = useRef<Simulation<GraphNode, GraphLink> | null>(null);
  const sizeRef = useRef({ width: 1, height: 1 });
  const transformRef = useRef<GraphTransform>({ x: 0, y: 0, k: 1 });
  const hoveredNodeIdRef = useRef<string | null>(null);
  const onLayoutSettledRef = useRef(onLayoutSettled);
  const animationFrameRef = useRef<number | null>(null);
  const lastFocusRef = useRef<string | null>(null);
  const lastResetRef = useRef(resetSignal);
  const initialFitRef = useRef(false);
  const panRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const nodeDragRef = useRef<{ pointerId: number; nodeId: string; startX: number; startY: number; moved: boolean } | null>(null);
  const suppressNodeClickRef = useRef(false);
  const connectRef = useRef<{ pointerId: number; sourceId: string } | null>(null);
  const previewLineRef = useRef<SVGLineElement | null>(null);
  const connectionModeRef = useRef(connectionMode);
  const onCreateConnectionRef = useRef(onCreateConnection);
  const persistTimerRef = useRef<number | null>(null);

  onLayoutSettledRef.current = onLayoutSettled;
  connectionModeRef.current = connectionMode;
  onCreateConnectionRef.current = onCreateConnection;

  const neuronTopology = useMemo(() => neurons.map((neuron) => neuron.id).join("|"), [neurons]);
  const connectionTopology = useMemo(
    () => connections.map((connection) => `${connection.id}:${connection.sourceNeuronId}:${connection.targetNeuronId}`).join("|"),
    [connections],
  );
  const renderPositions = useMemo(
    () => Object.fromEntries(neurons.map((neuron, index) => [neuron.id, initialCoordinate(neuron, index)])),
    [neurons],
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

  const applyViewportTransform = () => {
    const viewport = sizeRef.current;
    const transform = transformRef.current;
    viewportGroupRef.current?.setAttribute(
      "transform",
      `translate(${viewport.width / 2 + transform.x} ${viewport.height / 2 + transform.y}) scale(${transform.k})`,
    );
  };

  const renderGraphFrame = (graphNodes = nodesRef.current) => {
    graphNodes.forEach((node) => {
      nodeElementRefs.current.get(node.id)?.setAttribute("transform", `translate(${node.x ?? 0} ${node.y ?? 0})`);
    });
    connections.forEach((connection) => {
      const source = nodesByIdRef.current.get(connection.sourceNeuronId);
      const target = nodesByIdRef.current.get(connection.targetNeuronId);
      if (!source || !target) return;
      [linkLineRefs.current.get(connection.id), linkHitRefs.current.get(connection.id)].forEach((line) => {
        if (!line) return;
        line.setAttribute("x1", String(source.x ?? 0));
        line.setAttribute("y1", String(source.y ?? 0));
        line.setAttribute("x2", String(target.x ?? 0));
        line.setAttribute("y2", String(target.y ?? 0));
      });
    });
  };

  const applyHighlight = (hoveredNodeId: string | null) => {
    const neighbors = hoveredNodeId ? adjacencyMap.get(hoveredNodeId) ?? new Set<string>() : new Set<string>();
    neurons.forEach((neuron) => {
      const hovered = neuron.id === hoveredNodeId;
      const related = hovered || neighbors.has(neuron.id);
      const selected = neuron.id === selectedNeuronId;
      const group = nodeElementRefs.current.get(neuron.id);
      const circle = nodeCircleRefs.current.get(neuron.id);
      const label = nodeLabelRefs.current.get(neuron.id);
      const radius = nodeRadius(connectionCounts.get(neuron.id) ?? 0);
      group?.setAttribute("opacity", hoveredNodeId && !related ? "0.28" : "1");
      circle?.setAttribute("r", String(hovered || selected ? radius * 1.18 : radius));
      circle?.setAttribute("fill", neuron.color);
      circle?.setAttribute("stroke", selected ? "#ffffff" : hovered ? "rgba(255,255,255,0.9)" : "transparent");
      circle?.setAttribute("stroke-width", selected ? "2.5" : hovered ? "1.5" : "0");
      circle?.setAttribute("filter", selected ? "url(#nm-node-selected)" : "");
      label?.setAttribute("fill", "#191515");
      label?.setAttribute("font-weight", hovered || selected ? "600" : "500");
    });
    connections.forEach((connection) => {
      const related = hoveredNodeId === connection.sourceNeuronId || hoveredNodeId === connection.targetNeuronId;
      const selected = connection.id === selectedConnectionId;
      const line = linkLineRefs.current.get(connection.id);
      line?.setAttribute("stroke", LINK_STROKE);
      line?.setAttribute("stroke-width", selected ? "1.5" : related ? "1.35" : "1.15");
      line?.setAttribute("opacity", hoveredNodeId && !related ? "0.18" : selected || related ? "0.95" : "0.8");
    });
  };

  const fitGraph = (graphNodes = nodesRef.current) => {
    const viewport = sizeRef.current;
    if (!graphNodes.length || viewport.width <= 1 || viewport.height <= 1) {
      transformRef.current = { x: 0, y: 0, k: 1 };
      applyViewportTransform();
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
    transformRef.current = { x: -((minX + maxX) / 2) * k, y: -((minY + maxY) / 2) * k, k };
    applyViewportTransform();
  };

  useImperativeHandle(ref, () => ({
    fit: () => fitGraph(nodesRef.current),
    zoomBy: (factor: number) => {
      const current = transformRef.current;
      const nextK = Math.min(3, Math.max(0.25, current.k * factor));
      const ratio = nextK / current.k;
      transformRef.current = { k: nextK, x: current.x * ratio, y: current.y * ratio };
      applyViewportTransform();
    },
  }));

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      sizeRef.current = { width: entry.contentRect.width, height: entry.contentRect.height };
      applyViewportTransform();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const previousNodes = new Map(nodesRef.current.map((node) => [node.id, node]));
    const activeIds = new Set(neurons.map((neuron) => neuron.id));
    const graphNodes: GraphNode[] = neurons.map((neuron, index) => {
      const previous = previousNodes.get(neuron.id);
      const initial = initialCoordinate(neuron, index);
      return {
        id: neuron.id,
        name: neuron.name,
        color: neuron.color,
        radius: nodeRadius(connectionCounts.get(neuron.id) ?? 0),
        x: previous?.x ?? initial.x,
        y: previous?.y ?? initial.y,
        vx: previous?.vx ?? 0,
        vy: previous?.vy ?? 0,
      };
    });
    const graphLinks: GraphLink[] = connections
      .filter((connection) => activeIds.has(connection.sourceNeuronId) && activeIds.has(connection.targetNeuronId))
      .map((connection) => ({ id: connection.id, source: connection.sourceNeuronId, target: connection.targetNeuronId }));
    nodesRef.current = graphNodes;
    nodesByIdRef.current = new Map(graphNodes.map((node) => [node.id, node]));

    let layoutCommitted = false;
    const commitSettledLayout = () => {
      if (layoutCommitted) return;
      layoutCommitted = true;
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
      .alphaTarget(0)
      .velocityDecay(0.4)
      .on("tick", () => {
        if (!layoutCommitted && simulation.alpha() < 0.025) commitSettledLayout();
        if (animationFrameRef.current !== null) return;
        animationFrameRef.current = window.requestAnimationFrame(() => {
          animationFrameRef.current = null;
          renderGraphFrame(graphNodes);
        });
      });
    simulationRef.current = simulation;
    renderGraphFrame(graphNodes);

    return () => {
      simulation.stop();
      if (simulationRef.current === simulation) simulationRef.current = null;
      if (animationFrameRef.current !== null) window.cancelAnimationFrame(animationFrameRef.current);
      if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
      animationFrameRef.current = null;
      persistTimerRef.current = null;
    };
    // Simulation rebuilds only for topology or force-spacing changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionTopology, neuronSpacing, neuronTopology]);

  useEffect(() => {
    applyHighlight(hoveredNodeIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConnectionId, selectedNeuronId]);

  useEffect(() => {
    if (connectionMode) return;
    connectRef.current = null;
    previewLineRef.current?.setAttribute("opacity", "0");
  }, [connectionMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      connectRef.current = null;
      previewLineRef.current?.setAttribute("opacity", "0");
      hoveredNodeIdRef.current = null;
      applyHighlight(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lastResetRef.current === resetSignal) return;
    lastResetRef.current = resetSignal;
    fitGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal]);

  useEffect(() => {
    if (!focusNeuronId || lastFocusRef.current === focusNeuronId) return;
    const node = nodesByIdRef.current.get(focusNeuronId);
    if (!node) return;
    lastFocusRef.current = focusNeuronId;
    const k = Math.max(1.15, transformRef.current.k);
    transformRef.current = { x: -(node.x ?? 0) * k, y: -(node.y ?? 0) * k, k };
    applyViewportTransform();
  }, [focusNeuronId]);

  const pointerToGraph = (clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const viewport = sizeRef.current;
    const transform = transformRef.current;
    return {
      x: (clientX - rect.left - viewport.width / 2 - transform.x) / transform.k,
      y: (clientY - rect.top - viewport.height / 2 - transform.y) / transform.k,
    };
  };

  const findNodeAt = (x: number, y: number, excludeId?: string): GraphNode | null => {
    let match: GraphNode | null = null;
    let best = Infinity;
    for (const node of nodesRef.current) {
      if (node.id === excludeId) continue;
      const distance = Math.hypot((node.x ?? 0) - x, (node.y ?? 0) - y);
      const hitRadius = node.radius + 14;
      if (distance <= hitRadius && distance < best) {
        match = node;
        best = distance;
      }
    }
    return match;
  };

  const updatePreviewLine = (x1: number, y1: number, x2: number, y2: number, visible: boolean) => {
    const line = previewLineRef.current;
    if (!line) return;
    line.setAttribute("x1", String(x1));
    line.setAttribute("y1", String(y1));
    line.setAttribute("x2", String(x2));
    line.setAttribute("y2", String(y2));
    line.setAttribute("opacity", visible ? "0.7" : "0");
  };

  const cancelConnect = () => {
    connectRef.current = null;
    updatePreviewLine(0, 0, 0, 0, false);
    hoveredNodeIdRef.current = null;
    applyHighlight(null);
  };

  const beginConnect = (event: ReactPointerEvent<SVGGElement>, nodeId: string) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const source = nodesByIdRef.current.get(nodeId);
    if (!source) return;
    const point = pointerToGraph(event.clientX, event.clientY);
    connectRef.current = { pointerId: event.pointerId, sourceId: nodeId };
    hoveredNodeIdRef.current = nodeId;
    applyHighlight(nodeId);
    updatePreviewLine(source.x ?? 0, source.y ?? 0, point.x, point.y, true);
  };

  const moveConnect = (event: ReactPointerEvent<SVGGElement>, nodeId: string) => {
    const drag = connectRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.sourceId !== nodeId) return;
    event.stopPropagation();
    const source = nodesByIdRef.current.get(drag.sourceId);
    if (!source) return;
    const point = pointerToGraph(event.clientX, event.clientY);
    const target = findNodeAt(point.x, point.y, drag.sourceId);
    hoveredNodeIdRef.current = target?.id ?? drag.sourceId;
    applyHighlight(hoveredNodeIdRef.current);
    updatePreviewLine(source.x ?? 0, source.y ?? 0, target ? (target.x ?? point.x) : point.x, target ? (target.y ?? point.y) : point.y, true);
  };

  const endConnect = (event: ReactPointerEvent<SVGGElement>, nodeId: string) => {
    const drag = connectRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.sourceId !== nodeId) return;
    event.stopPropagation();
    const point = pointerToGraph(event.clientX, event.clientY);
    const target = findNodeAt(point.x, point.y, drag.sourceId);
    cancelConnect();
    if (target) onCreateConnectionRef.current?.(drag.sourceId, target.id);
  };

  const beginPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const transform = transformRef.current;
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: transform.x,
      originY: transform.y,
      moved: false,
    };
  };

  const movePan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    pan.moved ||= Math.hypot(event.clientX - pan.startX, event.clientY - pan.startY) > 5;
    transformRef.current.x = pan.originX + event.clientX - pan.startX;
    transformRef.current.y = pan.originY + event.clientY - pan.startY;
    applyViewportTransform();
  };

  const endPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    const pan = panRef.current;
    if (!pan || pan.pointerId !== event.pointerId) return;
    panRef.current = null;
  };

  const zoomGraph = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const viewport = sizeRef.current;
    const current = transformRef.current;
    const pointerX = event.clientX - rect.left - viewport.width / 2;
    const pointerY = event.clientY - rect.top - viewport.height / 2;
    const nextK = Math.min(3, Math.max(0.25, current.k * Math.exp(-event.deltaY * 0.0012)));
    const ratio = nextK / current.k;
    transformRef.current = {
      k: nextK,
      x: pointerX - (pointerX - current.x) * ratio,
      y: pointerY - (pointerY - current.y) * ratio,
    };
    applyViewportTransform();
  };

  const beginNodeDrag = (event: ReactPointerEvent<SVGGElement>, nodeId: string) => {
    event.stopPropagation();
    suppressNodeClickRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    const node = nodesByIdRef.current.get(nodeId);
    if (!node) return;
    const point = pointerToGraph(event.clientX, event.clientY);
    node.fx = point.x;
    node.fy = point.y;
    node.x = point.x;
    node.y = point.y;
    nodeDragRef.current = { pointerId: event.pointerId, nodeId, startX: event.clientX, startY: event.clientY, moved: false };
    hoveredNodeIdRef.current = nodeId;
    applyHighlight(nodeId);
    renderGraphFrame();
    simulationRef.current?.alphaTarget(0.08).restart();
  };

  const moveNodeDrag = (event: ReactPointerEvent<SVGGElement>, nodeId: string) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.nodeId !== nodeId) return;
    event.stopPropagation();
    drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
    const node = nodesByIdRef.current.get(nodeId);
    if (!node) return;
    const point = pointerToGraph(event.clientX, event.clientY);
    node.fx = point.x;
    node.fy = point.y;
  };

  const endNodeDrag = (event: ReactPointerEvent<SVGGElement>, nodeId: string) => {
    const drag = nodeDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId || drag.nodeId !== nodeId) return;
    event.stopPropagation();
    // Keep the gesture result until click: pointerup precedes the browser's click.
    suppressNodeClickRef.current = drag.moved || event.type === "pointercancel" ||
      Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5;
    const node = nodesByIdRef.current.get(nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
    nodeDragRef.current = null;
    simulationRef.current?.alphaTarget(0.005);

    if (persistTimerRef.current !== null) window.clearTimeout(persistTimerRef.current);
    persistTimerRef.current = window.setTimeout(() => {
      simulationRef.current?.alphaTarget(0);
      onLayoutSettledRef.current(
        Object.fromEntries(nodesRef.current.map((item) => [item.id, { x: item.x ?? 0, y: item.y ?? 0, z: 0 }])),
      );
      persistTimerRef.current = null;
    }, 1200);
  };

  return (
    <div ref={containerRef} className="h-full min-h-[420px] w-full overflow-hidden bg-[#FAF7F2]">
      <svg
        width="100%"
        height="100%"
        className={`block touch-none select-none ${connectionMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}`}
        onPointerDown={beginPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
        onWheel={zoomGraph}
      >
        <defs>
          <filter id="nm-node-selected" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="1.6" floodColor="#4F8DF7" floodOpacity="0.45" />
          </filter>
        </defs>
        <g ref={viewportGroupRef}>
          <line
            ref={previewLineRef}
            x1={0}
            y1={0}
            x2={0}
            y2={0}
            stroke="#2563eb"
            strokeWidth={1.4}
            opacity={0}
            vectorEffect="non-scaling-stroke"
            className="pointer-events-none"
          />
          {connections.map((connection) => {
            const source = renderPositions[connection.sourceNeuronId] ?? { x: 0, y: 0 };
            const target = renderPositions[connection.targetNeuronId] ?? { x: 0, y: 0 };
            const selected = selectedConnectionId === connection.id;
            return (
              <g key={connection.id}>
                <line
                  ref={(element) => {
                    if (element) linkLineRefs.current.set(connection.id, element);
                    else linkLineRefs.current.delete(connection.id);
                  }}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke={LINK_STROKE}
                  strokeWidth={selected ? 1.5 : 1.15}
                  opacity={selected ? 0.95 : 0.8}
                  vectorEffect="non-scaling-stroke"
                  className="pointer-events-none"
                />
                <line
                  ref={(element) => {
                    if (element) linkHitRefs.current.set(connection.id, element);
                    else linkHitRefs.current.delete(connection.id);
                  }}
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="transparent"
                  strokeWidth={12}
                  pointerEvents={connectionMode ? "none" : "stroke"}
                  vectorEffect="non-scaling-stroke"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (connectionMode) return;
                    onSelectConnection(connection.id);
                  }}
                  className="cursor-pointer"
                />
              </g>
            );
          })}

          {neurons.map((neuron) => {
            const position = renderPositions[neuron.id] ?? { x: 0, y: 0 };
            const radius = nodeRadius(connectionCounts.get(neuron.id) ?? 0);
            const selected = selectedNeuronId === neuron.id;
            return (
              <g
                key={neuron.id}
                ref={(element) => {
                  if (element) nodeElementRefs.current.set(neuron.id, element);
                  else nodeElementRefs.current.delete(neuron.id);
                }}
                transform={`translate(${position.x} ${position.y})`}
                className={connectionMode ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
                onPointerEnter={() => {
                  if (connectRef.current) return;
                  hoveredNodeIdRef.current = neuron.id;
                  applyHighlight(neuron.id);
                }}
                onPointerLeave={() => {
                  if (nodeDragRef.current?.nodeId === neuron.id || connectRef.current) return;
                  hoveredNodeIdRef.current = null;
                  applyHighlight(null);
                }}
                onPointerDown={(event) => {
                  if (connectionModeRef.current) beginConnect(event, neuron.id);
                  else beginNodeDrag(event, neuron.id);
                }}
                onPointerMove={(event) => {
                  if (connectionModeRef.current) moveConnect(event, neuron.id);
                  else moveNodeDrag(event, neuron.id);
                }}
                onPointerUp={(event) => {
                  if (connectionModeRef.current) endConnect(event, neuron.id);
                  else endNodeDrag(event, neuron.id);
                }}
                onPointerCancel={(event) => {
                  if (connectionModeRef.current) endConnect(event, neuron.id);
                  else endNodeDrag(event, neuron.id);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  if (connectionModeRef.current) return;
                  if (suppressNodeClickRef.current) {
                    suppressNodeClickRef.current = false;
                    return;
                  }
                  onSelectNeuron(neuron.id);
                }}
              >
                <circle
                  ref={(element) => {
                    if (element) nodeCircleRefs.current.set(neuron.id, element);
                    else nodeCircleRefs.current.delete(neuron.id);
                  }}
                  r={radius}
                  fill={neuron.color}
                  stroke={selected ? "#ffffff" : "transparent"}
                  strokeWidth={selected ? 2.5 : 0}
                  filter={selected ? "url(#nm-node-selected)" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  ref={(element) => {
                    if (element) nodeLabelRefs.current.set(neuron.id, element);
                    else nodeLabelRefs.current.delete(neuron.id);
                  }}
                  x={radius + 7}
                  y={4}
                  fill="#191515"
                  fontSize={13}
                  fontWeight={selected ? 600 : 500}
                  stroke="#FAF7F2"
                  strokeWidth={2.5}
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
});
