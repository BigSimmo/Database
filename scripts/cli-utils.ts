/**
 * Prompts the user with a yes/no question and returns their answer.
 * Returns `false` if stdin is not a TTY (e.g. when piped).
 *
 * The implementation lives in scripts/lib/confirm.mjs so every script — TypeScript or
 * plain module — shares one prompt helper; this re-export keeps existing imports working.
 */
export { confirm, createPrompt } from "./lib/confirm.mjs";
