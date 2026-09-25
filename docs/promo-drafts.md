# Launch post drafts — pi-self-evolve

Adjust handles/repo URL before posting. Community norm: state n, link raw logs, disclose the extension-only-solve before someone finds it. Never claim SOTA.

---

## X (single post + thread option)

**Single post:**

> Your coding agent spends ~50% of its context re-reading its own noise.
>
> I built a pi extension that fixes that: an evidence reducer that only keeps verified FAIL/ERROR/summary lines from shell output, and a disk archive for big tool outputs with paged recall.
>
> Measured A/B (n=3, twice): agentic loop context 363k → 178k tokens median. Same solved rate. No harm on Terminal-Bench 2.1 (9 shared tasks: 7 same, 1 better, 0 worse; one task the baseline hung on, the extension solved — one data point, take it as a signal, not proof).
>
> `pi install npm:pi-self-evolve`
>
> Repo, numbers, raw Harbor logs: LINK-URL

**Thread option:** post 1 = hook + 363k→178k number; post 2 = the three mechanisms (reducer / pack / compact); post 3 = TB2.1 table screenshot; post 4 = limits (n=1 per task, outlier run, cost asymmetry); post 5 = install command.

Reply-in-thread (not promo-tag) to @badlogicgames pi discussions with the data. Hashtags: #piagent #contextengineering — 2 max, plain technical text outperforms stacks.

---

## LinkedIn (link goes in first comment — LinkedIn downranks external links)

> Long agent loops have a context problem: the same 20 KB tool output gets re-billed into the model's context every single turn. By turn 30 your agent is mostly reading its own history.
>
> I built a harness extension for the pi coding agent that attacks this directly:
>
> 1. **Evidence reducer** — shell output gets filtered to FAIL/ERROR/summary lines, and every kept quote is verified word-for-word against the saved log. No invented evidence.
> 2. **ObservationPack** — tool outputs over ~10 KiB go to a disk archive; the context keeps a short excerpt plus a recall handle.
> 3. **Online compaction** — under window pressure, old tool results collapse to one-line markers.
>
> The honest numbers (n=3 per cell, measured from provider-reported usage, both arms identical setup): agentic-loop context dropped 363,751 → 178,063 tokens median (−51%), replicated in an independent second suite at −49%. Solved rate unchanged, 3/3 both arms. On Terminal-Bench 2.1 via Harbor, no task got worse; one task the baseline couldn't finish, the extension solved.
>
> What it does NOT show: gains on short single-shot tasks (parity within noise there), and the token-savings claim needs more runs — one outlier run dominated the totals.
>
> Install: `pi install npm:pi-self-evolve`
>
> Full methodology, raw job logs on Harbor Hub, and the limits section in the README: LINK-URL
>
> #pi #contextengineering #aicoding #llm

---

## Facebook (low-fit platform — use for general AI-coding groups, keep casual)

> Anyone running coding agents (pi, Claude Code, opencode, …) on long tasks: your context window is mostly your agent's own tool spam. I measured it — half the context was re-billed shell output.
>
> I built a free extension for the pi coding agent that cuts agentic-loop context ~50%: it compresses shell logs down to verified failure/summary lines, archives big tool outputs to disk with a recall command, and never lost accuracy in my A/B runs (n=3, twice) — plus a Terminal-Bench 2.1 run where nothing got worse.
>
> It's open source (MIT), one command to install: `pi install npm:pi-self-evolve`. Numbers + honest limits in the README: LINK-URL
>
> Feedback welcome — especially if you run long agentic loops on a different model than I tested (deepseek-v4.1-flash).
