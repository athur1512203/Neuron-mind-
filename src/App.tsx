import { useEffect, useMemo, useRef, useState } from "react";
import { getMe } from "./api/auth";
import { apiMessage, clearToken, getToken, setUnauthorizedHandler } from "./api/client";
import { createConnection as createConnectionApi, deleteConnection as deleteConnectionApi } from "./api/connections";
import { createNeuron as createNeuronApi, deleteNeuron as deleteNeuronApi, updateNeuron as updateNeuronApi } from "./api/neurons";
import type { SearchResult } from "./api/search";
import { createSubject as createSubjectApi, deleteSubject as deleteSubjectApi, getSubjectGraph, listSubjects } from "./api/subjects";
import type { ApiUser } from "./api/mappers";
import { AuthScreen } from "./components/AuthScreen";
import { CreateSubjectModal } from "./components/CreateSubjectModal";
import { LearningMap } from "./components/LearningMap";
import { GlobalSearchPalette } from "./components/GlobalSearchPalette";
import type { DetailTab } from "./components/NeuronDetailPanel";
import { Settings } from "./components/Settings";
import { Sidebar } from "./components/Sidebar";
import { WorkspaceEmpty } from "./components/WorkspaceEmpty";
import type { Neuron, NeuronConnection, Position3D, Selection, Subject, ViewName } from "./types";
import { areSameConnection } from "./utils/neuron";
import { clearNavigation, readNavigation, restoreNavigation, saveNavigation } from "./utils/navigation";
import { isOnboardingCompleted } from "./utils/onboarding";
import { OnboardingTour } from "./components/onboarding/OnboardingTour";

export default function App() {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeView, setActiveView] = useState<ViewName>("map");
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
  const [pendingNeuronSelection, setPendingNeuronSelection] = useState<{ neuronId: string; tab: DetailTab } | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<DetailTab>("overview");
  const [searchOpen, setSearchOpen] = useState(false);
  const [spaceModalOpen, setSpaceModalOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [navigationUserId, setNavigationUserId] = useState<string | null>(null);
  const sessionVersion = useRef(0);
  const restoredGraph = useRef<string | null>(null);
  const persistableViewRef = useRef<ViewName>("map");
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = user?.id ?? null;

  const resetSession = () => {
    sessionVersion.current++;
    clearNavigation(userIdRef.current);
    setUser(null);
    setNavigationUserId(null);
    setSubjects([]);
    setNeurons([]);
    setConnections([]);
    setActiveView("map");
    setSelectedSubjectId(null);
    setSelection(null);
    setPendingNeuronSelection(null);
    setSearchOpen(false);
    setMapExpanded(false);
    setNotice(null);
    setOnboardingOpen(false);
    restoredGraph.current = null;
  };

  useEffect(() => {
    let cancelled = false;
    setUnauthorizedHandler(resetSession);
    const token = getToken();
    if (!token) {
      clearNavigation(userIdRef.current);
      setAuthReady(true);
      return () => { cancelled = true; setUnauthorizedHandler(null); };
    }
    getMe()
      .then((next) => { if (!cancelled) setUser(next); })
      .catch(() => {
        if (cancelled) return;
        clearToken();
        resetSession();
      })
      .finally(() => { if (!cancelled) setAuthReady(true); });
    return () => { cancelled = true; setUnauthorizedHandler(null); };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const version = sessionVersion.current;
    const current = () => !cancelled && version === sessionVersion.current;
    setNavigationUserId(null);
    setSubjectsLoading(true);
    setSubjectsError(null);
    listSubjects()
      .then(async (next) => {
        if (!current()) return;
        const restored = await restoreNavigation(readNavigation(user.id), next, getSubjectGraph);
        if (!current()) return;
        let navigation = restored.navigation;
        let graph = restored.graph;
        if (navigation.activeView === "dashboard" || navigation.activeView === "searchCoreTest") {
          const spaceId =
            (navigation.selectedSubjectId && next.some((subject) => subject.id === navigation.selectedSubjectId)
              ? navigation.selectedSubjectId
              : next[0]?.id) ?? null;
          navigation = {
            activeView: "map",
            selectedSubjectId: spaceId,
            selectedNeuronId: spaceId ? navigation.selectedNeuronId : null,
          };
          if (spaceId && !graph) {
            try {
              graph = await getSubjectGraph(spaceId);
              const neuronExists = Boolean(
                navigation.selectedNeuronId &&
                  graph.neurons.some((neuron) => neuron.id === navigation.selectedNeuronId),
              );
              navigation = { ...navigation, selectedNeuronId: neuronExists ? navigation.selectedNeuronId : null };
            } catch {
              graph = undefined;
              navigation = { ...navigation, selectedNeuronId: null };
            }
          }
        }
        setSubjects(next);
        setSelectedSubjectId(navigation.selectedSubjectId);
        if (graph) {
          setNeurons(graph.neurons);
          setConnections(graph.connections);
          restoredGraph.current = graph.subject.id;
        } else {
          setNeurons([]);
          setConnections([]);
          restoredGraph.current = null;
        }
        if (navigation.selectedNeuronId) {
          setDetailInitialTab("overview");
          setSelection({ type: "neuron", id: navigation.selectedNeuronId });
        } else {
          setSelection(null);
          setPendingNeuronSelection(null);
        }
        setActiveView(navigation.activeView);
        saveNavigation(user.id, navigation);
      })
      .catch((error) => {
        if (!current()) return;
        setSubjects([]);
        setSelectedSubjectId(null);
        setSubjectsError(apiMessage(error, "Không tải được danh sách môn học."));
      })
      .finally(() => {
        if (!current()) return;
        setSubjectsLoading(false);
        setNavigationUserId(user.id);
      });
    return () => { cancelled = true; };
  }, [user]);

  const selectedNeuronId = pendingNeuronSelection?.neuronId ?? (selection?.type === "neuron" ? selection.id : null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    persistableViewRef.current = activeView === "searchCoreTest" ? persistableViewRef.current : activeView;
  }, [activeView]);
  useEffect(() => {
    if (!user || navigationUserId !== user.id) return;
    const persistView = activeView === "searchCoreTest" ? persistableViewRef.current : activeView;
    saveNavigation(user.id, { activeView: persistView, selectedSubjectId, selectedNeuronId });
  }, [user, navigationUserId, activeView, selectedSubjectId, selectedNeuronId]);

  useEffect(() => {
    if (!user || navigationUserId !== user.id) return;
    if (isOnboardingCompleted(user.id)) return;
    setActiveView("map");
    setMapExpanded(false);
    setSidebarOpen(true);
    setSearchOpen(false);
    setOnboardingOpen(true);
  }, [user, navigationUserId]);

  useEffect(() => {
    if (!user || navigationUserId !== user.id || (activeView !== "map" && activeView !== "connections") || !selectedSubjectId) return;
    if (restoredGraph.current === selectedSubjectId) {
      restoredGraph.current = null;
      setGraphLoading(false);
      setGraphError(null);
      return;
    }
    let cancelled = false;
    const version = sessionVersion.current;
    setGraphLoading(true);
    setGraphError(null);
    getSubjectGraph(selectedSubjectId)
      .then((graph) => {
        if (cancelled || version !== sessionVersion.current) return;
        setNeurons(graph.neurons);
        setConnections(graph.connections);
      })
      .catch((error) => {
        if (cancelled || version !== sessionVersion.current) return;
        setNeurons([]);
        setConnections([]);
        setGraphError(apiMessage(error, "Không tải được sơ đồ học."));
      })
      .finally(() => {
        if (!cancelled && version === sessionVersion.current) setGraphLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, navigationUserId, activeView, selectedSubjectId]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "k") return;
      event.preventDefault();
      setSearchOpen(true);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? subjects[0],
    [subjects, selectedSubjectId],
  );

  const subjectNeurons = selectedSubject ? neurons.filter((neuron) => neuron.subjectId === selectedSubject.id) : [];
  const subjectConnections = selectedSubject
    ? connections.filter((connection) => connection.subjectId === selectedSubject.id)
    : [];

  useEffect(() => {
    if (!pendingNeuronSelection || graphLoading) return;
    const exists = subjectNeurons.some((neuron) => neuron.id === pendingNeuronSelection.neuronId);
    if (!exists) return;
    setDetailInitialTab(pendingNeuronSelection.tab);
    setSelection({ type: "neuron", id: pendingNeuronSelection.neuronId });
    setPendingNeuronSelection(null);
  }, [graphLoading, pendingNeuronSelection, subjectNeurons]);

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

  const createSubject = async (payload: { name: string; color: string }) => {
    const subject = await createSubjectApi({ name: payload.name, color: payload.color });
    setSubjects((current) => [subject, ...current]);
    setSelectedSubjectId(subject.id);
    setActiveView("map");
    setSelection(null);
    setPendingNeuronSelection(null);
  };

  const removeSubject = async (subjectId: string) => {
    try {
      await deleteSubjectApi(subjectId);
      setSubjects((current) => current.filter((subject) => subject.id !== subjectId));
      setNeurons((current) => current.filter((neuron) => neuron.subjectId !== subjectId));
      setConnections((current) => current.filter((connection) => connection.subjectId !== subjectId));
      if (selectedSubjectId === subjectId) {
        const remaining = subjects.filter((subject) => subject.id !== subjectId);
        setSelectedSubjectId(remaining[0]?.id ?? null);
        setActiveView("map");
        setSelection(null);
        setPendingNeuronSelection(null);
      }
    } catch (error) {
      setSubjectsError(apiMessage(error, "Không xóa được môn học."));
      throw error;
    }
  };

  const openNeuron = (subjectId: string, neuronId: string, tab: DetailTab = "overview") => {
    setSelectedSubjectId(subjectId);
    setActiveView("map");
    setMapExpanded(false);
    setSelection(null);
    setDetailInitialTab(tab);
    setPendingNeuronSelection({ neuronId, tab });
    setNotice(null);
  };

  const openSearchResult = (result: SearchResult) => {
    if (!result.subjectId || !result.neuronId) return;
    const tab: DetailTab =
      result.type === "markdown" ? "markdown" : result.type === "document" ? "documents" : "overview";
    openNeuron(result.subjectId, result.neuronId, tab);
  };

  const openSubject = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    setActiveView("map");
    setMapExpanded(false);
    setSelection(null);
    setPendingNeuronSelection(null);
    setDetailInitialTab("overview");
    setNotice(null);
  };

  const selectNeuron = (neuronId: string) => {
    setPendingNeuronSelection(null);
    if (!neuronId) {
      setSelection(null);
      return;
    }

    setMapExpanded(false);
    setSelection({ type: "neuron", id: neuronId });
    setNotice(null);
  };

  const createConnection = async (sourceId: string, targetId: string) => {
    if (!selectedSubject || sourceId === targetId) return;
    const duplicate = subjectConnections.some((connection) =>
      areSameConnection(sourceId, targetId, connection.sourceNeuronId, connection.targetNeuronId),
    );
    if (duplicate) {
      setNotice("Neuron này đã được liên kết.");
      return;
    }
    try {
      const created = await createConnectionApi(selectedSubject.id, sourceId, targetId);
      setConnections((current) => [...current, created]);
      bumpCounts(selectedSubject.id, 0, 1);
      setNotice("Đã tạo liên kết");
    } catch (error) {
      setNotice(apiMessage(error, "Không tạo được liên kết."));
    }
  };

  const addNeuron = async (draft: Neuron) => {
    if (!selectedSubject) throw new Error("Chưa chọn không gian.");
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
    return created;
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
          neuron.id === saved.id ? { ...saved, position: updated.position } : neuron,
        ),
      );
    } catch (error) {
      setNotice(apiMessage(error, "Không lưu được neuron."));
    }
  };

  const persistLayout = (positions: Record<string, Position3D>) => {
    const changed = neurons.filter((neuron) => {
      const next = positions[neuron.id];
      return next && (
        Math.abs(next.x - neuron.position.x) > 0.01 ||
        Math.abs(next.y - neuron.position.y) > 0.01 ||
        Math.abs(next.z - neuron.position.z) > 0.01
      );
    });
    if (!changed.length) return;

    setNeurons((current) =>
      current.map((neuron) => (positions[neuron.id] ? { ...neuron, position: positions[neuron.id] } : neuron)),
    );

    void Promise.all(
      changed.map((neuron) => {
        const position = positions[neuron.id];
        return updateNeuronApi(neuron.id, {
          positionX: position.x,
          positionY: position.y,
          positionZ: position.z,
        });
      }),
    ).catch((error) => setNotice(apiMessage(error, "Không lưu được bố cục neuron.")));
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
    } catch (error) {
      setNotice(apiMessage(error, "Không xóa được liên kết."));
      throw error;
    }
  };

  const logout = () => {
    clearToken();
    resetSession();
  };

  const renderView = () => {
    if (activeView === "settings") {
      return (
        <Settings
          email={user?.email}
          onLogout={logout}
          onReplayOnboarding={() => {
            setActiveView("map");
            setMapExpanded(false);
            setSidebarOpen(true);
            setSearchOpen(false);
            setOnboardingOpen(true);
          }}
        />
      );
    }
    if (!selectedSubject) {
      return (
        <WorkspaceEmpty
          loading={subjectsLoading}
          error={subjectsError}
          onCreateSpace={() => setSpaceModalOpen(true)}
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
        detailInitialTab={detailInitialTab}
        mapExpanded={mapExpanded}
        onToggleMapExpanded={() => setMapExpanded((value) => !value)}
        selection={selection}
        notice={notice}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onSelectNeuron={selectNeuron}
        onSelectConnection={(connectionId) => {
          if (!connectionId) return;
          setSelection({ type: "connection", id: connectionId });
        }}
        onLayoutSettled={persistLayout}
        onCreateNeuron={addNeuron}
        onCreateConnection={createConnection}
        onUpdateNeuron={persistNeuron}
        onDeleteNeuron={deleteNeuron}
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
    if (view !== "map" && view !== "connections" && view !== "searchCoreTest") {
      setSelection(null);
      setPendingNeuronSelection(null);
    }
  };

  if (!authReady || (user && navigationUserId !== user.id)) {
    return (
      <div className="nm-auth-page nm-auth-loading">Đang kiểm tra phiên đăng nhập...</div>
    );
  }

  if (!user) {
    return <AuthScreen onAuthenticated={setUser} />;
  }

  return (
    <div className="nm-shell">
      {!(activeView === "map" && mapExpanded && !selectedNeuronId) ? (
        <Sidebar
          activeView={activeView}
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          userLabel={user.email}
          open={sidebarOpen}
          onNavigate={navigate}
          onSearch={() => setSearchOpen(true)}
          onSelectSpace={openSubject}
          onCreateSubject={createSubject}
          onLogout={logout}
        />
      ) : null}
      {renderView()}
      <GlobalSearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} onOpenResult={openSearchResult} />
      {onboardingOpen ? (
        <OnboardingTour
          userId={user.id}
          open={onboardingOpen}
          hasNeurons={subjectNeurons.length > 0}
          onClose={() => setOnboardingOpen(false)}
        />
      ) : null}
      {spaceModalOpen ? (
        <CreateSubjectModal
          onClose={() => setSpaceModalOpen(false)}
          onCreate={async (payload) => {
            await createSubject(payload);
            setSpaceModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
