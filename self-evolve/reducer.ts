/** Evidence-preserving reducer: deterministic log filter -> verified receipt.
 *
 * Every quoted line is validated verbatim against the archived source. If
 * validation fails (or nothing interesting is found), the caller keeps the
 * original observation untouched.
 */

const INTERESTING =
	/\b(fail(?:ed)?|error|exception|traceback|assert(?:ion)?:?|panic|fatal|cannot|denied|✗|✘)\b/i;

export interface Reduction {
	receipt: string;
	quotedLines: string[];
}

export function reduceLog(text: string): Reduction | null {
	const lines = text.split("\n");
	const hits: string[] = [];
	for (const line of lines) {
		const t = line.trim();
		if (!t) continue;
		if (INTERESTING.test(t) || /^summary:/.test(t)) hits.push(t);
		if (hits.length >= 40) break; // bounded receipt
	}
	if (hits.length === 0) return null;
	// evidence guarantee: every quote must exist verbatim in the source
	for (const q of hits) {
		if (!text.includes(q)) return null;
	}
	const receipt = [
		`RECEIPT (evidence-preserving reducer; ${hits.length} lines quoted verbatim):`,
		...hits.map((h) => `  ${h}`),
	].join("\n");
	return { receipt, quotedLines: hits };
}
