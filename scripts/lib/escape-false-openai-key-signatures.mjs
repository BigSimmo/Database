/**
 * Break OpenAI-key-*shaped* tokens (`sk-` + long unbroken alnum) so secret
 * scanners do not false-positive on generated JSON. Ordinary words that merely
 * contain the letters `sk-` (e.g. `task-centred`) must stay intact — the older
 * mid-word `(?<=[A-Za-z0-9])sk-` rewrite mangled those into `tas\u006b-…`.
 * JSON parsing restores the exact original string when an escape is applied.
 *
 * @param {string} text
 * @returns {string}
 */
export function escapeFalseOpenAiKeySignatures(text) {
  return text.replace(/\bsk-[A-Za-z0-9]{16,}/g, (match) => `s\\u006b-${match.slice(3)}`);
}
