/**
 * The whole Vitest suite on the schema after the proposed P-12 change
 * (unique (clinic_id, phone) index dropped), in PGlite only: no database
 * outside this process is touched (R2 2d).
 */
import { spawnSync } from "node:child_process";

const result = spawnSync("pnpm", ["exec", "vitest", "run"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, TEST_SCHEMA: "p12-dropped" },
});
process.exit(result.status ?? 1);
