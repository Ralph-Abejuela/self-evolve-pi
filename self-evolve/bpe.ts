/** BPE slots (Belief, Progress, Experience) + online context compact.
 *
 * Cognitive tools write structured state OUTSIDE the context window
 * (durable session entries). The compact pass runs on the `context` event:
 * under window pressure, old toolResult spans are archived to L3 and
 * replaced by a one-line marker. Originals are never destroyed.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { HarnessConfig } from "./config.js";
import { tok } from "./config.js";
import type { L3Store } from "./store.js";
import { textOf, type Counters } from "./pack.js";

export interface BpeState {
	belief: Record<string, string>;
	progress: string[];
	experience: string[];
}

const ENTRY_TYPE = "self-evolve-bpe";
/** newest tool results always kept raw, whatever the pressure */
const KEEP_RECENT = 3;

export function registerBpe(
	pi: ExtensionAPI,
	getCfg: () => HarnessConfig,
	store: L3Store,
	counters: Counters,
): void {
	let state: BpeState = { belief: {}, progress: [], experience: [] };

	const persist = () => pi.appendEntry(ENTRY_TYPE, state);

	const restore = (ctx: ExtensionContext) => {
		try {
			for (const entry of ctx.sessionManager.getBranch()) {
				if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
					const data = entry.data as BpeState | undefined;
					if (data && typeof data === "object") state = data;
				}
			}
		} catch {
			// fresh session with no entries yet
		}
	};

	pi.on("session_start", async (_event, ctx) => {
		restore(ctx);
		return undefined;
	});

	const summarize = (): string => {
		const parts: string[] = [];
		if (Object.keys(state.belief).length) {
			parts.push(`belief: ${Object.entries(state.belief).map(([k, v]) => `${k}=${v}`).join("; ")}`);
		}
		if (state.progress.length) parts.push(`progress: ${state.progress.slice(-5).join(" -> ")}`);
		if (state.experience.length) parts.push(`experience: ${state.experience.slice(-3).join(" | ")}`);
		return parts.join("\n");
	};

	// harness_state tool: the model reads its BPE slots back without re-deriving them
	pi.registerTool({
		name: "harness_state",
		label: "harness state",
		description:
			"Read your persisted Belief/Progress/Experience slots (commit/track/note history). " +
			"Call this after compaction or when resuming to recover structured state cheaply.",
		parameters: Type.Object({}),
		async execute() {
			return { content: [{ type: "text", text: summarize() || "(empty slots)" }], details: { state } };
		},
	});

	pi.registerTool({
		name: "harness_commit",
		label: "harness commit",
		description:
			"Cognitive action: record a completed subgoal in the Progress slot. " +
			"Call after finishing a coherent step (e.g. 'tests pass for auth module'). " +
			"Completed subgoals become compaction candidates.",
		parameters: Type.Object({
			subgoal: Type.String({ description: "What was completed" }),
		}),
		async execute(_id, params) {
			const p = params as { subgoal: string };
			state.progress.push(p.subgoal);
			counters.bpeCalls++;
			persist();
			return {
				content: [{ type: "text", text: `committed: ${p.subgoal}` }],
				details: { progress: state.progress.length },
			};
		},
	});

	pi.registerTool({
		name: "harness_track",
		label: "harness track",
		description:
			"Cognitive action: store an environment-state estimate or entity mapping in the " +
			"Belief slot (e.g. key='db-port' value='5433'). Cheaper than re-reading files.",
		parameters: Type.Object({
			key: Type.String({ description: "Short key" }),
			value: Type.String({ description: "Value to remember" }),
		}),
		async execute(_id, params) {
			const p = params as { key: string; value: string };
			state.belief[p.key] = p.value;
			counters.bpeCalls++;
			persist();
			return {
				content: [{ type: "text", text: `tracked: ${p.key}=${p.value}` }],
				details: { keys: Object.keys(state.belief).length },
			};
		},
	});

	pi.registerTool({
		name: "harness_note",
		label: "harness note",
		description:
			"Cognitive action: archive a cross-episode lesson or error pattern in the " +
			"Experience slot (e.g. 'this repo's tests need --force-color off').",
		parameters: Type.Object({
			insight: Type.String({ description: "The lesson or pattern" }),
		}),
		async execute(_id, params) {
			const p = params as { insight: string };
			state.experience.push(p.insight);
			counters.bpeCalls++;
			persist();
			return {
				content: [{ type: "text", text: `noted: ${p.insight}` }],
				details: { notes: state.experience.length },
			};
		},
	});

	// Online context compact: under pressure, archive + shrink old tool results.
	pi.on("context", async (event) => {
		const cfg = getCfg();
		if (!cfg.compact) return undefined;
		const msgs = ((event as { messages?: unknown[] }).messages ?? []) as Array<Record<string, unknown>>;
		if (!msgs.length) return undefined;
		let est = 0;
		for (const m of msgs) est += estTokens(m);
		if (est < cfg.pressureTokens) return undefined;

		// collect candidate toolResult message indexes, oldest first
		const idxs: number[] = [];
		for (let i = 0; i < msgs.length; i++) {
			if (isToolResult(msgs[i])) idxs.push(i);
		}
		const droppable = idxs.slice(0, Math.max(0, idxs.length - KEEP_RECENT));
		if (!droppable.length) return undefined;

		const out = msgs.map((m) => ({ ...m }));
		let saved = 0;
		let compacted = 0;
		for (const i of droppable) {
			const m = out[i];
			const content = m.content as Array<{ type: string; text?: string }> | undefined;
			if (!Array.isArray(content)) continue;
			const text = textOf(content);
			const t = tok(text.length);
			if (t < 400) continue; // small results: not worth a compaction event
			const handle = store.write("compacted", text);
			m.content = [
				{
					type: "text",
					text: `[compacted ${handle}: ${t} tok tool result archived; harness_recall(handle, page) to recover]`,
				},
			];
			saved += t - tok(160);
			compacted++;
		}
		if (!compacted) return undefined;
		counters.compactedCount += compacted;
		counters.tokensSavedEst += saved;
		return { messages: out as never };
	});
}

function isToolResult(m: Record<string, unknown>): boolean {
	const role = String(m.role ?? "");
	return role.toLowerCase().includes("toolresult") || role === "tool_result";
}

function estTokens(m: Record<string, unknown>): number {
	const content = m.content;
	if (typeof content === "string") return tok(content.length);
	if (Array.isArray(content)) {
		return tok(textOf(content as Array<{ type: string; text?: string }>).length);
	}
	return 0;
}
