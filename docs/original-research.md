Write a mvp prototype on a self evolving agent harness based on the research below:

"The Frontier of Self-Evolving Agent Harnesses: Architectural Paradigms, Co-Evolutionary Optimization, and Systems-Level Execution
As large language models (LLMs) transition from single-turn supervised prediction to autonomous, around-the-clock problem solving, the primary performance bottleneck has shifted from raw parameter scale to the architectural membrane interfacing the model with its execution environment: the agent harness. An agent harness comprises the runtime scaffolding, state management systems, tool dispatch routines, context compression primitives, and interaction protocols that govern how model outputs are translated into environmental actions and feedback. Historically, these harnesses were engineered as static, hand-crafted software abstractions. However, long-horizon tasks expose static harnesses to catastrophic context bloat, runaway inference API costs, execution brittleness, and trajectory-level safety drift.   

A major frontier in artificial intelligence research focuses on self-evolving agent harnesses. Rather than treating the runtime scaffold as a fixed infrastructure, state-of-the-art research formulates the harness as a dynamic, learnable, and optimizable system. This report provides a systematic analysis of recent advances in self-evolving agent harnesses, spanning training-free algorithmic search frameworks, reinforcement-learned harness interaction policies, real-world systems-level recursive self-improvement on heterogeneous hardware, and harness-policy co-evolution.   

Taxonomic Landscape of Self-Evolving Harness Architectures
Self-evolving harness frameworks can be classified across three core dimensions: the target of evolution (external software artifacts versus internal policy weights), the optimization mechanism (automated meta-search, reinforcement learning, or empirical feedback loops), and the execution domain (software engineering, embodied agent navigation, safety alignment, or hardware infrastructure serving).   

The structural taxonomy of systems defining this domain illustrates the diverse engineering strategies deployed across academic and industrial research laboratories.

System / Framework    Primary Architectural Focus    Optimization / Evolution Mechanism    Key Performance & Efficiency Benchmark Results    Primary Citation
SoL-Pi    Standalone, training-free harness extension layer for coding agents.    Scaled auto-research meta-search loops across 535 executable environments.    Cuts token traffic by 44.7%–49.0% and API cost by ~33% while retaining 93.7%–94.3% baseline task performance on EdgeBench.    
EvoHarness-RL    Policy-facing harness state interaction via Belief, Progress, Experience (BPE) slots.    Two-stage pipeline: Supervised Harness Fine-Tuning (SFT) + cost-aware GRPO.    Achieves 96.9% success on ALFWorld (86.6% on unseen split) and demonstrates "harness annealing."    
GLM Infra Agent    Closed-loop systems engineering for model-serving infrastructure on domestic AI chips.    Dense feedback loops (locality, low-cost microbenchmarks, execution traces).    Tripled (3×) end-to-end serving throughput on 100,000+ accelerators in under two weeks.    
SafeEvolve    Trajectory-driven safety harness and policy co-evolution.    Observability-driven artifact compilation paired with two-stage SFT-RL.    Reduces Attack Success Rate (ASR) 3× on AgentDojo while increasing benign utility to 61.86%.    
openJiuwen    Open-source composable harness supporting single agents, delegated agents, and Swarm Flow.    Rail-based capability composition and evidence-adapted runtime decisions.    Achieves 82.6% on SWE-bench Verified and 87.19% on Terminal-Bench 2.1 (+3.4% over official leaderboards).    
Prime Agent    State-tier management (L1–L3) and Recursive Language Model (RLM) abstraction.    IPython REPL execution with asynchronous rlm subagent primitives.    Raises ARC-AGI-3 RHAE Best@1 from 30% to 95.5%; lowers long-context coding overhead.    
Harness-Zero    Harness distillation via an "agent-as-harness" review architecture.    Evolved harness guidance distilled into base policy via LoRA SFT.    Improves bare base-model task success from 23.3% to 44.3%, outperforming harness-attached baselines.    
  
Training-Free Automated Harness Search: The SoL-Pi Framework
Meta-Harness Search Methodology
The SoL-Pi framework addresses token inefficiency and trajectory bloat in long-horizon coding agents without requiring parameter updates to the underlying language model. Recognizing that manual harness engineering is prone to subtle cross-component coupling—where an optimization in tool calling might cause token explosion in observation history—SoL-Pi employs an auto-research meta-search approach.   

The discovery process evaluated over 152 proposed directions across 6 feature families, executing more than 60,000 agent-environment interactions across 535 executable environments (comprising 495 GitHub issue/PR scenarios and 40 verifier-driven tasks). Proposed harness candidates were subjected to a rigorous two-stage selection policy. First, a capability gate discarded any candidate that degraded task completion scores beyond a strict threshold relative to the unmodified Pi baseline. Second, surviving candidates were filtered through an efficiency gate that prioritized token traffic reduction and API cost minimization.   

The Four Retained Mechanisms
From this automated search space, four modular efficiency mechanisms survived selection and were frozen into the SoL-Pi release. These operate via public, unmodified APIs of the Pi coding agent without requiring core source tree modifications:   

Action Fusion merges file editing commands with their subsequent build or verification steps into a single model request turn. In baseline agent harnesses, modifying a file and running test suites require two independent reasoning turns, duplicating system prompt and trajectory overhead. By bundling edits and validations, Action Fusion cuts turn-based context repetition. On EdgeBench tasks evaluated with GPT-5.6 Sol, Action Fusion triggered in 78.4% of tasks, averaging 70.58 activations per task, and yielded a 24.7% token efficiency gain on affected workloads.   

ObservationPack handles tool execution outputs exceeding 10 KiB, which pose a severe context inflation risk. When a tool produces oversized output, ObservationPack injects the complete text into the context for the initial two provider requests, enabling immediate error diagnosis. On subsequent turns (Request 3 onwards), the raw output is moved to local disk storage and replaced in the active context window by a lightweight resource handle, size metadata, and a head/tail excerpt. The agent can retrieve specific sections using paged recall routines.   

The Evidence-Preserving Reducer delegates log parsing to deterministic filtering routines that generate compact verification receipts. Standard coding agents spend substantial token budgets reading complete diagnostic outputs. The reducer compresses these logs into targeted diagnostic summaries. To guarantee evidence integrity, if a candidate reduction fails exact string quotation validation against the archived log source, the reduction is rejected, and the original observation is preserved intact.   

Online Context Compact tracks task progress via structured plan updates. When an agent completes a subtask, the harness marks that sub-tree as a candidate for compaction. The harness executes economic and window-pressure checks before initiating context compaction, summarizing completed steps while resetting the active context window for subsequent turns.   

Quantitative Benchmarking and Economic Impact
Evaluated across the 51-task EdgeBench suite, Terminal-Bench 4, Lean 4-verified IMO 2026 mathematical proofs, and multi-agent swarm environments, SoL-Pi delivered substantial resource reductions while maintaining parity with baseline model capabilities:   

Evaluation Target    Baseline System    SoL-Pi Engine Variant    Token Traffic Reduction (%)    Total API Cost Reduction (%)    Task Success / Metric Parity
EdgeBench (51 Tasks)    Native Pi (GPT-5.6 Sol)    SoL-Pi + GPT-5.6 Sol    -49.0%    -33.2%    
Retains 93.7% of base score (34.7 avg)

EdgeBench (51 Tasks)    Native Pi (Opus 5)    SoL-Pi + Opus 5    -44.7%    -33.5%    
Retains 94.3% of base score

Terminal-Bench 4    Native Codex / Pi    SoL-Pi Stack    N/A    -26.3% ($211 vs $286)    
Solves 15 / 63 CPU tasks

IMO 2026 (Lean 4)    Standard Harnesses    SoL-Pi Stack    N/A    Lowest cost ($20.90 / passed task)    
Passes 3 / 6 complex proof problems

Agent Swarm (20 Workers)    20 Pi Workers    20 SoL-Pi Workers    N/A    -26.8% ($60.11 vs $82.12)    
Reaches 1,127 cycles

  
When configured for maximum task performance by isolating single high-yield mechanisms (such as ObservationPack on GPT-5.6 Sol or Action Fusion on Opus 5), SoL-Pi exceeded native Pi task accuracy by +5.3% and +12.8%, respectively. Financially, these operational savings translate to estimated hourly cost reductions of $8.75 to $13.50 relative to standard Codex or Claude Code native harnesses.   

Policy-Facing Learnable Harnesses: EvoHarness-RL
The Belief, Progress, Experience (BPE) Abstraction
While training-free search frameworks optimize harness mechanics around fixed policies, EvoHarness-RL treats the external harness workspace as an explicit, policy-facing interface. EvoHarness-RL structures the external harness workspace into three functional slots:   

The Belief slot maintains current environment state estimates, domain knowledge assumptions, and entity mappings. The Progress slot explicitly tracks hierarchical sub-goal completion, pending execution steps, and task trajectory history. The Experience slot archives cross-episode lessons, error patterns, and successful execution strategies retrieved during task execution.   

To manipulate this state space directly, the policy is augmented with four explicit cognitive actions exposed alongside standard environmental tool calls: commit [subgoal], track [object], recall [query], and note [insight]. Cognitive tool invocations modify the BPE workspace state, whereas standard tool calls interact directly with the external environment execution layers.   

Two-Stage Optimization: SFT and Cost-Aware GRPO
Training an agent to interact effectively with its runtime harness requires balancing state management overhead with task execution progress. EvoHarness-RL achieves this using a two-stage training pipeline.   

First, Supervised Harness Fine-Tuning (SFT) bootstraps the base model (such as Qwen3-8B) on expert execution trajectories synthesized from high-capacity teacher models like Claude Opus. SFT teaches the model the syntax of cognitive tools and establishes baseline behaviors for populating the BPE slots. Second, cost-aware Group Relative Policy Optimization (GRPO) refines these interaction strategies offline. The GRPO objective applies an explicit reward penalty based on active context token volume and harness tool overhead:   

R 
total
​
 =R 
task
​
 −λ 
1
​
 ⋅C 
tokens
​
 −λ 
2
​
 ⋅N 
harness_calls
​
 
where R 
task
​
  represents terminal environment verifier success, C 
tokens
​
  tracks token expenditure, and N 
harness_calls
​
  counts cognitive tool invocations.   

Harness Annealing Dynamics
A central empirical finding of EvoHarness-RL is the phenomenon of harness annealing. During early reinforcement learning iterations, the agent relies heavily on external harness actions, making frequent calls to track and commit to log intermediate states. As policy optimization continues, the agent internalizes these state-tracking routines directly into its weights.   

Consequently, the policy naturally reduces its frequency of external harness calls, shifting toward selective, high-leverage state operations. The external workspace functions as adaptive scaffolding during early learning, gradually "annealing" into the model's internal parameter representations.   

Ablation studies confirm that all three BPE components are necessary for complex tasks. Removing the Experience slot caused the largest drop in performance, demonstrating that cross-episode knowledge retention is critical for avoiding repeated failure modes in long-horizon interactions. On the ALFWorld benchmark, EvoHarness-RL achieved a 96.9% task success rate (86.6% on unseen validation splits).   

Systems-Level Recursive Self-Improvement: GLM Infrastructure Agent
Deploying Under Extreme Hardware and Software Constraints
Moving beyond synthetic agent benchmarks, Z.ai applied self-evolving harness principles to hardware engineering and inference infrastructure. Deploying the production service for GLM-5.3-Flash required serving a 1-million-token context window and multimodal workloads across a cluster of over 100,000 Chinese domestic AI accelerators.   

This hardware environment presented severe systems constraints: limited per-card memory bandwidth, non-standard interconnect topologies, unoptimized compute kernels, incomplete compiler toolchains, and absent technical documentation. Rather than assigning human engineering teams to manually tune the stack over several months, Z.ai developed an autonomous Infra Agent powered by GLM-5.3 to optimize its own serving infrastructure.   

The Architecture of Dense Feedback Loops
The Infra Agent operates within a closed execution loop alongside human system architects and local test environments. While human operators established system boundaries, target metrics, and risk limits, the Infra Agent autonomously performed bottleneck profiling, hypothesis generation, C++/Python codebase modification, kernel rewriting, microbenchmarking, and production trace analysis.   

The system relied on three dense feedback principles designed to prevent trajectory drift in infrastructure engineering:   

First, feedback must be localized. Aggregate end-to-end metrics provide insufficient signal for complex root-cause diagnosis. The environment supplied feedback tied directly to specific C++ thread IDs, hardware launch parameters, memory bus allocations, or single-request output numerical diffs. Second, feedback must be low-cost and timely. The agent verified kernel correctness and compute speed via isolated microbenchmarks and unit tests executing in seconds, avoiding full-service redeployments for early hypothesis testing. Third, the environment provided full behavioral trace observability, surfacing low-level C++ locking delays, Global Interpreter Lock (GIL) contention, and direct memory access (DMA) transfer stalls.   

Concrete Infrastructure Breakthroughs
Through this closed feedback framework, the Infra Agent achieved major engineering breakthroughs across the inference stack:   

The Infra Agent discovered that inter-node data transfer performance was degraded by over 20% relative to hardware limits because Python worker threads were blocking on concurrency locks. By analyzing cross-layer Python/C++ call stacks, the agent restructured thread synchronization primitives, reducing the throughput penalty to under 1%.   

Analyzing Flash Linear Attention and DeepGEMM operator implementations, the agent identified an inefficiency in the Key-Value Decode kernel, where tiling along the V-dimension caused fourfold redundant computations per thread block. The agent redesigned the kernel to consolidate thread block operations, delivering a 1.71× speedup for that decode step.   

The agent also assisted in implementing an Encode-Prefill-Decode (EPD) disaggregated architecture, combining intra-node tensor parallelism, ReplaySSM, W8A8 quantization, and INT8/FP8/BF16 mixed-precision cache quantization.   

The system transitioned from initial model adaptation to production readiness in less than two weeks, tripling (3×) end-to-end serving throughput relative to the human baseline. Deployed in production as Ox-Alpha on public routing platforms, the optimized serving infrastructure processed over 62 trillion tokens within six days, achieving hardware cost efficiency comparable to mainstream Nvidia GPU deployments.   

Harness-Policy Co-Evolution and Complementary Paradigms
SafeEvolve: Co-Evolution for Safety Alignment
Traditional safety alignment focuses either on static refusal prompts or post-hoc RLHF on single outputs. However, long-horizon agents face dynamic safety risks—such as prompt injection, unauthorized privilege escalation, or multi-step goal misalignment—where individual tool steps appear benign in isolation but yield unsafe outcomes in aggregate.   

SafeEvolve introduces an experience-driven harness-policy co-evolution framework. On the harness side, completed on-policy execution trajectories are compiled into auditable, versioned harness updates, including modified safety boundaries and hierarchical skill rules with explicit risk attribution. On the policy side, a two-stage SFT-RL approach conditions the model to adhere to these updated harness constraints while optimizing task completion via verifier-decomposed rewards.   

On the AgentDojo benchmark, applying SafeEvolve to Qwen3.5-4B reduced the Attack Success Rate (ASR) threefold—from 2.37% down to 0.79%—while simultaneously increasing clean task utility from 59.79% to 61.86%. On AgentHarm, the framework reduced the harm score from 56.45 to 12.27 while raising the malicious prompt refusal rate from 28.98% to 83.83%.   

openJiuwen: Composability and Execution Rail Management
Addressing developer orchestration in complex software environments, openJiuwen explores structural composability alongside runtime adaptivity. Rather than evaluating harnesses as monolithic blocks, openJiuwen provides a shared execution substrate with Rail-based capability composition across single agents, delegated sub-agents, and multi-agent swarm workflows.   

Crucially, empirical evaluation of openJiuwen demonstrates that in long-horizon coding tasks, staging deterministic rule-based elision prior to LLM summarization provides superior context efficiency. Providing recoverable elision mechanisms adds framework complexity that models rarely utilize, whereas rigid rule-based filtering paired with summary fallback maximizes task success per token spent. openJiuwen achieved 82.6% on SWE-bench Verified and 87.19% on Terminal-Bench 2.1.   

Prime Agent and Harness-Zero: Context Tiers and Harness Distillation
Prime Agent introduces an explicit state-tier taxonomy to govern memory and context bandwidth. Active context (L1) contains the immediate input window for the current generation turn. REPL execution memory (L2) retains variables, dataframes, and objects persisting within an active IPython kernel. Disk-backed storage (L3) manages long-term logs, full repository state, and raw tool outputs.   

By leveraging an asynchronous rlm primitive, Prime Agent enables parent agents to dispatch recursive background subagents that communicate via direct handles, avoiding active context bloat. This architecture improved ARC-AGI-3 RHAE Best@1 performance from 30% to 95.5%.   

Finally, Harness-Zero addresses the deployment overhead of complex runtime harnesses by introducing "agent-as-harness" distillation. A high-capacity teacher agent uses an evolved harness to review and critique trajectory rollouts generated by a smaller student model. The student model is fine-tuned via LoRA SFT on these reviewed trajectories.   

When deployed without the specialized harness attached, the distilled base model's task success rate rose from 23.3% to 44.3%, outperforming the baseline model operating with the physical harness still attached (41.7%). This demonstrates that complex harness logic can be distilled directly into base model weights.   

Synthesis and Emergent Technical Insights
Analyzing these developments reveals core principles governing the evolution of agent harnesses:

The Scaffolding-to-Weights Continuum
Research reveals a clear spectrum in how agent scaffolding is represented and optimized. At one end of the spectrum, training-free meta-search harnesses like SoL-Pi modify external execution mechanics without altering parameter weights, making them ideal for proprietary frontier models. In the middle of the spectrum, policy-facing interfaces like EvoHarness-RL train models to manipulate structured external state slots, inducing harness annealing where external scaffolding shifts into internal parameter representations over time. At the far end of the spectrum, framework distillation methods like Harness-Zero eliminate runtime scaffolding entirely by embedding harness logic directly into model weights.   

Dense Local Feedback as the Engine of Autonomous Optimization
Across software-level harness search (SoL-Pi) and systems-level infrastructure tuning (GLM Infra Agent), the granularity of feedback dictates evolution stability. Optimization loops that rely on sparse, end-to-end task success signals frequently fail due to high variance and credit assignment ambiguity. In contrast, systems that supply localized feedback—such as exact string matching in evidence reducers or targeted microbenchmarks and C++ thread execution traces—enable agents to rapidly test hypotheses, discard failing approaches, and converge on stable optimizations.   

Trajectory Pruning as an Economic Prerequisite
Unchecked context growth poses both financial and technical challenges for long-horizon agents. Without active intervention, context windows accumulate redundant terminal outputs, obsolete planning steps, and unparsed diagnostic logs. By implementing handle-based state replacement (ObservationPack), deterministic log elision, and programmatic REPL storage, modern self-evolving harnesses bound context growth. This structural compression enables agents to execute long trajectories across hundreds of turns while maintaining stable token throughput and inference budgets.   

Strategic Engineering Roadmap and Conclusions
For research laboratories and engineering teams deploying long-horizon agent architectures, empirical findings suggest concrete priorities:

Implement tiered memory management that decouples raw tool outputs from active context windows, using local handles and paged recall to control token inflation.   

Structure automated harness search loops around dual-gate filtering, requiring candidates to preserve task capability before evaluating efficiency gains.   

Combine supervised fine-tuning with cost-aware policy optimization when training smaller models on state management, allowing harness annealing to internalize routine state tracking into model weights.   

Supply autonomous optimization agents with localized, low-cost feedback signals—such as targeted unit tests, execution traces, and microbenchmarks—to ensure reliable convergence during self-improvement loops.   

Link autonomous execution capabilities with auditable, versioned harness safety constraints to maintain trajectory alignment during multi-step interactions.   

Self-evolving agent harnesses represent a fundamental shift in autonomous systems design. By converting static scaffolding into dynamic, learnable, and search-optimized systems, recent research has achieved substantial improvements in execution efficiency, long-horizon task stability, serving throughput, and runtime safety. As these paradigms continue to integrate—combining training-free search, learnable state interfaces, and hardware-aware execution loops—agent systems will operate over increasingly long horizons with lower resource overhead and higher execution reliability.   


arxiv.org
Recursively Scaling Auto-Research Loops for Efficient Agent Harness
Opens in a new window

github.com
SoL-Pi: Scaling Auto-Research Loops for Efficient Agent Harnesses
Opens in a new window

arxiv.org
Prime Agent: A Self-Improving RLM Harness - arXiv
Opens in a new window

alphaxiv.org
EvoHarness-RL: Learning Self-Evolving Runtime Harness for Long
Opens in a new window

marktechpost.com
NVIDIA Introduces SoL-Pi: Auto-Research Loops That Cut Coding
Opens in a new window

arxiv.org
Beyond Static Harnesses for Long-Horizon Coding Agents - arXiv
Opens in a new window

arxiv.org
SafeEvolve: Harness-Policy Co-Evolution from Agent Experience for
Opens in a new window

researchgate.net
Embedding Non-Derivation Constraints in Long-Horizon AI Agents
Opens in a new window

arxiv.org
EvoHarness-RL: Learning Self-Evolving Runtime Harness for Long
Opens in a new window

z.ai
Toward Recursive Self-Improvement: How GLM Built Its Own ... - Z.ai
Opens in a new window

youtube.com
An 8B model matched Claude Opus 4.5. They trained the ... - YouTube
Opens in a new window

gigazine.net
Z.ai shares its expertise in providing a production service for 'GLM
Opens in a new window

reddit.com
GLM-5.3 helped build its own inference infrastructure and tripled
Opens in a new window

arxiv.org
SafeEvolve: Harness-Policy Co-Evolution from Agent Experience for
Opens in a new window

arxiv.org
[2609.02786] SafeEvolve: Harness-Policy Co-Evolution from Agent
Opens in a new window

researchgate.net
Beyond Static Harnesses for Long-Horizon Coding Agents
Opens in a new window

daily.dev
[2608.23552] Prime Agent: A Self-Improving RLM Harness | daily.dev
Opens in a new window

arxiv.org
[2608.23552] Prime Agent: A Self-Improving RLM Harness - arXiv
Opens in a new window

arxiv.org
1Introduction - arXiv
Opens in a new window

oschina.net
智谱披露GLM-5.3 初显RSI：模型开始优化承载自己的推理系统
Opens in a new window

ainativefoundation.org
China AI Native Industry Insights - 20260920 - Z.ai | MiniMax | Alibaba
Opens in a new window

huggingface.co
Paper page - An Empirical Study of Harness Design for Coding Agents"
