# Requirement checklist and boundaries

This is a local educational demo. A green test or simulated scan is not proof of real biometric, financial, or security correctness. All money and payout integrations are simulated. The numbered items correspond to the 32-item list.

| # | Status in this build |
|---|---|
| 1 | **Partial for a demo.** Merchant approval is required and the payment endpoint always goes through a scan or explicit customer-side PIN fallback. However the demo scan is deliberately software-controlled, so it is not a secure palm check and must not authorize real payments. |
| 2 | Demo merchant selects a customer; simulated vectors are scored against active templates, with an adjustable cutoff and 0.05 runner-up margin. No real scanner or validated accuracy. |
| 3 | Server serializes requests and uses a stable key. Terminal retains the key and outcome in the same tab across reloads; the operator must re-enter the same details to retry after a lost response. A deliberate new payment uses a new key. |
| 4 | Charge confirmation and a printable browser receipt are provided. |
| 5 | Configurable admin per-payment and daily limits; the daily limit counts gross successful payments in Bangladesh time and is rechecked at completion. |
| 6 | **Updated behavior:** each customer controls Verification On/Off for all new demo payments, default On. On requires an approval code; Off requires no code. Pending requests retain their original rule. The previous admin threshold no longer applies. Codes expire in two minutes; decline and three wrong attempts cancel. This local web demo is not a mobile push notification. Turning Off reduces protection. |
| 7 | Four-digit PINs are hashed and hidden. After a failed simulated scan, merchant can request fallback; customer enters PIN privately. Fallback payments also need the code when Verification is On; when Off, PIN is still required. The demo does not protect against a compromised browser/server. |
| 8 | JWT subjects are strings; tests run with PyJWT 2.15.1. |
| 9 | `server/config.py` and environment overrides hold settings; random local key, debug off, restricted local CORS. |
| 10 | Basic SQLite-backed login throttling and an HttpOnly SameSite cookie replace JavaScript-readable tokens. Not production-grade abuse prevention or a complete CSRF/security audit. |
| 11 | Demo templates are encrypted with a locally stored key; this is not production key management. |
| 12 | Accounts are suspended rather than deleted, retaining history. |
| 13 | Integer-poisha fields drive balance calculations; paired append-only ledger entries accompany transfers. Old BDT REAL columns remain as compatibility/display mirrors. Migration creates an explicit opening-balance ledger entry, not a reconstructed historical ledger. Reset intentionally destroys demo data. |
| 14 | New timestamps have UTC offsets; legacy naive timestamps are displayed as UTC converted to browser local time. Reports group by Bangladesh time. |
| 15 | Simulated top-up method is stored and shown in customer history. |
| 16 | Failed scan events are recorded, three consecutive failures lock the account, and a settings/alerts screen lets admins review and unlock. Demo controls can be abused to lock a selected account; do not deploy publicly. |
| 17 | Re-enrollment deactivates prior templates; customer can consent and delete templates. Demo samples are synthetic. |
| 18 | Poor lighting is handled and reported separately before matching. |
| 19 | A scanner module has demo/real modes and adjustable cutoff. Real mode **fails closed** until a real scanner is implemented; it is not a working camera integration. |
| 20 | Full simulated refunds and unpaid bill cancellation. Partial refunds are not included. |
| 21 | Merchant balance and simulated payouts, with no bank connection. |
| 22 | Completed payments provide a Start new payment button, which clears the bill and form. |
| 23 | Invalid payment/top-up/bill amounts return errors; suspended or missing accounts are rejected rather than crashing. |
| 24 | **Partial.** Inline status panels, approval pop-ups and a responsive sidebar were added. Some old tables still need mobile and accessibility polish; there is no app-wide toast system. |
| 25 | **Partial.** A Bangla/English switch translates navigation only, not all forms, feedback, reports, or receipts. Full translation is still needed. |
| 26 | A bar chart with zero-filled days remains visible even for one day of activity. |
| 27 | Date range, failed-scan rate, average successful score, top merchants and CSV daily export. PDF export is not included; the requested CSV-or-PDF option is met with CSV. |
| 28 | Backend split into core, scanner, route and feature modules. |
| 29 | Automated tests cover earlier findings and new payment, security and money flows. Tests are not an independent security audit. |
| 30 | `start-demo.bat` starts both local services after installing dependencies; admin has an explicitly confirmed local reset. The batch file has not been tested on a Windows PC in this environment. |
| 31 | **Not done.** No public hosting account, approved hosting target, or live deployment was supplied. Public deployment of this intentionally insecure simulator would be unsafe. |
| 32 | Architecture and payment-flow Mermaid diagrams are in `README.md`. |

## Verification preference update

The customer dashboard saves an account-specific On/Off setting. New and migrated accounts default to On. On requires a code for every new payment regardless of amount; Off suppresses the code for new payments only. Existing pending requests and idempotent retries keep their original rule. The old admin threshold is retained in storage for compatibility but is inactive and hidden. This is an intentionally insecure local demo; never use real money or biometrics.
