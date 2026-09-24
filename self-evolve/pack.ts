/** ObservationPack + evidence reducer + paged recall: the tool_result tier.
 *
 * L1 (active context) keeps an excerpt or a verified receipt; L3 (disk) keeps
 * the raw output, addressable by handle via the harness_recall tool.
 *
 * ponytail: the paper keeps raw text in context for the first 2 provider
 * requests before swapping to the excerpt; we swap immediately since the
 * head/tail excerpt already carries the diagnosis surface. Upgrade path:
 * per-handle view counters.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { HarnessConfig } from "./config.js";
import { tok } from "./config.js";
import type { L3Store } from "./store.js";
import { PAGE_CHARS } from "./store.js";
import { reduceLog } from "./reducer.js";

export interface Counters {
	packedCount: number;
	reducedCount: number;
	compactedCount: number;
	tokensSavedEst: number;
	fusionCount: number;
	bpeCalls: number;
}

export function textOf(content: Array<{ type: string; text?: string }>): string {
	return content
		.filter((c) => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("\n");
}

// ponytail: 'read' is excluded — a single intentional file read is usually the payload
// itself; packing it only adds recall turns (measured on the needle test). Long-horizon
// bloat comes from repeated shell output, which the reducer + pack cover. Re-enable
// via config if a workflow does huge reads.
const ARCHIVED_TOOLS = new Set(["pwsh", "bash", "powershell", "grep", "find", "edit", "write"]);
const SHELL_TOOLS = new Set(["pwsh", "bash", "powershell"]);

export function registerPack(
	pi: ExtensionAPI,
	getCfg: () => HarnessConfig,
	store: L3Store,
	counters: Counters,
): void {
	pi.on("tool_result", async (event) => {
		const cfg = getCfg();
		const toolName = String((event as { toolName?: string }).toolName ?? "");
		if (!ARCHIVED_TOOLS.has(toolName) || event.isError) return undefined;
		const text = textOf(event.content as Array<{ type: string; text?: string }>);
		if (!text) return undefined;
		const t = tok(text.length);

		// reducer first: deterministic filter with verbatim quote validation
		if (cfg.reducer && SHELL_TOOLS.has(toolName)) {
			const red = reduceLog(text);
			if (red) {
				const handle = store.write(toolName, text);
				counters.reducedCount++;
				counters.tokensSavedEst += Math.max(0, t - tok(red.receipt.length));
				return {
					content: [
						{
							type: "text",
							text:
								`${red.receipt}\n` +
								`[This receipt is the COMPLETE failure evidence from the log; act on it directly. ` +
								`Full log archived: ${handle}. Do NOT page the archive with harness_recall unless you ` +
								`specifically need surrounding context for one quoted line.]`,
						},
					],
					details: event.details,
				};
			}
		}

		// pack: oversized output -> excerpt + handle, raw to L3
		if (cfg.pack && t > cfg.packThresholdTokens) {
			const handle = store.write(toolName, text);
			const head = text.slice(0, cfg.excerptChars);
			const tail = text.slice(-cfg.excerptChars);
			const pages = Math.ceil(text.length / PAGE_CHARS);
			counters.packedCount++;
			counters.tokensSavedEst += Math.max(0, t - tok(head.length + tail.length + 200));
			return {
				content: [
					{
						type: "text",
						text:
							`[${handle}] ${t} tok archived to disk. Excerpt (head/tail):\n` +
							`---HEAD---\n${head}\n...[snip ${text.length - 2 * cfg.excerptChars} chars]...\n` +
							`---TAIL---\n${tail}\n---\n` +
							`Answer from the excerpt when it suffices; page selectively with ` +
							`harness_recall("${handle}", page) (0..${pages - 1}, ${PAGE_CHARS} chars each) ` +
							`only for specific missing details.`,
					},
				],
				details: event.details,
			};
		}
		return undefined;
	});

	pi.registerTool({
		name: "harness_recall",
		label: "harness recall",
		description:
			"Read one page of an archived tool output by handle (e.g. 'se://3'). " +
			"Handles appear in '[se://N] ... archived to disk' notices. Pages are 800 chars; start at page 0. " +
			"Page selectively: receipts and excerpts already carry the key evidence.",
		parameters: Type.Object({
			handle: Type.String({ description: "Archive handle, e.g. se://3" }),
			page: Type.Number({ description: "Zero-based page index", minimum: 0 }),
		}),
		async execute(_toolCallId, params) {
			const p = params as { handle: string; page: number };
			const text = store.page(p.handle, p.page);
			if (text === undefined) {
				return {
					content: [{ type: "text", text: `Unknown handle ${p.handle}` }],
					details: { unknown: true },
				};
			}
			const pages = store.pageCount(p.handle);
			return {
				content: [
					{ type: "text", text: `[${p.handle} page ${p.page}/${pages - 1}]\n${text}` },
				],
				details: { handle: p.handle, page: p.page, pages },
			};
		},
	});
}
