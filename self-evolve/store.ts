/** L3 tier: disk-backed archive of raw tool outputs, addressed by handle. */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stateDir } from "./config.js";

export const PAGE_CHARS = 800;

export class L3Store {
	private dir: string;
	private counter = 0;

	constructor(cwd: string) {
		this.dir = join(stateDir(cwd), "l3");
		mkdirSync(this.dir, { recursive: true });
		// resume ids after a restart so handles never collide across sessions
		for (const f of existsSync(this.dir) ? readdirSync(this.dir) : []) {
			const n = Number.parseInt(f.replace(".txt", ""), 10);
			if (Number.isFinite(n) && n > this.counter) this.counter = n;
		}
	}

	write(toolName: string, text: string): string {
		const id = ++this.counter;
		const handle = `se://${id}`;
		writeFileSync(join(this.dir, `${id}.txt`), text, "utf-8");
		try {
			appendFileSync(
				join(this.dir, "index.jsonl"),
				`${JSON.stringify({ handle, tool: toolName, bytes: text.length, ts: new Date().toISOString() })}\n`,
			);
		} catch {
			// telemetry is best effort
		}
		return handle;
	}

	pageCount(handle: string): number {
		const file = this.fileOf(handle);
		if (!file) return 0;
		return Math.ceil(readFileSync(file, "utf-8").length / PAGE_CHARS);
	}

	page(handle: string, page: number): string | undefined {
		const file = this.fileOf(handle);
		if (!file) return undefined;
		const text = readFileSync(file, "utf-8");
		return text.slice(page * PAGE_CHARS, (page + 1) * PAGE_CHARS);
	}

	private fileOf(handle: string): string | undefined {
		const id = handle.replace("se://", "");
		if (!/^\d+$/.test(id)) return undefined;
		const file = join(this.dir, `${id}.txt`);
		return existsSync(file) ? file : undefined;
	}
}
