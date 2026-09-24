import { useEffect, useMemo, useState } from "react";
import { Dashboard } from "./components/Dashboard";
import { LearningMap } from "./components/LearningMap";
import { Settings } from "./components/Settings";
import { Sidebar } from "./components/Sidebar";
import type { Neuron, NeuronConnection, Position3D, Selection, Subject, ViewName } from "./types";
import { areSameConnection } from "./utils/neuron";
import { loadGraph, saveGraph } from "./utils/storage";

export default function App() {
  const [initialGraph] = useState(loadGraph);
  const [activeView, setActiveView] = useState<ViewName>("dashboard");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>(initialGraph.subjects);
  const [neurons, setNeurons] = useState<Neuron[]>(initialGraph.neurons);
  const [connections, setConnections] = useState<NeuronConnection[]>(initialGraph.connections);
  const [selectedSubjectId, setSelectedSubjectId] = useState(initialGraph.subjects[0]?.id ?? "microeconomics");
  const [selection, setSelection] = useState<Selection>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ source: Neuron; target: Neuron } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    saveGraph({ subjects, neurons, connections });
  }, [subjects, neurons, connections]);

  const dashboardSubjects = useMemo(
    () =>
      subjects.map((subject) => ({
        ...subject,
        neuronCount: neurons.filter((neuron) => neuron.subjectId === subject.id).length,
        connectionCount: connections.filter((connection) => connection.subjectId === subject.id).length,
      })),
    [subjects, neurons, connections],
  );

  const selectedSubject = useMemo(
    () => dashboardSubjects.find((subject) => subject.id === selectedSubjectId) ?? dashboardSubjects[0],
    [dashboardSubjects, selectedSubjectId],
  );

  const subjectNeurons = neurons.filter((neuron) => neuron.subjectId === selectedSubject.id);
  const subjectConnections = connections.filter((connection) => connection.subjectId === selectedSubject.id);

  const createSubject = (payload: { name: string; description: string; color: string }) => {
    const id = crypto.randomUUID();
    setSubjects((current) => [
      ...current,
      {
        id,
        name: payload.name,
        description: payload.description,
        color: payload.color,
        neuronCount: 0,
        connectionCount: 0,
      },
    ]);
  };

  const openSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setActiveView("map");
    setMapExpanded(false);
    setSelection(null);
    setIsConnecting(false);
    setConnectionSourceId(null);
    setNotice(null);
  };

  const selectNeuron = (neuronId: string) => {
    if (!neuronId) {
      setSelection(null);
      return;
    }

    if (isConnecting && !connectionSourceId) {
      setConnectionSourceId(neuronId);
      setNotice(null);
      return;
    }

    if (isConnecting && connectionSourceId) {
      if (connectionSourceId === neuronId) {
        setNotice("Không thể tạo liên kết từ một neuron đến chính nó.");
        return;
      }
      const duplicate = subjectConnections.some((connection) =>
        areSameConnection(connectionSourceId, neuronId, connection.sourceNeuronId, connection.targetNeuronId),
      );
      if (duplicate) {
        setNotice("Liên kết này đã tồn tại.");
        setConnectionSourceId(null);
        return;
      }
      const source = subjectNeurons.find((neuron) => neuron.id === connectionSourceId);
      const target = subjectNeurons.find((neuron) => neuron.id === neuronId);
      if (source && target) setPendingConnection({ source, target });
      setNotice(null);
      return;
    }

    setSelection({ type: "neuron", id: neuronId });
    setNotice(null);
  };

  const createConnection = (explanation: string) => {
    if (!pendingConnection) return;
    const timestamp = new Date().toISOString();
    const id = `connection-${crypto.randomUUID()}`;
    setConnections((current) => [
      ...current,
      {
        id,
        subjectId: selectedSubject.id,
        sourceNeuronId: pendingConnection.source.id,
        targetNeuronId: pendingConnection.target.id,
        explanation,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ]);
    setSelection({ type: "connection", id });
    setIsConnecting(false);
    setConnectionSourceId(null);
    setPendingConnection(null);
  };

  const addNeuron = (neuron: Neuron) => {
    setNeurons((current) => [...current, neuron]);
    setSelection({ type: "neuron", id: neuron.id });
  };

  const updateNeuronPosition = (neuronId: string, position: Position3D) => {
    setNeurons((current) =>
      current.map((neuron) => (neuron.id === neuronId ? { ...neuron, position, updatedAt: new Date().toISOString() } : neuron)),
    );
  };

  const deleteNeuron = (neuronId: string) => {
    setNeurons((current) => current.filter((neuron) => neuron.id !== neuronId));
    setConnections((current) =>
      current.filter((connection) => connection.sourceNeuronId !== neuronId && connection.targetNeuronId !== neuronId),
    );
    setSelection(null);
    setConnectionSourceId(null);
  };

  const deleteConnection = (connectionId: string) => {
    setConnections((current) => current.filter((connection) => connection.id !== connectionId));
    setSelection(null);
  };

  const renderView = () => {
    if (activeView === "dashboard") {
      return <Dashboard subjects={dashboardSubjects} onOpenSubject={openSubject} onCreateSubject={createSubject} />;
    }
    if (activeView === "settings") return <Settings />;
  if (!selectedSubject) return <Dashboard subjects={dashboardSubjects} onOpenSubject={openSubject} onCreateSubject={createSubject} />;
  return (
      <LearningMap
        subject={selectedSubject}
        neurons={subjectNeurons}
        connections={subjectConnections}
        mapExpanded={mapExpanded}
        onToggleMapExpanded={() => setMapExpanded((value) => !value)}
        selection={selection}
        isConnecting={isConnecting}
        connectionSourceId={connectionSourceId}
        notice={notice}
        onBack={() => {
          setMapExpanded(false);
          setActiveView("dashboard");
        }}
        onSelectNeuron={selectNeuron}
        onSelectConnection={(connectionId) => setSelection(connectionId ? { type: "connection", id: connectionId } : null)}
        onMoveNeuron={updateNeuronPosition}
        onCreateNeuron={addNeuron}
        onUpdateNeuron={(updated) => setNeurons((current) => current.map((neuron) => (neuron.id === updated.id ? updated : neuron)))}
        onDeleteNeuron={deleteNeuron}
        onStartConnection={() => {
          setIsConnecting(true);
          setConnectionSourceId(null);
          setPendingConnection(null);
          setSelection(null);
          setNotice(null);
        }}
        pendingConnection={pendingConnection}
        onCancelConnection={() => {
          setIsConnecting(false);
          setPendingConnection(null);
          setConnectionSourceId(null);
        }}
        onCreateConnection={createConnection}
        onUpdateConnection={(updated) =>
          setConnections((current) => current.map((connection) => (connection.id === updated.id ? updated : connection)))
        }
        onDeleteConnection={deleteConnection}
      />
    );
  };

  const navigate = (view: ViewName) => {
    setActiveView(view);
    if (view !== "map") setMapExpanded(false);
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 md:h-screen md:flex-row">
      {!(activeView === "map" && mapExpanded) && <Sidebar activeView={activeView} onNavigate={navigate} />}
      {renderView()}
    </div>
  );
}
