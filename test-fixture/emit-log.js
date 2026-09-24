// Emits a large noisy test log: ~20KB, FAIL lines derived from real source state.
const fs = require("fs");
const fails = [];
try {
	if (fs.readFileSync("src/auth.js", "utf8").includes("TODO-BUG")) {
		fails.push("FAIL test_auth.spec :: KeyError: 'quota_refresh' at line 88");
	}
	if (fs.readFileSync("src/billing.js", "utf8").includes("TODO-BUG")) {
		fails.push("FAIL test_billing.spec :: TypeError: cannot read properties of undefined (reading 'plan')");
	}
} catch (e) {
	fails.push("FAIL test_harness.spec :: SetupError: " + e.message);
}
const noise = [];
for (let i = 0; i < 250; i++) noise.push(`note: trace ${Math.floor(Math.random() * 1e9)} ok`);
const out = ["== test run =="];
out.push(...noise);
out.push(...fails);
out.push(...noise);
out.push(`summary: ${fails.length} failed, ${20 - fails.length} passed`);
console.log(out.join("\n"));
