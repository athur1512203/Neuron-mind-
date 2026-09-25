import { useEffect, useMemo, useState } from "react";
import { getMe } from "./api/auth";
import { apiMessage, clearToken, getToken, setUnauthorizedHandler } from "./api/client";
import { createConnection as createConnectionApi, deleteConnection as deleteConnectionApi } from "./api/connections";
import { createNeuron as createNeuronApi, deleteNeuron as deleteNeuronApi, updateNeuron as updateNeuronApi } from "./api/neurons";
import { createSubject as createSubjectApi, deleteSubject as deleteSubjectApi, getSubjectGraph, listSubjects } from "./api/subjects";
import type { ApiUser } from "./api/mappers";
import { AuthScreen } from "./components/AuthScreen";
import { Dashboard } from "./components/Dashboard";
import { LearningMap } from "./components/LearningMap";
import { Settings } from "./components/Settings";
import { Sidebar } from "./components/Sidebar";
import type { Neuron, NeuronConnection, Selection, Subject, ViewName } from "./types";
import { areSameConnection } from "./utils/neuron";

export default function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>("dashboard");
  const [mapExpanded, setMapExpanded] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);
  const [neurons, setNeurons] = useState<Neuron[]>([]);
  const [connections, setConnections] = useState<NeuronConnection[]>([]);
  const [graphLoading, setGraphLoading] = useState(false);
  const [graphError, setGraphError] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionSourceId, setConnectionSourceId] = useState<string | null>(null);
  const [pendingConnection, setPendingConnection] = useState<{ source: Neuron; target: Neuron } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setSubjects([]);
      setNeurons([]);
      setConnections([]);
    });
    const token = getToken();
    if (!token) {
      setAuthReady(true);
      return;
    }
    getMe()
      .then(setUser)
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setAuthReady(true));
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!user) return;
    setSubjectsLoading(true);
    setSubjectsError(null);
    listSubjects()
      .then((next) => {
        setSubjects(next);
        setSelectedSubjectId((current) => current ?? next[0]?.id ?? null);
      })
      .catch((error) => setSubjectsError(apiMessage(error, "Không tải được danh sách môn học.")))
      .finally(() => setSubjectsLoading(false));
  }, [user]);

  useEffect(() => {
    if (!user || activeView !== "map" || !selectedSubjectId) return;
    let cancelled = false;
    setGraphLoading(true);
    setGraphError(null);
    getSubjectGraph(selectedSubjectId)
      .then((graph) => {
        if (cancelled) return;
        setNeurons(graph.neurons);
        setConnections(graph.connections);
      })
      .catch((error) => {
        if (cancelled) return;
        setNeurons([]);
        setConnections([]);
        setGraphError(apiMessage(error, "Không tải được sơ đồ học."));
      })
      .finally(() => {
        if (!cancelled) setGraphLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, activeView, selectedSubjectId]);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0],
    [subjects, selectedSubjectId],
  );

  const subjectNeurons = selectedSubject ? neurons.filter((neuron) => neuron.subjectId === selectedSubject.id) : [];
  const subjectConnections = selectedSubject
    ? connections.filter((connection) => connection.subjectId === selectedSubject.id)
    : [];

  const bumpCounts = (subjectId: string, neuronDelta: number, connectionDelta: number) => {
    setSubjects((current) =>
      current.map((subject) =>
        subject.id === subjectId
          ? {
              ...subject,
              neuronCount: Math.max(0, subject.neuronCount + neuronDelta),
              connectionCount: Math.max(0, subject.connectionCount + connectionDelta),
            }
          : subject,
      ),
    );
  };

  const createSubject = async (payload: { name: string; description: string; color: string }) => {
    const subject = await createSubjectApi({ name: payload.name, color: payload.color });
    setSubjects((current) => [subject, ...current]);
  };

  const removeSubject = async (subjectId: string) => {
    try {
      await deleteSubjectApi(subjectId);
      setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
      setNeurons((current) => current.filter((neuron) => neuron.subjectId !== subjectId));
      setConnections((current) => current.filter((connection) => connection.subjectId !== subjectId));
      setSelectedSubjectId((current) => (current === subjectId ? null : current));
    } catch (error) {
      setSubjectsError(apiMessage(error, "Không xóa được môn học."));
      throw error;
    }
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

  const createConnection = async (explanation: string) => {
    if (!pendingConnection || !selectedSubject) return;
    void explanation;
    try {
      const created = await createConnectionApi(selectedSubject.id, pendingConnection.source.id, pendingConnection.target.id);
      setConnections((current) => [...current, created]);
      bumpCounts(selectedSubject.id, 0, 1);
      setSelection({ type: "connection", id: created.id });
      setIsConnecting(false);
      setConnectionSourceId(null);
      setPendingConnection(null);
      setNotice(null);
    } catch (error) {
      setNotice(apiMessage(error, "Không tạo được liên kết."));
      throw error;
    }
  };

  const addNeuron = async (draft: Neuron) => {
    if (!selectedSubject) return;
    const created = await createNeuronApi(selectedSubject.id, {
      name: draft.name,
      color: draft.color,
      textContent: draft.textContent,
      keyPoints: draft.keyPoints,
      memoryMethod: draft.memoryMethod,
      application: draft.application,
      positionX: draft.position.x,
      positionY: draft.position.y,
      positionZ: draft.position.z,
    });
    setNeurons((current) => [...current, created]);
    bumpCounts(selectedSubject.id, 1, 0);
    setSelection({ type: "neuron", id: created.id });
  };

  const persistNeuron = async (updated: Neuron) => {
    try {
      const saved = await updateNeuronApi(updated.id, {
        name: updated.name,
        color: updated.color,
        textContent: updated.textContent,
        keyPoints: updated.keyPoints,
        memoryMethod: updated.memoryMethod,
        application: updated.application,
      });
      setNeurons((current) =>
        current.map((neuron) =>
          neuron.id === saved.id ? { ...saved, position: updated.position, images: updated.images, audio: updated.audio } : neuron,
        ),
      );
    } catch (error) {
      setNotice(apiMessage(error, "Không lưu được neuron."));
    }
  };

  const deleteNeuron = async (neuronId: string) => {
    try {
      await deleteNeuronApi(neuronId);
      const removedLinks = connections.filter(
        (connection) => connection.sourceNeuronId === neuronId || connection.targetNeuronId === neuronId,
      ).length;
      setNeurons((current) => current.filter((neuron) => neuron.id !== neuronId));
      setConnections((current) =>
        current.filter((connection) => connection.sourceNeuronId !== neuronId && connection.targetNeuronId !== neuronId),
      );
      if (selectedSubject) bumpCounts(selectedSubject.id, -1, -removedLinks);
      setSelection(null);
      setConnectionSourceId(null);
    } catch (error) {
      setNotice(apiMessage(error, "Không xóa được neuron."));
      throw error;
    }
  };

  const deleteConnection = async (connectionId: string) => {
    try {
      await deleteConnectionApi(connectionId);
      setConnections((current) => current.filter((connection) => connection.id !== connectionId));
      if (selectedSubject) bumpCounts(selectedSubject.id, 0, -1);
      setSelection(null);
    } catch (error) {
      setNotice(apiMessage(error, "Không xóa được liên kết."));
    }
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setSubjects([]);
    setNeurons([]);
    setConnections([]);
    setActiveView("dashboard");
    setSelectedSubjectId(null);
  };

  const renderView = () => {
    if (activeView === "dashboard") {
      return (
        <Dashboard
          subjects={subjects}
          loading={subjectsLoading}
          error={subjectsError}
          onOpenSubject={openSubject}
          onCreateSubject={createSubject}
          onDeleteSubject={removeSubject}
        />
      );
    }
    if (activeView === "settings") return <Settings email={user?.email} onLogout={logout} />;
    if (!selectedSubject) {
      return (
        <Dashboard
          subjects={subjects}
          loading={subjectsLoading}
          error={subjectsError}
          onOpenSubject={openSubject}
          onCreateSubject={createSubject}
          onDeleteSubject={removeSubject}
        />
      );
    }
    return (
      <LearningMap
        subject={selectedSubject}
        neurons={subjectNeurons}
        connections={subjectConnections}
        graphLoading={graphLoading}
        graphError={graphError}
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
        onCreateNeuron={addNeuron}
        onUpdateNeuron={persistNeuron}
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
        onUpdateConnection={() => {
          setNotice("Backend chưa có endpoint cập nhật mô tả liên kết.");
        }}
        onDeleteConnection={deleteConnection}
      />
    );
  };

  const navigate = (view: ViewName) => {
    setActiveView(view);
    if (view !== "map") setMapExpanded(false);
  };

  if (!authReady) {
    return (
      <div className="dashboard-main flex min-h-screen items-center justify-center text-sm text-[#8b9a93]">Đang kiểm tra phiên đăng nhập...</div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900 md:h-screen md:flex-row">
      {!(activeView === "map" && mapExpanded) && <Sidebar activeView={activeView} onNavigate={navigate} />}
      {renderView()}
    </div>
  );
}
