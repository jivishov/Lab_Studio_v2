import { createRequire } from "node:module";
import { resolve } from "node:path";
import { HttpAgsClient } from "./ags/client";
import { loadLearningConfig } from "./config";
import { createLearningHttpServer } from "./http";
import { PostgresLearningStore, type PgQueryable } from "./storage/postgres";

const require = createRequire(import.meta.url);
const configPath = resolve(process.env.CAUSALYST_LEARNING_CONFIG ?? "server/learning/config/learning.local.json");
const databaseUrl = process.env.CAUSALYST_DATABASE_URL;
if (!databaseUrl) throw new Error("CAUSALYST_DATABASE_URL is required.");
const config = await loadLearningConfig(configPath);

type PoolConstructor = new (options: { connectionString: string; max: number; ssl?: { rejectUnauthorized: boolean } }) =>
  PgQueryable & { end(): Promise<void> };
const { Pool } = require("pg") as { Pool: PoolConstructor };
const pool = new Pool({
  connectionString: databaseUrl,
  max: Number(process.env.CAUSALYST_DATABASE_POOL_SIZE ?? 8),
  ...(process.env.CAUSALYST_DATABASE_SSL === "true" ? { ssl: { rejectUnauthorized: true } } : {}),
});

const server = createLearningHttpServer({
  config,
  store: new PostgresLearningStore(pool),
  agsClient: new HttpAgsClient(config),
  log: (record) => process.stdout.write(`${JSON.stringify(record)}\n`),
});
const port = Number(process.env.CAUSALYST_LEARNING_PORT ?? 8791);
server.listen(port, "0.0.0.0", () => {
  process.stdout.write(`Causalyst Learning Integration Service listening on ${port}\n`);
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => void pool.end().finally(() => process.exit(0)));
  });
}
