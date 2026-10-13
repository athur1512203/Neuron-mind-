const PREFIX = "neuromind_active_note";

export function readActiveNote(neuronId: string) {
  try { return window.localStorage.getItem(`${PREFIX}:${neuronId}`); }
  catch { return null; }
}

export function rememberActiveNote(neuronId: string, noteId: string) {
  try { window.localStorage.setItem(`${PREFIX}:${neuronId}`, noteId); }
  catch { /* The editor still works when storage is unavailable. */ }
}

export function forgetActiveNote(neuronId: string) {
  try { window.localStorage.removeItem(`${PREFIX}:${neuronId}`); }
  catch { /* Ignore unavailable storage. */ }
}
