import type { Neuron, NeuronConnection, Subject, ViewName } from "../types";

export const NAVIGATION_KEY = "neuromind_navigation";

export type NavigationState = {
  activeView: ViewName;
  selectedSubjectId: string | null;
  selectedNeuronId: string | null;
};

export const dashboardNavigation: NavigationState = {
  activeView: "dashboard",
  selectedSubjectId: null,
  selectedNeuronId: null,
};

function storageKey(userId: string) {
  return `${NAVIGATION_KEY}:${userId}`;
}

function validId(id: unknown): id is string | null {
  return id === null || (typeof id === "string" && id.trim().length > 0);
}

export function clearNavigation(userId?: string | null) {
  try {
    if (userId) {
      localStorage.removeItem(storageKey(userId));
      return;
    }
    localStorage.removeItem(NAVIGATION_KEY);
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(`${NAVIGATION_KEY}:`)) localStorage.removeItem(key);
    }
  } catch {
    /* Storage can be disabled. */
  }
}

export function readNavigation(userId: string): NavigationState {
  try {
    const raw = localStorage.getItem(storageKey(userId)) ?? localStorage.getItem(NAVIGATION_KEY);
    const saved = JSON.parse(raw ?? "null") as Record<string, unknown> | null;
    if (!saved || (saved.userId != null && saved.userId !== userId)) {
      return { ...dashboardNavigation };
    }
    if (
      !["dashboard", "map", "connections", "settings"].includes(String(saved.activeView)) ||
      !validId(saved.selectedSubjectId) ||
      !validId(saved.selectedNeuronId)
    ) {
      return { ...dashboardNavigation };
    }
    return {
      activeView: saved.activeView as ViewName,
      selectedSubjectId: saved.selectedSubjectId as string | null,
      selectedNeuronId: saved.selectedNeuronId as string | null,
    };
  } catch {
    return { ...dashboardNavigation };
  }
}

export function saveNavigation(userId: string, state: NavigationState) {
  const graphView = state.activeView === "map" || state.activeView === "connections";
  try {
    localStorage.removeItem(NAVIGATION_KEY);
    localStorage.setItem(storageKey(userId), JSON.stringify({
      userId,
      activeView: state.activeView,
      selectedSubjectId: graphView ? state.selectedSubjectId : null,
      selectedNeuronId: graphView ? state.selectedNeuronId : null,
    }));
  } catch {
    /* Navigation must still work without localStorage. */
  }
}

type Graph = { subject: Subject; neurons: Neuron[]; connections: NeuronConnection[] };

export async function restoreNavigation(
  saved: NavigationState,
  subjects: Subject[],
  loadGraph: (subjectId: string) => Promise<Graph>,
): Promise<{ navigation: NavigationState; graph?: Graph }> {
  if (saved.activeView === "dashboard" || saved.activeView === "settings") {
    return { navigation: { ...dashboardNavigation, activeView: saved.activeView } };
  }
  if (!saved.selectedSubjectId || !subjects.some((subject) => subject.id === saved.selectedSubjectId)) {
    return { navigation: { ...dashboardNavigation } };
  }
  try {
    const graph = await loadGraph(saved.selectedSubjectId);
    if (graph.subject.id !== saved.selectedSubjectId) {
      return { navigation: { ...dashboardNavigation } };
    }
    const neuronExists = Boolean(
      saved.selectedNeuronId &&
        graph.neurons.some((neuron) => neuron.id === saved.selectedNeuronId && neuron.subjectId === graph.subject.id),
    );
    return {
      navigation: { ...saved, selectedNeuronId: neuronExists ? saved.selectedNeuronId : null },
      graph,
    };
  } catch {
    return { navigation: { ...dashboardNavigation } };
  }
}
