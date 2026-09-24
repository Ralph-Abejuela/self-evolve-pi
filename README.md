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

Single-shot tasks are within noise of parity (the ~1k delta is the harness's fixed
tool-schema + guideline overhead). Correctness differences (10 vs 12 of 15) are inside
run-to-run variance for this model — the harness neither helps nor hurts single-shot QA.

### The agentic scenario (triage: run noisy 20 KB log emitter, fix two failing specs, verify)

| | Baseline | Extension | Reduction |
|---|---|---|---|
| median context | 363,751 | 178,063 | **51.0%** |
| solved | 3/3 | 3/3 | parity |

This is the regime the paper targets: long-horizon agentic loops where the same large,
noisy tool output keeps being re-billed every turn.

### Mechanism-trigger evidence (provider-side counters, triage extension runs + dedicated demo)

| Mechanism | Evidence |
|---|---|
| Evidence-preserving reducer | `reducedCount=18` across the 3 triage runs (5–7 each); receipts carried verbatim FAIL quotes |
| ObservationPack | `packedCount=2` (two outputs over the 10 KiB threshold archived to L3 with `se://N` handles) |
| BPE cognitive tools | `bpeCalls=30` across triage runs (8–12 each; `harness_commit` after each subtask as instructed) |
| Action fusion | `fusionCount=1` in the dedicated fusion-demo rerun (`telemetry-fusion-debug.jsonl`); the continuation's verify-nudge was followed and the model's final report cites the "post-edit directive". In the runner's demo cell the agent verified in-flow, so the guard correctly stayed silent (fusionCount=0) |
| Online context compact | `compactedCount=0` — no scenario reached window pressure; the mechanism is implemented (archive+marker on the `context` event, threshold `pressureTokens`) but not exercised by this suite |

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
