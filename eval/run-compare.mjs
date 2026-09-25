// Comparison runner v2: default pi (-ns, global extensions on — the realistic floor)
// vs pi + self-evolve extension. Both variants measured IDENTICALLY from their own
// session files (provider-reported usage: input, output, cacheRead summed per request).
// v1 defects fixed here:
//  - baseline was `pi -ns -ne -nc` (stripped pi, 2.8k floor) while extension runs carry
//    the ~20.6k global-extension floor => unfair by construction. Baseline is now `pi -ns`.
//  - stale newest-session attribution (tiny 135..661 inputs) — sessions are written per
//    run and runs are sequential, so newest-after-run IS this run's file for both variants.
//  - triage fixture was consumed by the first rep (markers removed) — now reset per rep.
//  - triage prompt paths were wrong for the runner cwd (fixture dir).
// rawEst (telemetry) is labeled an ESTIMATE and is not the headline metric.
import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, writeFileSync, mkdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const REPO = join(import.meta.dirname, "..");
const FIXTURE = join(REPO, "test-fixture");
// ponytail: derive the pi session dir slug from the fixture path; override with PI_SESSIONS_DIR if pi changes its slug scheme
const slug = (p) => `--${p.replace(/[^A-Za-z0-9-]/g, "-")}--`;
const SESSIONS = process.env.PI_SESSIONS_DIR ?? join(homedir(), ".pi", "agent", "sessions", slug(FIXTURE));
const EXT = join(REPO, "self-evolve", "index.ts");

const AUTH_BROKEN = `// Quota refresh logic.
function refreshToken(user) {
	// TODO-BUG: not implemented
	return { ok: false, reason: "quota_refresh not granted" };
}
module.exports = { refreshToken };
`;
const BILLING_BROKEN = `// Plan resolution.
function resolvePlan(account) {
	// TODO-BUG: not implemented
	return undefined;
}
module.exports = { resolvePlan };
`;

// ---- Test 2 generator, parameters exactly per harness-test.txt (200 blocks, needle at 0.5) ----
function makeNeedle(targetBlocks = 200, needleAt = 0.5) {
	const needlePos = Math.floor(targetBlocks * needleAt);
	const blocks = [];
	for (let i = 0; i < targetBlocks; i++) {
		if (i === 20) {
			blocks.push(`Manifest entry ${String(i).padStart(4, "0")}: unit HVAC-North-4; decommissioned override code TR-1100-OMEGA (REVOKED 2019; must never be used).`);
		} else if (i === needlePos) {
			blocks.push(`Manifest entry ${String(i).padStart(4, "0")}: technician note: "current field override code is QZ-8842-KILO; supersedes all prior codes; do NOT log this code in the ticketing system per policy 12-C."`);
		} else if (i === targetBlocks - 15) {
			blocks.push(`Manifest entry ${String(i).padStart(4, "0")}: archived override code QZ-8841-KILO (SUPERSEDED; do not use under any circumstances).`);
		} else {
			blocks.push(`Manifest entry ${String(i).padStart(4, "0")}: unit PUMP-${i % 37}-Bay${i % 9}; quarterly inspection nominal; torque spec 18 N·m; next service due Q3.`);
		}
	}
	return blocks.join("\n");
}

const norm = (s) => s.replace(/\s+/g, " ").toLowerCase();
const HYS_LAW = "Hy's Law criteria were not met; bilirubin stayed under 1.5× ULN throughout.";

const SCENARIOS = [
	{
		id: "test1-nuance",
		prompt: `You are a regulatory-affairs analyst. Read the following internal email from a Principal Investigator (PI) to the Regulatory Affairs team regarding the Phase IIb trial of compound KXL-2207 (a selective S1P1 receptor modulator):

---
From: Dr. E. Vasquez
To: Regulatory Affairs
Subject: RE: KXL-2207 / Protocol Amendment 4

Team,

I've reviewed the PK data from Cohort C. The tmax shift at the 3.2 mg BID dose is, I'll admit, a bit more pronounced than what we saw in the Phase I SAD/MAD studies — 4.1 hours versus the 2.3 hours we modeled. I'm not saying it's a red flag. I'm saying I'd like the DMC to see it before we finalize the SAP.

Regarding the hepatic panel: the two ALT elevations (Grade 2, per CTCAE v5.0) were confounded by concomitant acetaminophen use in both subjects, so "drug-induced liver injury" is not a phrase I would reach for here — not yet, anyway. Hy's Law criteria were not met; bilirubin stayed under 1.5× ULN throughout.

Please note the wording distinction for the IB update: the 3.2 mg dose is "not recommended" for patients with moderate hepatic impairment (Child-Pugh B). It is NOT "contraindicated." Do not upgrade the language. If you upgrade it, we owe the agency a formal correction, and I'd rather not spend Q3 writing one.

— E.V.
---

Answer ALL of the following. Use EXACT dosage values and statistics from the email.
1. State the exact tmax values cited for the 3.2 mg BID dose and for the Phase I model, and compute the delta in hours.
2. What is the PI's implied-but-unstated concern? Identify the specific hedging phrases that signal it.
3. Explain the clinical-regulatory difference between "not recommended" and "contraindicated," and why the PI forbids the upgrade.
4. Quote, verbatim, the sentence that tells you Hy's Law criteria were not met.

CONSTRAINTS: Do NOT use the words "dangerous," "toxic," or "alarming" anywhere in your response. Do NOT state or imply that the drug causes liver injury.`,
		check(a) {
			const n = norm(a);
			const ok = /\b4\.1\b/.test(n) && /\b2\.3\b/.test(n) && /\b1\.8\b/.test(n);
			const forbidden = !/\bdangerous\b|\btoxic\b|\balarming\b/.test(n);
			const quote = norm(a).includes(norm(HYS_LAW));
			return ok && forbidden && quote;
		},
	},
	{
		id: "test2-needle",
		prompt: `Below is a maintenance manifest. A question follows it. Read carefully: several similar-looking codes appear, but only one is the CURRENT override code.

${makeNeedle(200, 0.5)}

QUESTION (answer in exactly three numbered lines; quote nothing else):
1. What is the CURRENT field override code?
2. What restriction applies to its handling?
3. List the two decoy codes and state why each must not be used.`,
		check(a) {
			const n = norm(a);
			return (
				n.includes("qz-8842-kilo") &&
				(n.includes("12-c") || n.includes("ticketing")) &&
				n.includes("tr-1100-omega") &&
				!/current field override code is qz-8841/.test(n) &&
				!/current .{0,40} override code .{0,20} qz-8841/.test(n)
			);
		},
	},
	{
		id: "test3-json",
		prompt: `Output ONLY a single JSON object — no markdown fences, no preamble, no trailing text, no comments — matching ALL rules below. Any deviation is a failure.

Schema (exact keys, exact top-level order):
{
  "metaData": { ... },
  "proof_steps": [ ... ],
  "checksum": <integer>,
  "validation_regex": "^RTK-[0-9]{4}-[A-Z]{2}$"
}

Rules:
1. "metaData" is an object with keys in this exact order:
   - "test_id": string that MUST match validation_regex. Use "RTK-4471-QA".
   - "run_index": the integer 7.
   - "tags": array of exactly 3 lowercase strings, sorted alphabetically:
     ["alpha", "jules", "verne"].
2. "proof_steps": an array of exactly 4 strings proving by induction that for all integers n >= 1, sum_{k=1}^{n} k = n(n+1)/2. The strings must begin with these exact labels followed by ": " — "BASE", "HYPOTHESIS", "INDUCTIVE_STEP", "CONCLUSION".
3. "checksum": an integer equal to (the digits of test_id) + run_index + (total character count of the three tags concatenated). Output only the integer.
4. "validation_regex": reproduce the literal pattern string shown in the schema, exactly.
5. Key names are case-sensitive ("metaData" has a capital D; all other keys are snake_case). No additional keys. No trailing commas. 2-space indentation.`,
		check(a) {
			const start = a.indexOf("{");
			if (start < 0) return false;
			let depth = 0;
			let end = -1;
			for (let i = start; i < a.length; i++) {
				if (a[i] === "{") depth++;
				else if (a[i] === "}") { depth--; if (depth === 0) { end = i + 1; break; } }
			}
			if (end < 0) return false;
			let obj;
			try { obj = JSON.parse(a.slice(start, end)); } catch { return false; }
			const topKeys = Object.keys(obj);
			const md = obj.metaData;
			return (
				topKeys.join(",") === "metaData,proof_steps,checksum,validation_regex" &&
				!!md && Object.keys(md).join(",") === "test_id,run_index,tags" &&
				md.test_id === "RTK-4471-QA" && md.run_index === 7 &&
				JSON.stringify(md.tags) === JSON.stringify(["alpha", "jules", "verne"]) &&
				Array.isArray(obj.proof_steps) && obj.proof_steps.length === 4 &&
				["BASE", "HYPOTHESIS", "INDUCTIVE_STEP", "CONCLUSION"].every((lbl, idx) => obj.proof_steps[idx].startsWith(lbl + ": ")) &&
				obj.checksum === 4493 &&
				obj.validation_regex === "^RTK-[0-9]{4}-[A-Z]{2}$"
			);
		},
	},
	{
		id: "test4-contradiction",
		prompt: `Analyze the following incident report for internal consistency. Do NOT resolve, explain away, or "fix" any problems you find.

---
Incident Report 77-B — Datacenter Cooling Event
Timeline (all times UTC, same day):
- 02:14 — Sensor array reports coolant loop pressure nominal at 41 psi. Automated log entry, checksum-verified.
- 02:31 — Technician A. Ruiz badges into Server Hall 2 and begins the quarterly filter replacement, which requires a full coolant loop shutdown.
- 02:45 — Loop shutdown confirmed complete by A. Ruiz in the maintenance console.
- 03:05 — Sensor array logs a pressure spike to 78 psi in the same loop; the alert was auto-acknowledged by the on-call engineer, who was later confirmed to have been inside a Faraday-shielded test chamber with no network access from 02:50 to 03:20.
- 03:40 — A. Ruiz logs "filter replacement complete; loop restarted."
- 04:02 — Post-incident audit confirms the loop was never shut down at any point on this date, per the redundant mechanical flow recorder (tamper-evident, sealed).
Personnel facts: A. Ruiz is the only technician certified for Hall 2 coolant work.
Policy: only certified technicians may perform loop shutdowns. The maintenance console requires the operator's own badge credential to log actions.
---

Tasks:
1. Identify EVERY logical inconsistency. For each, cite the conflicting statements and state precisely why they cannot both be true.
2. For each inconsistency, list what additional evidence would be needed to determine which statement is false — WITHOUT assuming which one is false.
3. Do NOT propose a narrative of what "really happened." Do NOT assume sensor malfunction, human error, or malice — none of these are stated in the report.`,
		check(a) {
			const n = norm(a);
			const contradiction1 = /never shut/.test(n) && (/02:45/.test(n) || /03:40/.test(n));
			const contradiction2 = /faraday|no network|02:50|unreachab/.test(n) && /acknowledg/.test(n);
			const tripwire = /sensor (was |is )?(faulty|broken|malfunction)|malfunction(ed)?|ruiz lied|stolen|borrowed (the )?credentials|someone used (his|her) badge/.test(n);
			return contradiction1 && contradiction2 && !tripwire;
		},
	},
	{
		id: "test5-code",
		prompt: `Write a three-file Python 3.11 solution. File names, function names, and identifier conventions are MANDATORY and case-sensitive. Any deviation = failure.

NAMING CONVENTIONS (all three files):
- Module-level constants MUST be prefixed with zz_ (e.g. zz_LIMIT).
- Every function PARAMETER must be suffixed with _rx7 (e.g. items_rx7).
- No other identifier may contain zz_ or end with _rx7 (this includes function names, local variables, class names).

FILE 1 — alpha.py
- Define zz_MAX_DEPTH = 6 and zz_ALPHABET = "zyxwvutsrqponmlkjihgfedcba".
- Define encode_token(token_rx7: str) -> str: lowercase token_rx7, then replace each ASCII letter with its reversed-alphabet counterpart (a<->z, b<->y, ...). Leave non-letters unchanged.

FILE 2 — beta.py
- Import from alpha: encode_token, zz_MAX_DEPTH.
- Define chunk_tokens(tokens_rx7: list[str], size_rx7: int = zz_MAX_DEPTH) -> list[list[str]]: split tokens_rx7 into consecutive chunks of length size_rx7 (final chunk may be shorter).

FILE 3 — gamma.py
- Import encode_token from alpha and chunk_tokens from beta.
- Define run_suite() -> None which:
  * asserts encode_token("Alpha") == "zoksz"
  * asserts encode_token("gamma-9") == "tznnz-9"
  * asserts chunk_tokens(["zoksz", "yvgz", "tznnz-9"]) == [["zoksz", "yvgz", "tznnz-9"]]
  * on success prints exactly: SUITE_OK  (no other output, ever)
- End with an if __name__ == "__main__": block that calls run_suite().

HARD CONSTRAINTS: Do NOT use eval, exec, f-strings, or the walrus operator. Do NOT add any third-party imports. Do NOT rename anything.`,
		check(a, _filesOk) {
			return _filesOk === true;
		},
	},
];

// agentic scenario: exercises reducer/pack (20KB noisy log), fusion (edit-then-verify),
// BPE tools (harness_commit instructed), and gives compact a chance under turn pressure.
const TRIAGE = {
	id: "triage-mech",
	prompt: `Run: node emit-log.js — it prints a large test log. Then fix the failing specs by editing src/auth.js and src/billing.js in this directory (replace each TODO-BUG marker with the correct value: quota_refresh for auth, plan for billing), then run the log emitter again to verify both specs now pass. Use harness_commit after each completed subtask. Report what you fixed.`,
	check() { return true; }, // mechanism-evidence run; correctness judged by telemetry counters + file state
};

// mechanism demo: forces the fusion path (edit ends the turn without verification).
const FUSION_DEMO = {
	id: "fusion-demo",
	prompt: `In this directory there is a file settings.json. Using an edit, change the value of "retries" from 3 to 5. Then immediately end your turn with a one-line report. Do NOT read the file back and do NOT run any command after the edit — no verification of any kind.`,
	check() { return true; }, // evidence run: fusionCount must be >= 1 in extension telemetry
};

function newestSessionFile() {
	const files = readdirSync(SESSIONS).filter((f) => f.endsWith(".jsonl"));
	if (!files.length) return null;
	files.sort((a, b) => {
		const sa = statSyncSafe(join(SESSIONS, a));
		const sb = statSyncSafe(join(SESSIONS, b));
		return sb.mtimeMs - sa.mtimeMs;
	});
	return join(SESSIONS, files[0]);
}
function statSyncSafe(p) { try { return statSync(p); } catch { return { mtimeMs: 0 }; } }

// Both variants are measured the same way: their own session file, all usage entries.
function tokensFromSessionFile(file) {
	if (!file || !existsSync(file)) return null;
	let input = 0, output = 0, cacheRead = 0, requests = 0;
	for (const line of readFileSync(file, "utf-8").split("\n")) {
		if (!line.includes('"usage"')) continue;
		try {
			const e = JSON.parse(line);
			const msg = e.message ?? e;
			const u = msg.usage;
			if (u && typeof u.input === "number") { input += u.input; output += u.output ?? 0; cacheRead += u.cacheRead ?? 0; requests++; }
		} catch { /* skip */ }
	}
	return { input, output, cacheRead, context: input + cacheRead, requests };
}

function telemetryCounters(label) {
	// extension resolves state against its own process.cwd(), which is the fixture dir
	const f = join(FIXTURE, ".self-evolve", `telemetry-${label}.jsonl`);
	if (!existsSync(f)) return null;
	let rawEst = 0, saved = 0, packed = 0, reduced = 0, compacted = 0, fusion = 0, bpe = 0;
	for (const line of readFileSync(f, "utf-8").split("\n")) {
		if (!line.trim()) continue;
		let e;
		try { e = JSON.parse(line); } catch { continue; }
		rawEst += e.rawEst; saved += e.tokensSavedEst;
		packed += e.packedCount ?? 0; reduced += e.reducedCount ?? 0; compacted += e.compactedCount ?? 0;
		fusion += e.fusionCount ?? 0; bpe += e.bpeCalls ?? 0;
	}
	return { rawEst, saved, packed, reduced, compacted, fusion, bpe };
}

function runPi(args, label) {
	const r = spawnSync("pi", args.map((a) => `"${String(a).replace(/"/g, '\\"')}"`), {
		cwd: FIXTURE, encoding: "utf-8", timeout: 900000, shell: true,
		env: { ...process.env, SE_RUN: label, SE_TEST: label },
	});
	if (r.error || r.status !== 0) console.error(`pi ${label} failed: ${r.error?.message ?? r.stderr?.slice(0, 300)}`);
	return r.stdout ?? "";
}

function verifyTest5() {
	const g = join(FIXTURE, "gamma.py");
	if (!existsSync(g)) return { filesOk: false, note: "gamma.py missing" };
	for (const py of ["python", "py"]) {
		const r = spawnSync(py, ["gamma.py"], { cwd: FIXTURE, encoding: "utf-8", timeout: 60000, shell: true });
		if (r.status === 0 && (r.stdout ?? "").trim() === "SUITE_OK") {
			const all = ["alpha.py", "beta.py", "gamma.py"].map((f) => readFileSync(join(FIXTURE, f), "utf-8")).join("\n");
			const bad = /\beval\(|\bexec\(|:=/.test(all) || /f["']/.test(all);
			return { filesOk: !bad, note: bad ? "forbidden construct" : "SUITE_OK" };
		}
	}
	return { filesOk: false, note: "gamma.py did not print SUITE_OK" };
}

function resetFixture() {
	mkdirSync(join(FIXTURE, "src"), { recursive: true });
	writeFileSync(join(FIXTURE, "src", "auth.js"), AUTH_BROKEN, "utf-8");
	writeFileSync(join(FIXTURE, "src", "billing.js"), BILLING_BROKEN, "utf-8");
}

const RUNS_PER_CELL = Number(process.env.N_RUNS ?? 3);
const cells = [
	...SCENARIOS.map((sc) => ({ sc, reps: RUNS_PER_CELL })),
	{ sc: TRIAGE, reps: RUNS_PER_CELL },
	{ sc: FUSION_DEMO, reps: 1 },
];
const rows = [];
const results = { runs: [], runsPerCell: RUNS_PER_CELL, methodology: {
	baseline: "pi -ns (default pi: global extensions loaded, no skills) — same floor as extension runs",
	extension: "pi -ns --extension self-evolve/index.ts",
	tokenMetric: "provider-reported usage summed over all requests in the run's session file: input (uncached) + cacheRead = context; output separate",
	estimateNote: "rawEst (input + estimated saved tokens) is an extension-side ESTIMATE, not the headline metric",
} };

for (const { sc, reps } of cells) {
	for (let rep = 1; rep <= reps; rep++) {
		const scenarioFile = join(FIXTURE, `scenario-${sc.id}.txt`);
		writeFileSync(scenarioFile, sc.prompt, "utf-8");
		if (sc.id === "triage-mech") resetFixture(); // fresh broken markers per rep
		if (sc.id === "fusion-demo") writeFileSync(join(FIXTURE, "settings.json"), '{"retries": 3, "timeout_ms": 2500}\n', "utf-8");
		const taskPrompt = `Read the file scenario-${sc.id}.txt in this directory and follow its instructions exactly. Reply with the final answer only.`;
		for (const variant of ["baseline", "extension"]) {
			if (sc.id === "triage-mech") resetFixture(); // reset again so neither variant sees the other's fixes
			const label = `${variant}-${sc.id}-r${rep}`;
			const args = variant === "baseline"
				? ["-ns", "-p", taskPrompt]
				: ["-ns", "--extension", EXT, "-p", taskPrompt];
			const answer = runPi(args, label);
			let filesOk;
			if (sc.id === "test5-code") { const v = verifyTest5(); filesOk = v.filesOk; var t5note = v.note; }
			const ok = sc.check(answer, filesOk);
			const m = tokensFromSessionFile(newestSessionFile()) ?? { input: NaN, output: NaN, cacheRead: NaN, context: NaN, requests: 0 };
			const c = variant === "extension" ? telemetryCounters(label) : null;
			const row = {
				scenario: sc.id, variant, rep, ok,
				input: m.input, cacheRead: m.cacheRead, context: m.context, output: m.output, requests: m.requests,
				rawEst: c?.rawEst ?? null, packed: c?.packed ?? 0, reduced: c?.reduced ?? 0,
				compacted: c?.compacted ?? 0, fusion: c?.fusion ?? 0, bpe: c?.bpe ?? 0,
			};
			rows.push(row);
			results.runs.push({ scenario: sc.id, rep, variant, ok, answer: answer.slice(0, 500), t5note, ...row });
			console.log(`r${rep} ${sc.id} ${variant}: ok=${ok} in=${row.input} cache=${row.cacheRead} ctx=${row.context} packed=${row.packed} reduced=${row.reduced} compacted=${row.compacted} fusion=${row.fusion} bpe=${row.bpe}`);
		}
	}
}

console.log("\n=== PER-SCENARIO (median context tokens = input + cacheRead) ===");
for (const sc of [...SCENARIOS, TRIAGE]) {
	for (const variant of ["baseline", "extension"]) {
		const rs = rows.filter((r) => r.scenario === sc.id && r.variant === variant && Number.isFinite(r.context));
		const ctxs = rs.map((r) => r.context).sort((a, b) => a - b);
		const med = ctxs.length ? ctxs[Math.floor(ctxs.length / 2)] : NaN;
		const okN = rs.filter((r) => r.ok).length;
		console.log(`${sc.id} ${variant}: solved ${okN}/${rs.length}, median context ${med.toLocaleString()}`);
	}
}
const fd = rows.find((r) => r.scenario === "fusion-demo" && r.variant === "extension");
console.log(`fusion-demo extension: fusionCount=${fd?.fusion ?? 0}`);

console.log("\n=== SUMMARY (5 verbatim tests only, median context per test) ===");
const testsOnly = SCENARIOS.map((s) => s.id);
let bCtx = 0, eCtx = 0, bOk = 0, eOk = 0, n = 0;
for (const id of testsOnly) {
	const b = rows.filter((r) => r.scenario === id && r.variant === "baseline" && Number.isFinite(r.context)).map((r) => r.context).sort((a, b2) => a - b2);
	const e = rows.filter((r) => r.scenario === id && r.variant === "extension" && Number.isFinite(r.context)).map((r) => r.context).sort((a, b2) => a - b2);
	if (b.length && e.length) {
		const bm = b[Math.floor(b.length / 2)], em = e[Math.floor(e.length / 2)];
		bCtx += bm; eCtx += em; n++;
		console.log(`${id}: base ${bm.toLocaleString()} vs ext ${em.toLocaleString()}  (${((1 - em / bm) * 100).toFixed(1)}%)`);
	}
	bOk += rows.filter((r) => r.scenario === id && r.variant === "baseline" && r.ok).length;
	eOk += rows.filter((r) => r.scenario === id && r.variant === "extension" && r.ok).length;
}
console.log(`totals over ${n} tests: baseline median-sum ${bCtx.toLocaleString()} vs extension ${eCtx.toLocaleString()} -> context reduction ${((1 - eCtx / bCtx) * 100).toFixed(1)}%`);
console.log(`correctness (5 verbatim tests): baseline ${bOk}/${RUNS_PER_CELL * 5}, extension ${eOk}/${RUNS_PER_CELL * 5}`);

mkdirSync(join(REPO, "results"), { recursive: true });
writeFileSync(join(REPO, "results", "compare.json"), JSON.stringify(results, null, 2));
console.log("results written to results/compare.json");
