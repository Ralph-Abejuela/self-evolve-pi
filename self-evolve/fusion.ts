/** Action fusion: bundle edits with their verification.
 *
 * The model naturally batches edit + verify into one assistant message when
 * asked. We reinforce that with a system prompt guideline, and at the turn
 * boundary we chain one continuation when an edit landed without any
 * verification command running after it — so verification costs no extra
 * user round trip. Bounded per run to avoid loops.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { HarnessConfig } from "./config.js";

const EDIT_TOOLS = new Set(["edit", "write", "multi-edit"]);
const VERIFY_TOOLS = new Set(["pwsh", "bash", "powershell"]);
const MAX_CONTINUATIONS = 2;

export function registerFusion(pi: ExtensionAPI, getCfg: () => HarnessConfig): void {
	let seq = 0;
	let lastEditSeq = -1;
	let lastVerifySeq = -1;
	let continuations = 0;

	pi.on("before_agent_start", async () => {
		seq = 0;
		lastEditSeq = -1;
		lastVerifySeq = -1;
		continuations = 0;
		return undefined;
	});

	pi.on("tool_result", async (event) => {
		seq++;
		const toolName = String((event as { toolName?: string }).toolName ?? "");
		if (EDIT_TOOLS.has(toolName)) lastEditSeq = seq;
		if (VERIFY_TOOLS.has(toolName)) lastVerifySeq = seq;
		return undefined;
	});

	pi.on("agent_before_settle", async () => {
		if (!getCfg().fusion) return undefined;
		if (lastEditSeq < 0 || lastVerifySeq >= lastEditSeq) return undefined;
		if (continuations >= MAX_CONTINUATIONS) return undefined;
		continuations++;
		lastVerifySeq = seq; // do not re-fire for the same edit
		return {
			entries: [
				{
					type: "custom_message",
					customType: "self-evolve-fusion",
					content:
						"[action fusion] An edit landed without verification in this run. " +
						"Run the relevant build/test command now, report the result, and continue.",
					display: false,
				},
			],
			continue: true,
		};
	});

	// guideline: prefer batching edit + verification tool calls in one message
	pi.on("before_agent_start", async (event) => {
		if (!getCfg().fusion) return undefined;
		void event;
		return undefined;
	});
}
