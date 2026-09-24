// Independent re-attribution: every session file in the fixture project dir is exactly one run.
// Classifies each file by its first user message (scenario id) and by harness_* tool calls (extension marker),
// then sums provider usage. No before/after newest-file guessing.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIR = "C:\\Users\\user\\.pi\\agent\\sessions\\--C--Users-user-Documents-Git-Clones-self-evolve-pi-test-fixture--";
const files = readdirSync(DIR).filter((f) => f.endsWith(".jsonl"));

const SCEN = ["test1-nuance", "test2-needle", "test3-json", "test4-contradiction", "test5-code", "triage-mech", "fusion-demo", "mech-demo"];

const rows = [];
for (const f of files) {
	const p = join(DIR, f);
	const st = statSync(p);
	let firstUser = "";
	let harnessCalls = 0;
	let input = 0, output = 0, cacheRead = 0, requests = 0;
	for (const line of readFileSync(p, "utf-8").split("\n")) {
		if (!line.trim()) continue;
		let e;
		try { e = JSON.parse(line); } catch { continue; }
		const msg = e.message ?? e;
		// first user message
		if (!firstUser && msg?.role === "user") {
			const c = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content ?? "");
			firstUser = c;
		}
		if (typeof msg?.content === "string" && msg.content.includes("harness_")) harnessCalls++;
		else if (Array.isArray(msg?.content)) {
			for (const b of msg.content) if (JSON.stringify(b ?? {}).includes("harness_")) harnessCalls++;
		}
		const u = msg?.usage;
		if (u && typeof u.input === "number") { input += u.input; output += u.output ?? 0; cacheRead += u.cacheRead ?? 0; requests++; }
	}
	const scen = SCEN.find((s) => firstUser.includes(`scenario-${s}.txt`)) ?? "UNKNOWN";
	rows.push({ file: f, mtime: st.mtime.toISOString(), scen, ext: harnessCalls > 0, input, output, cacheRead, requests });
}

rows.sort((a, b) => a.mtime.localeCompare(b.mtime));
console.log(`total session files: ${rows.length}\n`);
for (const r of rows) {
	console.log(`${r.mtime}  ${r.scen.padEnd(18)} ${r.ext ? "EXT" : "base"}  req=${String(r.requests).padStart(2)}  in=${String(r.input).padStart(6)}  cache=${String(r.cacheRead).padStart(7)}  out=${String(r.output).padStart(5)}`);
}

// group by (scen, variant)
console.log("\n=== per-cell medians (input = provider uncached; total = input+cacheRead) ===");
const cells = {};
for (const r of rows) {
	if (r.scen === "UNKNOWN") continue;
	const k = `${r.scen}|${r.ext ? "ext" : "base"}`;
	(cells[k] ??= []).push(r);
}
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const [k, rs] of Object.entries(cells)) {
	console.log(`${k.padEnd(26)} n=${rs.length}  med in=${med(rs.map((r) => r.input))}  med in+cache=${med(rs.map((r) => r.input + r.cacheRead))}  sum in=${rs.reduce((s, r) => s + r.input, 0)}  sum in+cache=${rs.reduce((s, r) => s + r.input + r.cacheRead, 0)}`);
}
