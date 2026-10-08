/**
 * Waits for the required CI checks on a commit and exits 0 only if all passed.
 *
 *   pnpm ci:wait            # the current HEAD (must be pushed)
 *   pnpm ci:wait <sha|ref>
 *
 * `main` is protected: a commit reaches it only after these checks pass on
 * the feature branch. The repo is private: the token comes from GITHUB_TOKEN
 * or, failing that, from the credential git already uses to push (Git
 * Credential Manager). It is only sent to api.github.com, never printed.
 */
import { execFileSync } from "node:child_process";

const REQUIRED = ["check", "e2e"] as const;
const INTERVAL_MS = 60_000;
const TIMEOUT_MS = 40 * 60_000;

type CheckRun = {
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
};

function git(...args: string[]) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/** A token for the GitHub API; never logged. */
function githubToken(): string | null {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const output = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never" },
      stdio: ["pipe", "pipe", "ignore"],
    });
    return /^password=(.+)$/m.exec(output)?.[1]?.trim() || null;
  } catch {
    return null;
  }
}

const token = githubToken();

const repo = git("remote", "get-url", "origin")
  .replace(/^.*github\.com[:/]/, "")
  .replace(/\.git$/, "");
const sha = git("rev-parse", process.argv[2] ?? "HEAD");

async function checkRuns(): Promise<CheckRun[]> {
  const res = await fetch(
    `https://api.github.com/repos/${repo}/commits/${sha}/check-runs?per_page=100`,
    {
      headers: {
        accept: "application/vnd.github+json",
        ...(token && { authorization: `Bearer ${token}` }),
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const body = (await res.json()) as { check_runs: CheckRun[] };
  return body.check_runs;
}

async function main() {
  const started = Date.now();
  console.log(`CI ${repo}@${sha.slice(0, 7)}: ${REQUIRED.join(", ")}`);

  for (;;) {
    let runs: CheckRun[] = [];
    try {
      runs = await checkRuns();
    } catch (error) {
      console.log(`  ${(error as Error).message}, retrying`);
    }
    // A re-run adds a new check run with the same name; the API lists newest first.
    const latest = REQUIRED.map((name) => runs.find((r) => r.name === name));
    const failed = latest.filter((r) => r?.status === "completed" && r.conclusion !== "success");
    if (failed.length > 0) {
      for (const r of failed) console.log(`✗ ${r!.name}: ${r!.conclusion} ${r!.html_url}`);
      process.exitCode = 1;
      return;
    }
    if (latest.every((r) => r?.status === "completed")) {
      console.log(`✓ ${REQUIRED.join(" + ")} passed`);
      process.exitCode = 0;
      return;
    }
    if (Date.now() - started > TIMEOUT_MS) {
      console.log("✗ timed out waiting for CI");
      process.exitCode = 1;
      return;
    }
    const state = REQUIRED.map((name, i) => `${name}=${latest[i]?.status ?? "pending"}`);
    console.log(`  ${state.join(" ")}`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

void main();
