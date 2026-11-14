# PalmPay test report

## Summary

The following checks were run in an isolated Linux environment with Python 3.13.15 and Node.js 24.22.1. Only simulated data was used.

| Suite | Result | Scope |
| --- | --- | --- |
| Backend combined suite | 30 passed, 0 failed | 15 existing API/integration tests and 15 newly added unit tests |
| Frontend API-wrapper unit tests | 8 passed, 0 failed | Newly added tests using mocked browser storage and network responses |
| Frontend build | Passed | Vite production build; a large-bundle warning was emitted |

Backend statement coverage for the combined suite was 85% (688 statements, 105 missed). This includes both the original integration tests and the new unit tests; it is not branch coverage or a security guarantee. Coverage of bills and transaction history was lower than the total. Some existing tests emitted SQLite unclosed-connection ResourceWarnings, although the suite passed.

## New test files

- `server/tests/test_units.py`: amount validation and poisha conversion; vector generation, averaging and similarity; template encryption; simulated scanner modes; and real-scanner fail-closed behavior.
- `client/tests/api.test.mjs`: session storage, login and confirmation request construction, API errors and network failures. Uses Node's built-in test runner; no additional test package is required.

## Run on Windows

Open Command Prompt in the extracted `palmpay` folder. Install Python 3.10 or later and Node.js (the frontend tests were verified on Node 24).

Backend (includes both existing and new tests):

```bat
cd server
py -m venv venv
venv\Scripts\activate.bat
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
```

In a second Command Prompt, from the extracted `palmpay` folder, run the frontend unit tests:

```bat
cd client
node --test tests/api.test.mjs
```

Optionally build the frontend:

```bat
npm ci
npm run build
```

## Limitations and next steps

These tests do not test React components in a browser, real scanner hardware, liveness detection, real biometric data, real payment providers, concurrency under load, or deployment. Tests were not run on Windows. Passing tests and coverage do not prove the app is secure or production-ready. Add browser/UI tests, financial retry and concurrency tests, authentication/security tests, and hardware-adapter tests as those components are developed. Continue using this build only as a local simulation.

This package adds tests and this report; it does not change the application source. The test run created local files during execution, but generated keys, databases, dependencies, build outputs and coverage data are not included in the ZIP.
