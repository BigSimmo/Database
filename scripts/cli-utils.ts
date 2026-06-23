import { createInterface } from "node:readline";

/**
 * Prompts the user with a yes/no question and returns their answer.
 * Returns `false` if stdin is not a TTY (e.g. when piped).
 */
export function confirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${question} (y/N) `, (answer: string) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === "y");
    });
  });
}
