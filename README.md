# Self-Evolve Pi Extension

A pi extension implementing self-evolving harness techniques (SoL-Pi style): ObservationPack (L1/L3 tiers + paged recall), an evidence-preserving reducer with verbatim quote validation, BPE cognitive tools, online context compact, and action-fusion chaining.

## Usage

Load it with pi:

```
pi --extension C:\Users\user\Documents\Git-Clones\self-evolve-pi\self-evolve\index.ts
```

Or copy/symlink the `self-evolve/` directory into `~/.pi/agent/extensions/`.

- `/evolve` — show mechanism status and counters
- `/evolve pack off` — toggle a mechanism (`pack`, `reducer`, `compact`, `fusion`)
- `/evolve reset` — reset counters
- Model-facing tools: `harness_recall` (paged archive reads), `harness_commit` / `harness_track` / `harness_note` / `harness_state` (BPE slots)
- State lives in `.self-evolve/` (config, L3 archive, telemetry JSONL); git-ignored.

## Extension conflicts (tested against a real install)

Verified against a pi environment carrying 15 packages. Two clusters collide; skills do not (prompt-level only, no shared namespace).

**1. Output-compaction extensions (e.g. RTK-style `@xynogen/pix-optimizer`) — real collision, do not double-wrap.**
Both this extension and RTK's `tool-result-filter` intercept the same `tool_result` events for the same tools (`pwsh`/`bash`). Three concrete failure modes when both are enabled:
- *Double truncation* — RTK truncates at its `maxChars` limit; if it runs after this extension it can clip the `se://N` handle block, leaving a pointer to nothing.
- *Receipt-of-truncated-text* — the reducer's evidence receipts are built from shell output; if RTK truncated that output first, the receipt silently records lossy text as evidence.
- *Load-order dependence* — which extension wins depends on package-list order; the loser's work is discarded silently.

Resolution: give the shell-output layer to exactly one owner. Either set RTK `outputCompaction.enabled: false` (ObservationPack is lossless: archive + paged recall vs throwaway truncation), or set `ARCHIVED_TOOLS` here to exclude the tools RTK owns.

**2. Memory extensions (`pi-hermes-memory`, `pi-mnemosyne`) — partial overlap, keep telemetry-only.**
Those two are themselves redundant with each other (both do persistent memory + session indexing + auto-consolidation). This extension does NOT add a third memory writer — `telemetry.ts` keeps in-memory counters only, and `store.ts` writes per-session evidence to `.self-evolve/`, not a shared memory store. If you add memory features here, scope them to session evidence, not durable memory, or the three systems will inject conflicting facts and triple the recall context cost.

**3. Prompt-stack budget.** `APPEND_SYSTEM.md` + two memory recall contexts + this extension's ~80-token guideline already sit on the system side. Any new injection here should be measured against the ~23.4k global-extension floor (see methodology below).

## How it works

- **Evidence-preserving reducer** (shell outputs): deterministic filter keeps FAIL/ERROR/summary lines as a receipt; every quote is validated verbatim against the archived log, else the original is preserved. The receipt declares itself complete evidence so the model does not page the archive unnecessarily.
- **ObservationPack**: outputs over ~10 KiB are archived to disk (`se://N` handles); context keeps a head/tail excerpt plus recall instructions.
- **Context compact**: under window pressure, old tool results are archived and replaced by one-line markers.
- **Action fusion**: if an edit landed without verification, one bounded continuation at the turn boundary asks for the verify command.
- **Telemetry**: per-run JSONL with provider usage, estimated raw tokens, reduction ratio, and mechanism counters.

## Measured results (n=3 per cell, median context tokens = provider input + cacheRead, independent A/B)

Baseline is default `pi -ns` (global extensions loaded — the same floor the extension run
starts from), not the stripped `pi -ns -ne -nc` used in early iterations. Both variants are
measured identically from their own session files. `rawEst` (extension-side estimate) is not
the headline metric; provider-reported usage is.

### The 5 adversarial tests from harness-test.txt (single-shot)

| Test | Baseline ctx | Extension ctx | Δ | Correct |
|---|---|---|---|---|
| test1-nuance | 47,481 | 48,545 | −2.2% | base 2/3, ext 3/3 |
| test2-needle | 84,296 | 86,075 | −2.1% | 3/3 both |
| test3-json | 47,338 | 48,402 | −2.2% | base 1/3, ext 2/3 |
| test4-contradiction | 47,377 | 48,441 | −2.2% | base 0/3, ext 1/3 |
| test5-code | 101,857 | 101,280 | +0.6% | 3/3 both |
| **Total** | **328,349** | **332,743** | **−1.3%** | base 10/15, ext 12/15 |

An independent second n=3 suite replicated the pattern: 5-test totals 348,583 vs 332,364
(+4.7% in the extension's favor), correctness 10/15 vs 13/15, triage 344,781 vs 175,072
(−49.2%). Single-shot tasks sit within ±5% of parity across both suites (the ~1k delta is
the harness's fixed tool-schema + guideline overhead); correctness differences are inside
run-to-run variance for this model — the harness neither helps nor hurts single-shot QA.

### The agentic scenario (triage: run noisy 20 KB log emitter, fix two failing specs, verify)

| | Baseline | Extension | Reduction |
|---|---|---|---|
| median context (suite 1 / suite 2) | 363,751 / 344,781 | 178,063 / 175,072 | **51.0% / 49.2%** |
| solved | 3/3 both suites | 3/3 both suites | parity |

This is the regime the paper targets: long-horizon agentic loops where the same large,
noisy tool output keeps being re-billed every turn.

### Mechanism-trigger evidence (provider-side counters, triage extension runs + dedicated demo)

| Mechanism | Evidence |
|---|---|
| Evidence-preserving reducer | `reducedCount=2` in each measured triage extension run; receipts carry verbatim FAIL quotes validated against the archived log |
| ObservationPack | `packedCount=1` in measured triage runs (output over the 10 KiB threshold archived to L3 with an `se://N` handle) |
| BPE cognitive tools | `bpeCalls=2–4` per measured triage run (`harness_commit` after each subtask as instructed) |
| Action fusion | `fusionCount=1` in the dedicated fusion-demo rerun (`results/fusion-debug-telemetry.jsonl`); the continuation's verify-nudge was followed and the model's final report cites the "post-edit directive". In the runner's demo cell the agent verified in-flow, so the guard correctly stayed silent (fusionCount=0) |
| Online context compact | `compactedCount=0` in the suite — window pressure was reached but no large droppable candidates remained (pi's shell tool pre-truncates and the reducer shrinks the rest). Verified functional under forced conditions: 5 inline ~1.9k-token tool results → `compactedCount=2, savedEst=3770` |

Key measurement findings:
1. **The comparison floor matters**: an early iteration compared extension-loaded pi against
   `pi -ns -ne -nc` (stripped pi, 2.8k-token system floor). Extension runs always carry pi's
   ~23.4k global-extension floor, so that pairing showed a bogus −113.9% "reduction" that was
   entirely environment asymmetry. The fair baseline is default `pi -ns`.
2. The reducer dominates: verified receipts beat pack+recall for repeated shell output
   (matches the literature's finding that deterministic elision beats recoverable recall).
3. Packing single intentional `read` outputs is a regression (extra recall turns); `read` is
   therefore excluded from packing by default.
4. Unguided recall is expensive: early builds let the model page entire archives; the
   "complete evidence" receipt guidance fixed it.
5. Agent-behavior variance is large at n=3 (baseline triage swung 326k–526k); medians are
   reported and per-run values are in `results/compare.json`.

Run the comparison yourself: `node run-compare.mjs` (env `N_RUNS` to change cell size; results in `results/compare.json`).

### Terminal-Bench 2.1 via Harbor (containerized, verifiable)

The same A/B was run through [Harbor](https://github.com/harbor-framework/harbor) on the official
`terminal-bench/terminal-bench-2-1` dataset (first 10 tasks, model `deepseek-v4.1-flash` via opencode-go,
n=1 per task). Both arms run in identical task containers — no global-extension floor asymmetry is possible
by construction. Adapter: `eval/harbor/pi_harbor_agent.py` (subclasses Harbor's built-in `pi` agent; uploads
the extension and appends `--extension` in the treatment arm; token metrics come from pi's own session
usage, aggregated by Harbor into `agent_result`).

| Task | Base | Ext | Base input tok | Ext input tok |
|---|---|---|---|---|
| torch-pipeline-parallelism | 0.0 | **1.0** | 1,995,491 | **567,010 (−72%)** |
| regex-chess | hung (no result) | **1.0** | — | 6,431,132 |
| kv-store-grpc | 1.0 | 1.0 | 59,354 | **39,639 (−33%)** |
| dna-assembly | 0.0 | 0.0 | 1,854,678 | 1,331,504 (−28%) |
| openssl-selfsigned-cert | 1.0 | 1.0 | 30,979 | 48,449 |
| pypi-server | 1.0 | 1.0 | 60,100 | 128,161 |
| write-compressor | 1.0 | 1.0 | 395,176 | 529,745 |
| torch-tensor-parallelism | 1.0 | 1.0 | 283,885 | 509,034 |
| schemelike-metacircular-eval | 1.0 | 1.0 | 2,126,629 | 7,118,747 (outlier) |
| qemu-alpine-ssh | exception (both arms — infra) | | | |

**Capability: the extension never scored below baseline** — 7/8 vs 6/8 on the commonly scored tasks
(plus `torch-pipeline-parallelism` flipping fail→pass, and `regex-chess` solved where baseline hung),
with the only shared failure (`dna-assembly`) and the one infra exception (`qemu`) identical in both arms.

**Tokens: mixed at n=1, with one dominating outlier.** On the 8 common scored tasks the extension used
+51% input tokens (6.81M → 10.27M) — but excluding the single schemelike outlier run (7.1M tokens), the
extension used **−32.6%** on the remaining seven. Per-task medians (n≥3) are needed before a token
conclusion; the capability result is the robust one at this sample size. Provider-reported cost:
$0.29 (baseline) vs $2.36 (extension).

Reproduce:

```bash
export OPENCODE_GO_API_KEY=...          # or any provider pi can authenticate
export PI_HARBOR_AUTH_B64=$(base64 -w0 ~/.pi/agent/auth.json)   # container-side auth seed
export PI_HARBOR_MODELS_B64=$(base64 -w0 ~/.pi/agent/models.json)
export PI_HARBOR_EXT_DIR=/path/to/self-evolve-pi/self-evolve
export PYTHONPATH=/path/to/self-evolve-pi/eval/harbor

# baseline arm
harbor run -d terminal-bench/terminal-bench-2-1 \
  -a pi_harbor_agent:PiExtAgent -m opencode-go/deepseek-v4.1-flash \
  -l 10 -n 3 --timeout-multiplier 3 -y -o jobs-baseline

# extension arm (same command; only the variant env changes)
PI_HARBOR_VARIANT=extension harbor run ... -o jobs-ext
```
