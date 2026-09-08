import { ReconciliationService } from "../server/services/reconciliation";

/**
 * Report money records that disagree with each other.
 *
 * Exits non-zero when anything is found, so it can be run from the deploy
 * pipeline or a schedule. `pnpm check:reconciliation`.
 */
async function main() {
  const findings = await ReconciliationService.all();

  if (findings.length === 0) {
    console.log("PASS: invoices and receipts agree.");
    return;
  }

  console.error(`FAIL: ${findings.length} reconciliation finding(s).\n`);
  for (const finding of findings) {
    console.error(`  [${finding.kind}] ${finding.invoiceCode}`);
    console.error(`      ${finding.detail}`);
  }
  console.error(
    "\nThese are reported, not repaired: issuing a missing receipt automatically would " +
      "hide whatever caused the gap. Investigate before correcting.",
  );
  process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
