/** Harness config: live toggles persisted to .self-evolve/config.json. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface HarnessConfig {
	pack: boolean; // ObservationPack: archive oversized outputs, show excerpt + handle
	reducer: boolean; // evidence-preserving reducer: log -> verified receipt
	compact: boolean; // online context compact under window pressure
	fusion: boolean; // action fusion: chain verification after edits at the turn boundary
	packThresholdTokens: number; // outputs above this get packed
	excerptChars: number; // head/tail chars kept in context for packed outputs
	pressureTokens: number; // estimated L1 tokens that trigger compaction
}

export const DEFAULTS: HarnessConfig = {
	pack: true,
	reducer: true,
	compact: true,
	fusion: true,
	packThresholdTokens: 2560, // ~10 KiB, matching the SoL-Pi paper threshold
	excerptChars: 1200,
	pressureTokens: 6000, // tuned: pi system prompt + tool defs already consume ~4-5k
};

export const MECHANISMS = ["pack", "reducer", "compact", "fusion"] as const;
export type Mechanism = (typeof MECHANISMS)[number];

export function stateDir(cwd: string): string {
	return join(cwd, ".self-evolve");
}

export function loadConfig(cwd: string): HarnessConfig {
	try {
		const p = join(stateDir(cwd), "config.json");
		if (existsSync(p)) return { ...DEFAULTS, ...JSON.parse(readFileSync(p, "utf-8")) };
	} catch {
		// corrupt config: fall back to defaults
	}
	return { ...DEFAULTS };
}

export function saveConfig(cwd: string, cfg: HarnessConfig): void {
	mkdirSync(stateDir(cwd), { recursive: true });
	writeFileSync(join(stateDir(cwd), "config.json"), JSON.stringify(cfg, null, 2));
}

/** ~tokens estimate: 4 chars per token. */
export function tok(chars: number): number {
	return Math.ceil(chars / 4);
}
