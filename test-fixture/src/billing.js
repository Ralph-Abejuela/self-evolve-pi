// Plan resolution.
function resolvePlan(account) {
	// plan: resolve the account's plan, defaulting to "free" when absent.
	return account && account.plan ? account.plan : "free";
}
module.exports = { resolvePlan };
