/**
 * The one interactive prompt helper for scripts. `createPrompt` owns the readline
 * lifecycle; `confirm` is the y/N question built on it. Both default to "no" when stdin
 * is not a TTY, so a piped or agent-driven run can never answer a destructive prompt.
 */
import { createInterface } from "node:readline/promises";

/**
 * @param {{ input?: NodeJS.ReadableStream & { isTTY?: boolean }, output?: NodeJS.WritableStream }} [streams]
 * @returns {{ ask: (question: string) => Promise<string>, close: () => void, interactive: boolean }}
 */
export function createPrompt({ input = process.stdin, output = process.stdout } = {}) {
  const readline = createInterface({ input, output });
  return {
    ask: (question) => readline.question(question),
    close: () => readline.close(),
    interactive: Boolean(input.isTTY),
  };
}

/**
 * Ask a yes/no question and resolve to the answer. Resolves `false` without asking when
 * stdin is not a TTY (piped input), and only an exact `y`/`yes` (any case) counts as yes.
 *
 * @param {string} question
 * @param {{ input?: NodeJS.ReadableStream & { isTTY?: boolean }, output?: NodeJS.WritableStream & { write?: (chunk: string) => unknown } }} [streams]
 * @returns {Promise<boolean>}
 */
export async function confirm(question, { input = process.stdin, output = process.stdout } = {}) {
  if (!input.isTTY) {
    output.write("  Non-interactive input detected; defaulting to No.\n");
    return false;
  }
  const prompt = createPrompt({ input, output });
  try {
    const answer = (await prompt.ask(`${question} (y/N) `)).trim().toLowerCase();
    return answer === "y" || answer === "yes";
  } finally {
    prompt.close();
  }
}
