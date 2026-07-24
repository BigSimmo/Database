/**
 * Triggers a haptic vibration on supported devices.
 * Respects user OS preference for reduced motion.
 * @param pattern Duration or array of durations in milliseconds.
 */
export function triggerHaptic(pattern: number | number[] = 10) {
  if (typeof window !== "undefined" && "vibrate" in navigator) {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore failures in environments that restrict vibration
      }
    }
  }
}
