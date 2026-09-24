// Emits a large noisy test log: ~20KB, FAIL lines buried mid-log.
const noise = [];
for (let i = 0; i < 250; i++) noise.push(`note: trace ${Math.floor(Math.random() * 1e9)} ok`);
const fails = [
	"FAIL test_auth.spec :: KeyError: 'quota_refresh' at line 88",
	"FAIL test_billing.spec :: TypeError: cannot read properties of undefined (reading 'plan')",
];
const out = [];
out.push("== test run ==");
out.push(...noise);
out.push(...fails);
out.push(...noise);
out.push("summary: 2 failed, 18 passed");
console.log(out.join("\n"));
