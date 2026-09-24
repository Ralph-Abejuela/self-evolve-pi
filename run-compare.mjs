// Comparison runner: baseline pi (-ns -ne -nc) vs pi + self-evolve extension.
// Logs per-run tokens and correctness, prints a summary table.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync, rmSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = "C:\\Users\\user\\Documents\\Git-Clones\\self-evolve-pi";
const FIXTURE = join(ROOT, "test-fixture");
const SESSIONS = "C:\\Users\\user\\.pi\\agent\\sessions";
const EXT = join(ROOT, "self-evolve", "index.ts");
// pi runs with cwd=test-fixture, so its sessions land in a project dir that includes the fixture name
const PROJ_DIR_MATCH = (d) => d.includes("self-evolve-pi") && d.includes("test-fixture");

function buildNeedle(blocks = 120, at = 0.5) {
	const needlePos = Math.floor(blocks * at);
	const b = [];
	for (let i = 0; i < blocks; i++) {
		if (i === 12) b.push(`Manifest entry ${String(i).padStart(4, "0")}: unit HVAC-North-4; decommissioned override code TR-1100-OMEGA (REVOKED 2019; must never be used).`);
		else if (i === needlePos) b.push(`Manifest entry ${String(i).padStart(4, "0")}: technician note: "current field override code is QZ-8842-KILO; supersedes all prior codes; do NOT log this code in the ticketing system per policy 12-C."`);
		else if (i === blocks - 12) b.push(`Manifest entry ${String(i).padStart(4, "0")}: archived override code QZ-8841-KILO (SUPERSEDED; do not use under any circumstances).`);
		else b.push(`Manifest entry ${String(i).padStart(4, "0")}: unit PUMP-${i % 37}-Bay${i % 9}; quarterly inspection nominal; torque spec 18 N·m; next service due Q3.`);
	}
	return readFileSync(join(FIXTURE, "needle-prompt.txt"), "utf-8").replace("@@BODY@@", b.join("\n"));
}

const SCENARIOS = [
	{
		id: "triage-small",
		prompt: "Run: node test-fixture/emit-log.js — then tell me exactly which test specs failed and with what error. Reply in one line.",
		check: (a) => ["test_auth.spec", "quota_refresh", "test_billing.spec", "reading 'plan'"].every((s) => a.includes(s)),
	},
	{
		id: "triage-big",
		prompt: "Run: node test-fixture/emit-log-big.js — then tell me exactly which test specs failed and with what error. Reply in one line.",
		check: (a) => ["test_auth.spec", "test_billing.spec", "test_inventory.spec", "test_shipping.spec", "test_audit.spec", "ledger is not defined"].every((s) => a.includes(s)),
	},
	{
		id: "needle",
		prompt: buildNeedle(),
		check: (a) => a.includes("QZ-8842-KILO") && a.includes("12-C") && !/current field override code is QZ-8841/.test(a),
	},
];

function newestSession() {
	const dirs = readdirSync(SESSIONS).filter(PROJ_DIR_MATCH).map((d) => join(SESSIONS, d));
	const files = dirs.flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => join(dir, f)));
	files.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
	return files[0] ?? null;
}

function tokensFromSession(file) {
	if (!file || !existsSync(file)) return null;
	let input = 0, output = 0;
	for (const line of readFileSync(file, "utf-8").split("\n")) {
		if (!line.includes('"usage"')) continue;
		try {
			const e = JSON.parse(line);
			const msg = e.message ?? e;
			const u = msg.usage;
			if (u && typeof u.input === "number") { input += u.input; output += u.output ?? 0; }
		} catch { /* skip */ }
	}
	return { input, output };
}

function telemetryTokens(label) {
	// the extension resolves state against its own process.cwd(), which is the fixture dir
	const f = join(FIXTURE, ".self-evolve", `telemetry-${label}.jsonl`);
	if (!existsSync(f)) return null;
	let input = 0, output = 0, rawEst = 0, saved = 0;
	for (const line of readFileSync(f, "utf-8").split("\n")) {
		if (!line.trim()) continue;
		const e = JSON.parse(line);
		input += e.input; output += e.output; rawEst += e.rawEst; saved += e.tokensSavedEst;
	}
	return { input, output, rawEst, saved };
}

function runPi(args, label) {
	// pi is pi.cmd on Windows: shell:true is required; quote each arg manually
	const r = spawnSync("pi", args.map((a) => `"${String(a).replace(/"/g, '\"')}"`), {
		cwd: FIXTURE, encoding: "utf-8", timeout: 900000, shell: true,
		env: { ...process.env, SE_RUN: label, SE_TEST: label },
	});
	if (r.error || r.status !== 0) console.error(`pi ${label} failed: ${r.error?.message ?? r.stderr?.slice(0, 300)}`);
	return r.stdout ?? "";
}

const RUNS_PER_CELL = Number(process.env.N_RUNS ?? 5);
const rows = [];
const results = { runs: [], runsPerCell: RUNS_PER_CELL };

for (let rep = 1; rep <= RUNS_PER_CELL; rep++) {
for (const sc of SCENARIOS) {
	// hand every scenario to pi through a file: avoids CLI quoting limits,
	// and both variants read it the same way
	const scenarioFile = join(FIXTURE, `scenario-${sc.id}.txt`);
	writeFileSync(scenarioFile, sc.prompt, "utf-8");
	const taskPrompt = `Read the file scenario-${sc.id}.txt in this directory and follow its instructions exactly. Reply with the final answer only.`;
	for (const variant of ["baseline", "extension"]) {
		const before = newestSession();
		const label = `${variant}-${sc.id}-r${rep}`;
		const args = variant === "baseline"
			? ["-ns", "-ne", "-nc", "-p", taskPrompt]
			: ["-ns", "-nc", "--extension", EXT, "-p", taskPrompt];
		const answer = runPi(args, label);
		const ok = sc.check(answer);
		let m;
		if (variant === "baseline") {
			const after = newestSession();
			const file = after && after !== before ? after : before; // session written at end
			m = tokensFromSession(file);
			if (m) m = { ...m, rawEst: m.input, saved: 0 };
		} else {
			m = telemetryTokens(label);
		}
		rows.push({ scenario: sc.id, variant, ok, ...(m ?? { input: NaN, output: NaN, rawEst: NaN, saved: NaN }) });
		results.runs.push({ scenario: sc.id, rep, variant, ok, answer: answer.slice(0, 400) });
		console.log(`r${rep} ${sc.id} ${variant}: ok=${ok} input=${m?.input ?? "?"} rawEst=${m?.rawEst ?? "?"} saved=${m?.saved ?? "?"}`);
	}
}
}

// aggregate: per scenario, median input + solved rate per variant
console.log("\n=== PER-SCENARIO (median over reps) ===");
for (const sc of SCENARIOS) {
	for (const variant of ["baseline", "extension"]) {
		const rs = rows.filter((r) => r.scenario === sc.id && r.variant === variant && Number.isFinite(r.input));
		const inputs = rs.map((r) => r.input).sort((a, b) => a - b);
		const med = inputs.length ? inputs[Math.floor(inputs.length / 2)] : NaN;
		const okN = rs.filter((r) => r.ok).length;
		console.log(`${sc.id} ${variant}: solved ${okN}/${rs.length}, median input ${med.toLocaleString()}`);
	}
}

// summary
const agg = {};
for (const r of rows) {
	agg[r.variant] ??= { input: 0, ok: 0, n: 0 };
	agg[r.variant].input += r.input || 0;
	agg[r.variant].ok += r.ok ? 1 : 0;
	agg[r.variant].n++;
}
console.log("\n=== SUMMARY ===");
for (const [v, a] of Object.entries(agg)) console.log(`${v}: solved ${a.ok}/${a.n}, total input tokens ${a.input.toLocaleString()}`);
const red = agg.baseline.input ? 1 - agg.extension.input / agg.baseline.input : NaN;
console.log(`input token reduction: ${(red * 100).toFixed(1)}%`);

mkdirSync(join(ROOT, "results"), { recursive: true });
writeFileSync(join(ROOT, "results", "compare.json"), JSON.stringify(results, null, 2));
console.log("results written to results/compare.json");
