# App 7 — Error Scenario Targets
Simulates various HTTP error and timeout scenarios.
Port: 3016
Endpoints:
- /always-404 : Returns HTTP 404
- /always-500 : Returns HTTP 500
- /timeout : Hangs for 60 seconds
- /flaky : 500 for first 3 calls, then 200
- /reset-flaky : Reset flaky counter
