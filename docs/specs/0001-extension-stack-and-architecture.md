# 0001. Extension stack and architecture for the self evolving harness

**Date**: 2026-09-24
**Status**: Accepted

## Summary

The self evolving harness ships as one pi extension written in TypeScript and loaded straight from source, no build step. The extension watches every tool result, moves oversized outputs to a disk archive, hands the model a short excerpt plus a handle, and offers the model four small cognitive tools for structured state. A comparison runner measures token use against a bare pi. This spec fixes the structure so every later slice lands in the same shape.

## Context

Long coding sessions pile raw tool output into the model context, so token cost grows with every test run and every build log. The research prototype proved the mechanisms in simulation; now they must run inside a real agent runtime. pi extensions can transform tool results, register tools, and transform conversation context, which covers every mechanism we need at runtime. The training side mechanisms (annealing, distillation) stay out of scope. Without this decision each slice would invent its own storage and event wiring, and the slices would not compose.

## Requirements

**User stories**:
- As a developer running long agent sessions, I want oversized tool output archived to disk with an excerpt in context so my token spend stays flat.
- As the model, I want to recall archived output page by page so I can recover details I still need.
- As the developer, I want mechanisms I can switch on and off live so I can measure each one alone.

**Acceptance criteria**:
- **AC-1**: The extension loads in pi from the new folder with `pi --extension <path>` and registers its commands and tools without errors.
- **AC-2**: Oversized tool results are replaced by an excerpt with a handle, and the raw text lands in the archive directory on disk.
- **AC-3**: A recall tool returns a requested page of an archived output.
- **AC-4**: The reducer converts a noisy log into a receipt whose every line appears verbatim in the archived source; a failed validation keeps the original output.
- **AC-5**: The four cognitive tools (commit, track, recall, note) persist state that survives a session reload.
- **AC-6**: A commit under window pressure collapses completed context spans into a summary entry.
- **AC-7**: The /evolve command toggles each mechanism and reports current config plus counters.
- **AC-8**: The comparison runner produces JSONL telemetry and a summary table for bare pi versus extended pi.

## Options considered

### Option 1: Single file extension
One TypeScript file with everything inside. Simplest to load, but six mechanisms in one file would pass a thousand lines quickly.

**Pros**: zero structure decisions, one path to load.
**Cons**: hard to keep the slices isolated; every slice edits the same file.

### Option 2: Directory extension with module per mechanism
A directory with an `index.ts` entry that pi loads automatically, and one module per mechanism sharing a small core for state and config. Matches the pi docs recommendation for multi file extensions.

**Pros**: each slice touches one module; state and config live once.
**Cons**: slightly more ceremony up front.

## Decision

**Chosen option**: Option 2: Directory extension with module per mechanism.

**Implementation skills**: none used.

## Proposed stack

| Layer | Choice | Reason |
|---|---|---|
| Language | TypeScript (loaded by jiti, no build step) | pi loads local TypeScript extensions directly |
| Runtime host | pi extension API (`ExtensionAPI`, `pi.on`, `pi.registerTool`, `pi.registerCommand`) | documented integration points for every mechanism |
| L3 archive storage | project `.self-evolve/l3/` directory, one file per handle | plain disk, survives sessions, easy to inspect |
| BPE slot storage | `pi.appendEntry()` for durable entries plus tool result `details` for branch state | documented state storage rules |
| Config | `.self-evolve/config.json` edited by /evolve | live toggles without code changes |
| Telemetry | `.self-evolve/telemetry-*.jsonl` appended per model request | matches the stress test suite metric definitions |
| Comparison runner | PowerShell script driving `pi -p` in print mode, one run per test prompt, both configs | same instrumentation point for both sides |

## Build plan

1. Scaffold the directory extension: `index.ts`, module stubs, config loader, and a /evolve command that reports state, satisfies **AC-1**, **AC-7**
2. ObservationPack: `tool_result` transform plus archive writer plus recall tool, satisfies **AC-2**, **AC-3**
3. Evidence reducer: deterministic log filter with verbatim quote validation on top of the archive, satisfies **AC-4**
4. BPE tools and context compact: four registered tools, durable entries, and a commit time compaction pass, satisfies **AC-5**, **AC-6**
5. Action fusion: chain a verification step at the turn boundary after an edit tool call, satisfies part of the goal, no separate AC (measured through telemetry)
6. Comparison harness: runner script, JSONL schema, summary table, satisfies **AC-8**

## Consequences

**Positive**:
- Every mechanism is independently toggleable, so measurement stays honest.
- The archive lives in plain files, so debugging the harness is inspecting a folder.

**Negative / tradeoffs**:
- Transforming tool results touches every tool call, so the extension must stay cheap and never block; overhead gets its own telemetry field.

**Neutral**:
- The `.self-evolve/` directory appears in projects that use the extension; it should be ignored by git.

## References

**Project sources**:
- pi `docs/extensions.md`: event contracts, tool registration rules, state storage table
- `C:\Users\ExWaltzPC\Documents\test\harness-test.txt`: telemetry metric definitions and test prompts

**Practices & standards**:
- evidence preserving reduction with verbatim quote validation (from the SoL-Pi paper summary)
- tiered context management L1 active window, L3 disk backed archive (from the Prime Agent paper summary)
