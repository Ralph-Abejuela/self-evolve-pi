/** Telemetry: per-run JSONL with provider usage + harness counters.
 *
 * input/output/cacheRead come from the provider (post-transform truth).
 * rawEst = input + tokensSavedEst (what would have gone out without the
 * harness transforms, approximate: cache effects ignored, stated as est).
 */
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { stateDir } from "./config.js";
import type { Counters } from "./pack.js";

export function registerTelemetry(
	pi: ExtensionAPI,
	cwd: string,
	counters: Counters,
	label: string,
): string {
	const dir = stateDir(cwd);
	mkdirSync(dir, { recursive: true });
	const file = join(dir, `telemetry-${label}.jsonl`);

	pi.on("agent_end", async (event) => {
		let input = 0;
		let output = 0;
		let cacheRead = 0;
		for (const m of event.messages as Array<{ usage?: Record<string, number> }>) {
			const u = m?.usage;
			if (!u) continue;
			input += Number(u.input ?? 0);
			output += Number(u.output ?? 0);
			cacheRead += Number(u.cacheRead ?? 0);
		}
		if (input === 0 && output === 0) return undefined;
		const rawEst = input + counters.tokensSavedEst;
		const line = {
			ts: new Date().toISOString(),
			label,
			test: process.env.SE_TEST ?? "",
			input,
			output,
			cacheRead,
			rawEst,
			reductionRatio: rawEst > 0 ? Number((1 - input / rawEst).toFixed(4)) : 0,
			packedCount: counters.packedCount,
			fusionCount: counters.fusionCount,
			bpeCalls: counters.bpeCalls,
			reducedCount: counters.reducedCount,
			compactedCount: counters.compactedCount,
			tokensSavedEst: counters.tokensSavedEst,
		};
		try {
			appendFileSync(file, `${JSON.stringify(line)}\n`);
		} catch {
			// telemetry is best effort
		}
		return undefined;
	});

	return file;
}
