import fc from "fast-check";

const defaultPropertySeed = 424_242;
export function parsePropertySeed(rawSeed = `${defaultPropertySeed}`) {
  const parsedSeed = Number(rawSeed);
  if (!/^[+-]?\d+$/.test(rawSeed) || !Number.isSafeInteger(parsedSeed)) {
    throw new Error(`FAST_CHECK_SEED must be a safe integer; received ${rawSeed}.`);
  }
  return parsedSeed;
}
const parsedSeed = parsePropertySeed(process.env.FAST_CHECK_SEED);
const propertySeed = ((parsedSeed % 2_147_483_647) + 2_147_483_647) % 2_147_483_647 || defaultPropertySeed;

fc.configureGlobal({ seed: propertySeed, verbose: true });
console.info(`[fast-check] replay seed: ${propertySeed}`);

export { propertySeed };
