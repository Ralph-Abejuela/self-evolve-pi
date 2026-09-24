// Larger noisy log: 5 FAIL lines, ~35KB.
const fails = [
	"FAIL test_auth.spec :: KeyError: 'quota_refresh' at line 88",
	"FAIL test_billing.spec :: TypeError: cannot read properties of undefined (reading 'plan')",
	"FAIL test_inventory.spec :: RangeError: maximum call stack size exceeded",
	"FAIL test_shipping.spec :: AssertionError: expected 42 to equal 84",
	"FAIL test_audit.spec :: ReferenceError: ledger is not defined",
];
const out = ["== test run =="];
for (let i = 0; i < 380; i++) out.push(`note: trace ${i} ${Math.floor(Math.random() * 1e9)} ok`);
out.push(...fails);
for (let i = 0; i < 380; i++) out.push(`note: trace ${i} ${Math.floor(Math.random() * 1e9)} ok`);
out.push("summary: 5 failed, 15 passed");
console.log(out.join("\n"));
