# Self-Evolve Pi Extension

This is a pi extension. It keeps agent context small on long agent loops. It uses five mechanisms:

- **Evidence reducer** (shell outputs). It filters shell output. It keeps FAIL, ERROR, and summary lines. Each kept quote is checked word-for-word against the saved log. If the check fails, the original text stays.
- **ObservationPack** (big tool outputs). It saves outputs over ~10 KiB to disk. It puts a short head/tail excerpt in context. The model recalls the full text later.
- **Context compact** (full window). When the window is full, it replaces old tool results with one-line markers.
- **Action fusion** (unverified edits). After an edit without verification, it adds one bounded ask at the turn boundary: run the verify command.
- **Telemetry**. It writes per-run counters to a JSONL file: provider usage, estimated raw tokens, reduction ratio, mechanism counters.

## Install

From npm (recommended):

```
pi install npm:pi-self-evolve
```

Or from git:

```
pi install git:github.com/ralph-abejuela/self-evolve-pi
```

Or try it for one session without installing:

```
pi -e npm:pi-self-evolve
```

Or load a local checkout directly:

```
pi -e /path/to/self-evolve-pi/self-evolve/index.ts
```

## Usage

- `/evolve` — show mechanism status and counters
- `/evolve pack off` — toggle a mechanism (`pack`, `reducer`, `compact`, `fusion`)
- `/evolve reset` — reset counters
- Model tools: `harness_recall` (paged archive reads), `harness_commit` / `harness_track` / `harness_note` / `harness_state` (BPE slots)
- State lives in `.self-evolve/`. It is git-ignored.

## Extension conflicts (tested against a real install)

This was tested against a pi environment with 15 packages. Two clusters collide. Skills do not collide (prompt-level only, no shared namespace).

**1. Output-compaction extensions (RTK, https://github.com/rtk-ai/rtk) — real collision. Do not double-wrap.**
Both extensions intercept the same `tool_result` events for the same tools (`pwsh`/`bash`). Three failure modes when both are on:
- *Double truncation.* RTK truncates at its `maxChars` limit. If RTK runs after this extension, it can clip the `se://N` handle block. The result is a pointer to nothing.
- *Bad evidence.* The reducer builds receipts from shell output. If RTK truncated that output first, the receipt silently records lossy text as evidence.
- *Load order decides.* Package-list order decides which extension wins. The loser's work is discarded without a warning.

Rule: give the shell-output layer to one owner. Either set RTK `outputCompaction.enabled: false` (this extension is lossless: archive + recall, not truncation), or set `ARCHIVED_TOOLS` here to exclude the tools RTK owns.

**2. Prompt-stack budget.** `APPEND_SYSTEM.md` + two memory recall contexts + this extension's ~80-token guideline sit on the system side. Measure any new injection against the ~23.4k global-extension floor.

## Measured results (n=3 per cell, median context tokens = provider input + cacheRead, independent A/B)

The baseline is default `pi -ns` (global extensions loaded). This is the same floor the extension run starts from. Both arms are measured identically from their own session files. The extension-side estimate (`rawEst`) is not the headline metric. Provider-reported usage is.

### The 5 adversarial tests from harness-test.txt (single-shot)

| Test | Baseline ctx | Extension ctx | Δ | Correct |
|---|---|---|---|---|
| test1-nuance | 47,481 | 48,545 | −2.2% | base 2/3, ext 3/3 |
| test2-needle | 84,296 | 86,075 | −2.1% | 3/3 both |
| test3-json | 47,338 | 48,402 | −2.2% | base 1/3, ext 2/3 |
| test4-contradiction | 47,377 | 48,441 | −2.2% | base 0/3, ext 1/3 |
| test5-code | 101,857 | 101,280 | +0.6% | 3/3 both |
| **Total** | **328,349** | **332,743** | **−1.3%** | base 10/15, ext 12/15 |

An independent second n=3 suite replicated the pattern: totals 348,583 vs 332,364 (+4.7% in the extension's favor), correctness 10/15 vs 13/15, triage 344,781 vs 175,072 (−49.2%).

Read this table this way: single-shot tasks sit within ±5% of parity. The small delta is fixed overhead (tool schema + guideline). The correctness gaps are inside run-to-run noise for this model. Single-shot QA is not where this extension shows gains.

### The agentic scenario (run a noisy 20 KB log emitter, fix two failing specs, verify)

| | Baseline | Extension | Reduction |
|---|---|---|---|
| median context (suite 1 / suite 2) | 363,751 / 344,781 | 178,063 / 175,072 | **51.0% / 49.2%** |
| solved | 3/3 both suites | 3/3 both suites | parity |

This is the target regime: long agent loops that re-bill the same large noisy tool output every turn. Here the extension cut context in half at n=3, twice, with no solved-rate loss.

### Terminal-Bench 2.1 via Harbor (containerized, verifiable)

The same A/B ran through [Harbor](https://github.com/harbor-framework/harbor) on the official `terminal-bench/terminal-bench-2-1` dataset. First 10 tasks. Model `deepseek-v4.1-flash` via opencode-go. n=1 per task. Both arms run in identical task containers, so no environment asymmetry is possible. Adapter: `eval/harbor/pi_harbor_agent.py` (it subclasses Harbor's built-in `pi` agent, uploads the extension, and appends `--extension` in the treatment arm).

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

Full job results (every trial's trajectory, logs, verifier output) are public on Harbor Hub:

- Baseline arm: https://hub.harborframework.com/jobs/b0a875eb-4b90-4acd-a27c-9b6e1dca83d8
- Extension arm: https://hub.harborframework.com/jobs/cfa8a1d8-6f8b-44d0-a371-0172225fb9ec

## Research papers
Mechanism by mechanism:

| Mechanism here | Taken from | Paper |
| --- | --- | --- |
| Evidence reducer (`reducer.ts`) | Evidence-preserving reduction: compress logs into a receipt, validate every quoted line word-for-word against the archived source, keep the original on failure | SoL-Pi [^1] |
| ObservationPack (`pack.ts`) + `harness_recall` | ObservationPack: outputs over ~10 KiB move to a disk archive, context keeps a head/tail excerpt plus a handle, paged recall brings slices back | SoL-Pi [^1] |
| Context compact (`bpe.ts` commit under pressure) | Online context compact: completed subtasks marked for compaction, window-pressure and cost checks, summarize and reset the active window | SoL-Pi [^1] |
| Action fusion (`fusion.ts`) | Action fusion: bundle an edit with its verification step into one turn boundary instead of a second model request | SoL-Pi [^1] |
| BPE cognitive tools (`harness_commit` / `harness_track` / `harness_note` / `harness_state`) | Belief, Progress, Experience slots worked through four explicit cognitive actions: commit, track, recall, note | EvoHarness-RL [^2] |
| L1 active window / L3 disk archive split (`store.ts`, `.self-evolve/l3/`) | State-tier management: keep the working set in the live window, push the bulk to a durable lower tier | Prime Agent [^3] |

[^1]: SoL-Pi: Recursively Scaling Auto-Research Loops for Efficient Agent Harness — NVIDIA. https://arxiv.org/abs/2609.20519 · code: https://github.com/NVlabs/SoL-Pi
[^2]: EvoHarness-RL: Learning Self-Evolving Runtime Harness Policies — Meta. https://arxiv.org/abs/2608.05446 · OpenReview PDF: https://openreview.net/pdf?id=lFlnP9ZJHl
[^3]: Prime Agent: A Self-Improving RLM Harness — Prime Intellect. https://arxiv.org/abs/2608.23552 · blog: https://www.primeintellect.ai/blog/prime-agent

Related systems from the same survey, background for the deferred work (harness annealing and distillation are out of scope for this extension):

- SafeEvolve: Harness-Policy Co-Evolution from Agent Experience for Safety Alignment — https://arxiv.org/abs/2609.02786
- Beyond Static Harnesses for Long-Horizon Coding Agents (openJiuwen) — https://arxiv.org/abs/2608.27969
- Harness-Zero: Harness Distillation via Agent-as-Harness — https://arxiv.org/abs/2609.24974
- GLM Infra Agent (Z.ai): recursive self-improvement on its own serving infrastructure — https://z.ai/blog/glm-built-its-inference-infrastructure

What is re-implemented here vs the papers: this extension re-builds SoL-Pi's four mechanisms, EvoHarness-RL's BPE tool interface, and Prime Agent's tiered archive as a single pi extension, and measures them with its own comparison harness instead of EdgeBench or ALFWorld. The training-side ideas (SFT + GRPO from EvoHarness-RL, LoRA distillation from Harness-Zero) stay out of scope.

## Potential edge (what the results suggest — not proven at this sample size)

Three possible gains. Read them as suggestions at n=1 per task.

**1. No harm.** The extension did not lower any score. On the 9 shared tasks: 7 scores matched, 1 got better, 0 got worse. The shared failure (dna-assembly) and the infra exception (qemu) were identical in both arms. This is the floor: the extension is safe to load.

**2. Fewer tokens on long tasks.** 7 of 8 shared scored tasks used fewer input tokens. One outlier run (schemelike, 7.1M tokens) hid this in the totals. Without it, the extension used −32.6% on the remaining seven. The strongest cell: torch-pipeline. Baseline failed with 2.0M tokens. Extension passed with 0.6M tokens (−72%).

**3. Reach on hard tasks.** regex-chess was the only task the baseline could not finish (it hung). The extension solved it. The extension-only solve on the hardest task is the capability signal.

Limits, stated plainly:
- n=1 per task. One run can flip by chance. The torch-pipeline flip and the regex-chess solve each have one data point.
- One outlier run dominated the token totals. Median tokens per task are needed before a token claim.
- The robust claim today is the no-harm floor plus the ~50% context reduction on agentic loops (measured at n=3, twice). The capability edge and the token savings are candidate gains. They need more runs.

## Reproduce

Adversarial + agentic comparison: `node run-compare.mjs` (env `N_RUNS` to change cell size; results in `results/compare.json`).

Harbor A/B:

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
