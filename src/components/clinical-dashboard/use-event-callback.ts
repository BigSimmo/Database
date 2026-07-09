"use client";

import { useCallback, useInsertionEffect, useRef } from "react";

/**
 * Returns a callback with a **stable identity** that always invokes the latest
 * version of `handler` (the "useEvent" / event-callback pattern). Use it for
 * event handlers passed to `React.memo`-wrapped children when the handler
 * closes over frequently-changing values (e.g. the composer draft `query`) or
 * calls another render-recreated function: a plain `useCallback` would change
 * identity on every keystroke and defeat the child's memoization, while
 * omitting those deps would risk a stale closure.
 *
 * Constraint: the returned function must only be called from effects or event
 * handlers, never during render (it reads the ref that is synced on commit).
 * All call sites here are DOM/React event handlers, which satisfies this.
 */
export function useEventCallback<Args extends unknown[], Return>(
  handler: (...args: Args) => Return,
): (...args: Args) => Return {
  const handlerRef = useRef(handler);

  // useInsertionEffect runs before layout/passive effects, so the ref is fresh
  // before any effect that might invoke the callback on the same commit.
  useInsertionEffect(() => {
    handlerRef.current = handler;
  });

  return useCallback((...args: Args) => handlerRef.current(...args), []);
}
