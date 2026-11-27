# PalmPay test report — verification toggle update

## Local verification results

Tests were run with synthetic data in an isolated Linux environment, with Python 3.13 and Node.js 24. The updated package includes:

| Check | Result | Scope |
| --- | --- | --- |
| Backend automated suite | 42 passed, 0 failed | Existing tests plus seven customer-verification tests |
| Frontend API-wrapper tests | 9 passed, 0 failed | Includes verification GET and PUT request construction |
| Frontend build | Passed | Vite emitted a large-bundle warning |
| Two-session browser smoke test | Passed | Default On: small payment requires and accepts a code. Off: setting persists after reload and a larger payment completes without a code. On can be restored. |

Backend tests cover customer-only access and input validation, different customers' independent settings, default and migrated database behavior, small and large payments with verification On, Off payments and duplicate retries, pending requests retaining their original rules, PIN fallback when Off, and reset restoring the default. The older threshold-based payment tests were updated to choose the required On/Off state explicitly. No coverage percentage was measured for this build.

## Run tests

From an extracted project folder on Windows, install Python 3.10+ and Node.js, then open a Command Prompt:

```bat
cd server
py -m venv venv
venv\Scripts\activate.bat
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

In another Command Prompt from the project folder:

```bat
cd client
node --test tests/api.test.mjs
npm ci
npm run build
```

## Limitations

Testing does not prove production security, biometric accuracy, or payment compliance. Real hardware, real payment providers, a production deployment, accessibility, and Windows execution were not tested. The local scanner and financial flows are simulations; use only synthetic data and do not deploy the demo publicly. Turning Verification Off makes simulated payments easier to authorize without customer approval.
