export type AuthRequestRegistration = {
  epoch: number;
  release: () => void;
};

export type AuthRequestLifecycle = {
  currentEpoch: () => number;
  register: (controller: AbortController) => AuthRequestRegistration;
  isCurrent: (epoch: number) => boolean;
  invalidate: () => number;
};

/**
 * Keeps user-scoped browser work tied to the authentication state that started it.
 * Invalidating the lifecycle aborts every registered request before advancing the
 * epoch, so a late response can neither continue nor commit into the next session.
 */
export function createAuthRequestLifecycle(initialEpoch = 0): AuthRequestLifecycle {
  let epoch = initialEpoch;
  const controllers = new Set<AbortController>();

  return {
    currentEpoch: () => epoch,
    register(controller) {
      const requestEpoch = epoch;
      controllers.add(controller);
      return {
        epoch: requestEpoch,
        release: () => controllers.delete(controller),
      };
    },
    isCurrent: (requestEpoch) => requestEpoch === epoch,
    invalidate() {
      for (const controller of controllers) controller.abort();
      controllers.clear();
      epoch += 1;
      return epoch;
    },
  };
}
