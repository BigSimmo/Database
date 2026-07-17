import fc from "fast-check";

const defaultPropertySeed = 424_242;
const parsedSeed = Number.parseInt(process.env.FAST_CHECK_SEED ?? `${defaultPropertySeed}`, 10);
if (!Number.isSafeInteger(parsedSeed)) {
  throw new Error(`FAST_CHECK_SEED must be a safe integer; received ${process.env.FAST_CHECK_SEED}.`);
}
const propertySeed = ((parsedSeed % 2_147_483_647) + 2_147_483_647) % 2_147_483_647 || defaultPropertySeed;

fc.configureGlobal({ seed: propertySeed, verbose: true });
console.info(`[fast-check] replay seed: ${propertySeed}`);

export { propertySeed };
