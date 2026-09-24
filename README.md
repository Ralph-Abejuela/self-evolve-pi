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

## Measured results (n=5 per cell, median input tokens, provider-reported)

| Scenario | Baseline `pi -ns -ne -nc` | With extension | Solved |
|---|---|---|---|
| triage-small (run log, report failures) | 4,904 | 1,485 | 5/5 both |
| triage-big (5 failures, ~35 KB log) | 9,232 | 1,329 | 5/5 both |
| needle (single-shot long read, parity check) | 4,475 | 4,602 | 5/5 both |
| **Total** | **85,170** | **59,565** | **15/15 both** |

**30.1% input token reduction with full capability parity.**

Key measurement findings:
1. The reducer dominates: verified receipts beat pack+recall for repeated shell output (matches the literature's finding that deterministic elision beats recoverable recall).
2. Packing single intentional `read` outputs is a regression (extra recall turns); `read` is therefore excluded from packing by default.
3. Unguided recall is expensive: early builds let the model page entire archives; the "complete evidence" receipt guidance fixed it.

Run the comparison yourself: `node run-compare.mjs` (env `N_RUNS` to change cell size; results in `results/compare.json`).
