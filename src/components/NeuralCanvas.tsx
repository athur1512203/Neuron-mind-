import { Html, OrbitControls } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Neuron, NeuronConnection, Position3D } from "../types";
import { getConnectionCount } from "../utils/neuron";

type NeuralCanvasProps = {
  neurons: Neuron[];
  connections: NeuronConnection[];
  selectedNeuronId: string | null;
  selectedConnectionId: string | null;
  connectionSourceId: string | null;
  focusNeuronId: string | null;
  resetSignal: number;
  onSelectNeuron: (neuronId: string) => void;
  onSelectConnection: (connectionId: string) => void;
};

type ControlsHandle = {
  enabled: boolean;
  target: THREE.Vector3;
  update: () => void;
};

const glowTexture = createRadialGlowTexture();

// Visual spacing multiplier for the 3D knowledge graph.
// Stored neuron coordinates remain unchanged; only scene coordinates are expanded.
const GRAPH_SPREAD = 1.6;

function toDisplayPosition(position: Position3D) {
  return new THREE.Vector3(
    position.x * GRAPH_SPREAD,
    position.y * GRAPH_SPREAD,
    position.z * GRAPH_SPREAD,
  );
}

// Neuron size is driven only by its number of connections.
// 0 connections = smallest; growth slows logarithmically as connections increase.
function getNeuronRadius(connectionCount: number) {
  const safeCount = Math.max(0, connectionCount);
  const scaledRadius = (0.22 + Math.log2(safeCount + 1) * 0.075) * 0.55;
  return Math.min(0.36, Math.max(0.15, scaledRadius));
}

function createRadialGlowTexture() {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.Texture();
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(255,255,255,0.9)");
  gradient.addColorStop(0.1, "rgba(255,255,255,0.45)");
  gradient.addColorStop(0.28, "rgba(255,255,255,0.16)");
  gradient.addColorStop(0.5, "rgba(255,255,255,0.05)");
  gradient.addColorStop(0.75, "rgba(255,255,255,0.012)");
  gradient.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function shiftHex(hex: string, sat: number, light: number, hue = 0) {
  const color = new THREE.Color(hex);
  color.offsetHSL(hue, sat, light);
  return color;
}

function luminousColor(hex: string, lighten = 0.12) {
  return shiftHex(hex, 0.12, lighten);
}

function neuronPalette(hex: string) {
  return {
    core: shiftHex(hex, 0.22, -0.14),
    surface: shiftHex(hex, 0.12, -0.04),
    rim: shiftHex(hex, 0.06, 0.24),
    glow: shiftHex(hex, 0.04, 0.16, 0.02),
  };
}

const rimVertex = `
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalize(normalMatrix * normal);
  vViewDir = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const rimFragment = `
uniform vec3 uColor;
uniform float uIntensity;
varying vec3 vNormal;
varying vec3 vViewDir;
void main() {
  float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDir))), 1.7);
  gl_FragColor = vec4(uColor, fresnel * uIntensity);
}
`;

function DimGrid() {
  const gridRef = useRef<THREE.GridHelper>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const materials = Array.isArray(grid.material) ? grid.material : [grid.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = 1;
    });
  }, []);

  return <gridHelper ref={gridRef} args={[32, 32, "#243044", "#152033"]} position={[0, -6, 0]} />;
}

function RaycasterSettings() {
  const { raycaster } = useThree();

  useEffect(() => {
    const previousThreshold = raycaster.params.Line?.threshold;
    raycaster.params.Line = { threshold: 0.08 };

    return () => {
      raycaster.params.Line = { threshold: previousThreshold ?? 1 };
    };
  }, [raycaster]);

  return null;
}

export function NeuralCanvas(props: NeuralCanvasProps) {
  const controlsRef = useRef<ControlsHandle | null>(null);
  const [hoveredNeuronId, setHoveredNeuronId] = useState<string | null>(null);

  const activeFocusId = props.selectedNeuronId ?? hoveredNeuronId;

  return (
    <div className="h-full min-h-[520px] overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <Canvas shadows camera={{ position: [10, 7, 13], fov: 48, near: 0.1, far: 200 }}>
        <RaycasterSettings />
        <color attach="background" args={["#070b14"]} />
        <fog attach="fog" args={["#070b14", 12, 26]} />
        <ambientLight intensity={0.28} />
        <directionalLight position={[5, 7, 9]} intensity={1.7} />
        <pointLight position={[8, 8, 8]} intensity={0.7} />
        <pointLight position={[-6, -3, -4]} intensity={0.35} color="#7dd3fc" />

        <CameraController
          controlsRef={controlsRef}
          neurons={props.neurons}
          focusNeuronId={props.focusNeuronId}
          resetSignal={props.resetSignal}
        />

        {props.connections.map((connection, index) => {
          const touchesFocus =
            Boolean(activeFocusId) &&
            (connection.sourceNeuronId === activeFocusId || connection.targetNeuronId === activeFocusId);
          const selectedHighlight = Boolean(props.selectedNeuronId) && touchesFocus;
          const hoverHighlight = !props.selectedNeuronId && Boolean(hoveredNeuronId) && touchesFocus;
          return (
            <NeuronConnectionLine
              key={connection.id}
              connection={connection}
              neurons={props.neurons}
              sourceRadius={getNeuronRadius(getConnectionCount(connection.sourceNeuronId, props.connections))}
              targetRadius={getNeuronRadius(getConnectionCount(connection.targetNeuronId, props.connections))}
              selected={props.selectedConnectionId === connection.id}
              highlighted={selectedHighlight || hoverHighlight}
              hoverOnly={hoverHighlight && !selectedHighlight}
              pulseIndex={index}
              onClick={props.onSelectConnection}
            />
          );
        })}

        {props.neurons.map((neuron) => {
          const selected = props.selectedNeuronId === neuron.id;
          const isConnectionSource = props.connectionSourceId === neuron.id;
          return (
            <NeuronNode
              key={neuron.id}
              neuron={neuron}
              selected={selected}
              isConnectionSource={isConnectionSource}
              connectionCount={getConnectionCount(neuron.id, props.connections)}
              onSelect={props.onSelectNeuron}
              onHoverChange={setHoveredNeuronId}
            />
          );
        })}

        <DimGrid />
        <OrbitControls
          ref={controlsRef as never}
          enableRotate
          enableZoom
          enablePan
          enableDamping
          dampingFactor={0.08}
          makeDefault
        />
      </Canvas>
    </div>
  );
}

function CameraController({
  controlsRef,
  neurons,
  focusNeuronId,
  resetSignal,
}: {
  controlsRef: React.MutableRefObject<ControlsHandle | null>;
  neurons: Neuron[];
  focusNeuronId: string | null;
  resetSignal: number;
}) {
  const { camera } = useThree();
  const lastFocusRef = useRef<string | null>(null);
  const lastResetRef = useRef(resetSignal);

  useEffect(() => {
    if (lastResetRef.current === resetSignal) return;
    lastResetRef.current = resetSignal;

    if (!neurons.length) {
      camera.position.set(10, 7, 13);
      controlsRef.current?.target.set(0, 0, 0);
      controlsRef.current?.update();
      return;
    }

    const box = new THREE.Box3();
    neurons.forEach((neuron) => {
      box.expandByPoint(toDisplayPosition(neuron.position));
    });

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z, 4);
    const distance = Math.max(10, maxDimension * 1.35);
    const direction = new THREE.Vector3(0.75, 0.55, 1).normalize();

    camera.position.copy(center.clone().add(direction.multiplyScalar(distance)));
    camera.near = 0.1;
    camera.far = Math.max(200, distance * 10);
    camera.updateProjectionMatrix();

    controlsRef.current?.target.copy(center);
    controlsRef.current?.update();
  }, [camera, controlsRef, neurons, resetSignal]);

  useEffect(() => {
    if (!focusNeuronId || lastFocusRef.current === focusNeuronId) return;
    const neuron = neurons.find((item) => item.id === focusNeuronId);
    if (!neuron) return;

    lastFocusRef.current = focusNeuronId;
    const target = toDisplayPosition(neuron.position);
    camera.position.copy(target.clone().add(new THREE.Vector3(4.5, 3.4, 6)));
    controlsRef.current?.target.copy(target);
    controlsRef.current?.update();
  }, [camera, controlsRef, focusNeuronId, neurons]);

  return null;
}

function NeuronNode({
  neuron,
  selected,
  isConnectionSource,
  connectionCount,
  onSelect,
  onHoverChange,
}: {
  neuron: Neuron;
  selected: boolean;
  isConnectionSource: boolean;
  connectionCount: number;
  onSelect: (neuronId: string) => void;
  onHoverChange: (neuronId: string | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const rimRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Sprite>(null);
  const coreScale = useRef(new THREE.Vector3());
  const rimScale = useRef(new THREE.Vector3());
  const glowScale = useRef(new THREE.Vector3());
  const [hovered, setHovered] = useState(false);

  const targetRadius = getNeuronRadius(connectionCount);
  const palette = useMemo(() => neuronPalette(neuron.color), [neuron.color]);
  const rimUniforms = useMemo(
    () => ({
      uColor: { value: palette.rim.clone() },
      uIntensity: { value: 1.15 },
    }),
    [palette],
  );

  useFrame(() => {
    const scale = selected || isConnectionSource ? targetRadius * 1.12 : hovered ? targetRadius * 1.06 : targetRadius;
    const glowSize = scale * 4.2;
    coreScale.current.set(scale, scale, scale);
    rimScale.current.set(scale * 1.07, scale * 1.07, scale * 1.07);
    glowScale.current.set(glowSize, glowSize, 1);
    meshRef.current?.scale.lerp(coreScale.current, 0.16);
    rimRef.current?.scale.lerp(rimScale.current, 0.16);
    glowRef.current?.scale.lerp(glowScale.current, 0.16);
    rimUniforms.uIntensity.value = selected || isConnectionSource ? 1.55 : hovered ? 1.28 : 1.12;
  });

  return (
    <group position={[neuron.position.x * GRAPH_SPREAD, neuron.position.y * GRAPH_SPREAD, neuron.position.z * GRAPH_SPREAD]}>
      <sprite ref={glowRef} renderOrder={0} raycast={() => {}}>
        <spriteMaterial
          map={glowTexture}
          color={palette.glow}
          transparent
          opacity={selected || isConnectionSource ? 0.9 : hovered ? 0.78 : 0.68}
          depthWrite={false}
          fog={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>
      <mesh ref={rimRef} renderOrder={1} raycast={() => {}}>
        <sphereGeometry args={[1, 32, 32]} />
        <shaderMaterial
          uniforms={rimUniforms}
          vertexShader={rimVertex}
          fragmentShader={rimFragment}
          transparent
          depthWrite={false}
          fog={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
          side={THREE.FrontSide}
        />
      </mesh>
      <mesh
        ref={meshRef}
        renderOrder={2}
        onClick={(event) => {
          event.stopPropagation();
          onSelect(neuron.id);
        }}
        onPointerOver={(event) => {
          event.stopPropagation();
          setHovered(true);
          onHoverChange(neuron.id);
        }}
        onPointerOut={() => {
          setHovered(false);
          onHoverChange(null);
        }}
      >
        <sphereGeometry args={[1, 48, 48]} />
        <meshStandardMaterial
          color={palette.core}
          emissive={palette.core}
          emissiveIntensity={selected || isConnectionSource ? 1.05 : hovered ? 0.92 : 0.82}
          roughness={0.45}
          metalness={0}
          envMapIntensity={0}
          fog={false}
          toneMapped={false}
          transparent={false}
          opacity={1}
        />
      </mesh>
    <Html
  center
  position={[0, targetRadius + 0.32, 0]}
  zIndexRange={[20, 0]}
  style={{
    pointerEvents: "none",
    whiteSpace: "nowrap",
  }}
>
  <div
    className={`rounded-md border border-white/30 bg-slate-950/95 px-2.5 py-1
      text-[14px] font-bold text-white shadow-lg
      opacity-100`}
  >
    {neuron.name}
  </div>
</Html>
    </group>
  );
}

function createStraightLineGeometry(sourceColor: THREE.Color, targetColor: THREE.Color) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(6), 3));
  geometry.setAttribute(
    "color",
    new THREE.BufferAttribute(
      new Float32Array([
        sourceColor.r,
        sourceColor.g,
        sourceColor.b,
        targetColor.r,
        targetColor.g,
        targetColor.b,
      ]),
      3,
    ),
  );
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1000);
  return geometry;
}

function NeuronConnectionLine({
  connection,
  neurons,
  sourceRadius,
  targetRadius,
  selected,
  highlighted,
  hoverOnly,
  pulseIndex,
  onClick,
}: {
  connection: NeuronConnection;
  neurons: Neuron[];
  sourceRadius: number;
  targetRadius: number;
  selected: boolean;
  highlighted: boolean;
  hoverOnly: boolean;
  pulseIndex: number;
  onClick: (connectionId: string) => void;
}) {
  const source = neurons.find((neuron) => neuron.id === connection.sourceNeuronId);
  const targetNeuron = neurons.find((neuron) => neuron.id === connection.targetNeuronId);
  const pulseRef = useRef<THREE.Sprite>(null);
  const startRef = useRef(new THREE.Vector3());
  const endRef = useRef(new THREE.Vector3());
  const showPulse = pulseIndex % 3 !== 2;

  const sourceColor = useMemo(() => luminousColor(source?.color ?? "#8aa0bd", 0.08), [source?.color]);
  const targetColor = useMemo(() => luminousColor(targetNeuron?.color ?? source?.color ?? "#8aa0bd", 0.08), [source?.color, targetNeuron?.color]);
  const geometry = useMemo(
    () => createStraightLineGeometry(sourceColor, targetColor),
    [sourceColor, targetColor],
  );
  const raycastConnection = useMemo(
    () =>
      function raycastConnectionLine(
        this: THREE.LineSegments,
        raycaster: THREE.Raycaster,
        intersections: THREE.Intersection[],
      ) {
        const pointerOverNeuron = neurons.some((neuron) => {
          const position = toDisplayPosition(neuron.position);
          return raycaster.ray.distanceSqToPoint(position) <= 0.42 ** 2;
        });
        if (pointerOverNeuron) return;

        THREE.LineSegments.prototype.raycast.call(this, raycaster, intersections);
      },
    [neurons],
  );

  useEffect(() => {
    if (!source || !targetNeuron) return;

    const centerA = toDisplayPosition(source.position);
    const centerB = toDisplayPosition(targetNeuron.position);
    const direction = centerB.clone().sub(centerA);
    const distance = Math.max(direction.length(), 0.001);
    direction.multiplyScalar(1 / distance);
    const maxOffset = distance * 0.42;
    const start = startRef.current.copy(centerA).addScaledVector(direction, Math.min(sourceRadius * 0.95, maxOffset));
    const end = endRef.current.copy(centerB).addScaledVector(direction, -Math.min(targetRadius * 0.95, maxOffset));
    const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
    positions.setXYZ(0, start.x, start.y, start.z);
    positions.setXYZ(1, end.x, end.y, end.z);
    positions.needsUpdate = true;

  }, [
    geometry,
    source?.position.x,
    source?.position.y,
    source?.position.z,
    sourceRadius,
    targetNeuron?.position.x,
    targetNeuron?.position.y,
    targetNeuron?.position.z,
    targetRadius,
  ]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const sprite = pulseRef.current;
    if (!sprite || !showPulse) {
      if (sprite) sprite.visible = false;
      return;
    }
    sprite.visible = true;
    const t = (clock.elapsedTime * 0.14 + pulseIndex * 0.17) % 1;
    sprite.position.lerpVectors(startRef.current, endRef.current, t);
  });

  if (!source || !targetNeuron) return null;

  const innerColor = luminousColor(source?.color ?? "#8aa0bd", 0.22);
  const coreOpacity = selected ? 0.98 : highlighted ? (hoverOnly ? 0.92 : 0.96) : 0.9;
  const glowOpacity = selected ? 0.48 : highlighted ? 0.42 : 0.3;

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onClick(connection.id);
  };

  return (
    <group>
      <lineSegments geometry={geometry} renderOrder={0} raycast={() => {}}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={glowOpacity}
          depthWrite={false}
          fog={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </lineSegments>
      <lineSegments geometry={geometry} renderOrder={1} raycast={raycastConnection} onClick={handleClick}>
        <lineBasicMaterial
          vertexColors
          transparent
          opacity={coreOpacity}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </lineSegments>
      {showPulse ? (
        <sprite ref={pulseRef} scale={[0.14, 0.14, 1]}>
          <spriteMaterial
            map={glowTexture}
            color={innerColor}
            transparent
            opacity={0.95}
            depthWrite={false}
            fog={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </sprite>
      ) : null}
    </group>
  );
}
