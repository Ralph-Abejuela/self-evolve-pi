# Scope: Self-Evolve Pi Extension

A pi coding agent extension that turns the runtime scaffold into a self evolving harness, plus a small comparison harness that measures it against a bare pi run. It serves the owner (a single developer) who wants lower token spend and stable long horizon sessions.

**Build approach:** Tracer Bullet (each slice ships end to end through extension, runtime, and measurement, working).
**Workflow:** Prototype (nothing after /develop; you rely on the build time self check and your own eye).

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use `/develop` and skip `/architect`. You decide when a feature is `done`._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & architecture | Foundation | done |
| 2 | ObservationPack & paged recall | Slice 1 | done |
| 3 | Evidence preserving reducer | Slice 2 | done |
| 4 | BPE cognitive tools & context compact | Slice 3 | done |
| 5 | Action fusion chaining & /evolve control | Slice 4 | done |
| 6 | Comparison harness & telemetry | Slice 5 | done |

## Foundations

### 1. Stack & architecture · done
Decide the extension structure (single file vs directory, module layout, state storage, tool registration) and scaffold the new folder so every later slice builds on real structure.
**Done when:** the decision is recorded in a spec and the scaffolded extension loads in pi without errors.
- [x] Decide the stack (spec): `/architect stack & architecture`
- [x] Build it: `/develop stack & architecture`
   - [x] Scaffold directory extension with index.ts, module stubs, config loader
   - [x] /evolve command reports state and toggles config
   - [x] Extension loads in pi without errors
Spec 0001 · code in `self-evolve/`

## Slice 1: ObservationPack & paged recall

### 2. ObservationPack & paged recall
Oversized tool outputs leave the active window and live on disk. The model sees a head and tail excerpt plus a handle, and can page the archive back in on demand. This is the biggest single token saving.
**Done when:** a tool result over the size threshold becomes an excerpt with a handle in context, the raw text is on disk, and a recall tool returns paged slices of it.
- [x] Build it: `/develop observationpack`

## Slice 2: Evidence preserving reducer

### 3. Evidence preserving reducer
Deterministic filtering of build and test logs into compact receipts. Every quoted line is checked verbatim against the archived log, and a failed check keeps the original output, so evidence integrity never degrades.
**Done when:** a noisy log becomes a short receipt, every receipt quote appears verbatim in the archived source, and a failing validation preserves the original.
- [x] Build it: `/develop evidence reducer`

## Slice 3: BPE cognitive tools & context compact

### 4. BPE cognitive tools & context compact
Four model facing tools (commit, track, recall, note) write structured state into a durable store outside the context window. Committing a finished subtask under window pressure collapses the finished span into a summary.
**Done when:** the four tools register and persist state across turns, and a commit under pressure compacts completed context without losing the current task.
- [x] Build it: `/develop bpe tools`

## Slice 4: Action fusion chaining & /evolve control

### 5. Action fusion chaining & /evolve control
After an edit tool call, the extension chains the verification command into the same turn boundary instead of a new model request. A /evolve command turns mechanisms on and off and shows current config and counters.
**Done when:** an edit followed by a verify costs one continuation instead of one extra model request, and /evolve toggles and reports mechanism state live.
- [x] Build it: `/develop action fusion`

## Slice 5: Comparison harness & telemetry

### 6. Comparison harness & telemetry
A runner that drives the same test prompts from the stress test suite through a bare pi (`pi -ns -ne -nc`) and through pi with the extension, logging JSONL per request: input tokens raw and post, reduction ratio, and answer correctness against ground truth.
**Done when:** the comparison table shows per test token counts for baseline and extension, plus pass and fail against the known answers.
- [x] Build it: `/develop comparison harness`

## Deferred
Out of scope for the current build pass, kept so the plan stays honest.
- **Harness annealing (SFT + GRPO)**: weight training, not runtime scaffolding
- **Harness distillation**: weight training, not runtime scaffolding
- **Dual gate auto search loop**: automated candidate search needs many scored rollouts; the /evolve command covers manual control first

## Legend

**The decision box.** Every feature carries exactly one, the sub task whose label ends with `(spec)`.
**Feature lifecycle**: `planned` → `in-progress` → `done`, plus `existing` (pre workflow) and `dropped` (de scoped, kept for history).
**Next step** = the first unticked box, always a command.
