/**
 * Decides whether local fixtures may be used. Pure so it can be unit-tested.
 *
 * All three must hold:
 *   dev            — the Astro dev server (import.meta.env.DEV); production
 *                    builds compile this to false and drop the fixture import
 *   not on Netlify — no NETLIFY flag and no CONTEXT (production, deploy-preview,
 *                    branch-deploy or dev contexts all set CONTEXT)
 *   toggle         — REVIEWS_FIXTURE names a known scenario
 */
import { parseFixtureScenario, type FixtureScenario } from "./fixtures.ts";

export interface FixtureGateInput {
  dev: boolean;
  netlifyFlag: string | undefined;
  deployContext: string | undefined;
  toggle: string | undefined | null;
}

export function resolveFixtureScenario(
  input: FixtureGateInput,
): FixtureScenario | null {
  if (!input.dev) return null;
  if (input.netlifyFlag === "true") return null;
  if (input.deployContext !== undefined && input.deployContext !== "")
    return null;
  return parseFixtureScenario(input.toggle);
}
