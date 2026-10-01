const STORAGE_PREFIX = "neuromind_onboarding_v1:";
const COMPLETED = "completed";

export function onboardingStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

export function isOnboardingCompleted(userId: string) {
  try {
    return window.localStorage.getItem(onboardingStorageKey(userId)) === COMPLETED;
  } catch {
    return false;
  }
}

export function completeOnboarding(userId: string) {
  try {
    window.localStorage.setItem(onboardingStorageKey(userId), COMPLETED);
  } catch {
    /* Tour can still close if storage is unavailable. */
  }
}
