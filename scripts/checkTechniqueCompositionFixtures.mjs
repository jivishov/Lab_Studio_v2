import { runCompositionStaticFixtures } from "../src/data/compositionStaticFixtures.ts";

const results = await runCompositionStaticFixtures();
process.stdout.write(`${JSON.stringify({ ok: true, results }, null, 2)}\n`);
