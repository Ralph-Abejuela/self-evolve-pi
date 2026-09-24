/** Self-evolving harness extension for pi.
 *
 * Mechanisms (each independently toggleable via /evolve):
 *  - ObservationPack: oversized tool outputs -> L3 disk archive, excerpt + handle in context
 *  - harness_recall: paged recall of archived outputs
 *  - Evidence-preserving reducer: logs -> verified receipts (verbatim quotes)
 *  - BPE cognitive tools: harness_commit / track / note / state, durable entries
 *  - Online context compact: archive+shrink old tool results under window pressure
 *  - Action fusion: chain verification after unverified edits at the turn boundary
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { loadConfig, saveConfig, MECHANISMS, type Mechanism } from "./config.js";
import { L3Store } from "./store.js";
import { registerPack, type Counters } from "./pack.js";
import { registerBpe } from "./bpe.js";
import { registerFusion } from "./fusion.js";
import { registerTelemetry } from "./telemetry.js";

export default function selfEvolve(pi: ExtensionAPI) {
	const cwd = process.cwd();
	const cfgRef = { current: loadConfig(cwd) };
	const store = new L3Store(cwd);
	const counters: Counters = { packedCount: 0, reducedCount: 0, compactedCount: 0, tokensSavedEst: 0 };

	registerPack(pi, () => cfgRef.current, store, counters);
	registerBpe(pi, () => cfgRef.current, store, counters);
	registerFusion(pi, () => cfgRef.current);
	registerTelemetry(pi, cwd, counters, process.env.SE_RUN ?? "manual");

	pi.registerCommand("evolve", {
		description: "Toggle self-evolve harness mechanisms, or show status",
		handler: async (args, ctx) => {
			const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
			const status = () =>
				`self-evolve: pack=${on(cfgRef.current.pack)} reducer=${on(cfgRef.current.reducer)} ` +
				`compact=${on(cfgRef.current.compact)} fusion=${on(cfgRef.current.fusion)} | ` +
				`packed=${counters.packedCount} reduced=${counters.reducedCount} ` +
				`compacted=${counters.compactedCount} savedEst=${counters.tokensSavedEst}`;
			if (parts.length === 0 || parts[0] === "status") {
				ctx.ui.notify(status(), "info");
				return;
			}
			if (parts[0] === "reset") {
				counters.packedCount = 0;
				counters.reducedCount = 0;
				counters.compactedCount = 0;
				counters.tokensSavedEst = 0;
				ctx.ui.notify("counters reset", "info");
				return;
			}
			const mech = parts[0] as Mechanism;
			if (!MECHANISMS.includes(mech)) {
				ctx.ui.notify(`unknown mechanism '${parts[0]}'. Use: ${MECHANISMS.join(", ")}`, "error");
				return;
			}
			const value = parts[1] ? parts[1] === "on" : !cfgRef.current[mech];
			cfgRef.current = { ...cfgRef.current, [mech]: value };
			saveConfig(cwd, cfgRef.current);
			ctx.ui.notify(status(), "info");
		},
	});
}

function on(b: boolean): string {
	return b ? "on" : "off";
}
