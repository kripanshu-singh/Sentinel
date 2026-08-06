Restarting 'src/index.ts'
[server] Starting Sentinel worker bootstrap...
{
  severity_local: 'NOTICE',
  severity: 'NOTICE',
  code: '42P07',
  message: 'relation "runs" already exists, skipping',
  file: 'parse_utilcmd.c',
  line: '207',
  routine: 'transformCreateStmt'
}
{
  severity_local: 'NOTICE',
  severity: 'NOTICE',
  code: '42P07',
  message: 'relation "agent_events" already exists, skipping',
  file: 'parse_utilcmd.c',
  line: '207',
  routine: 'transformCreateStmt'
}
{
  severity_local: 'NOTICE',
  severity: 'NOTICE',
  code: '42P07',
  message: 'relation "approval_requests" already exists, skipping',
  file: 'parse_utilcmd.c',
  line: '207',
  routine: 'transformCreateStmt'
}
{
  severity_local: 'NOTICE',
  severity: 'NOTICE',
  code: '42P07',
  message: 'relation "reconciliation_reports" already exists, skipping',
  file: 'parse_utilcmd.c',
  line: '207',
  routine: 'transformCreateStmt'
}
[db] Schema check complete
[queue] Background task worker listening for runs
[server] Worker is listening at http://localhost:3001
[queue] Processing run job PRQ-5BSYTW
[runner:PRQ-5BSYTW] Transitioned to state: PARSED
[llm] using Gemini provider
[runner:PRQ-5BSYTW] Transitioned to state: FAILED
[queue] Job 7 completed successfully
[queue] Processing run job PRQ-RDIF5Q
[runner:PRQ-RDIF5Q] Transitioned to state: PARSED
[runner:PRQ-RDIF5Q] Transitioned to state: FAILED
[queue] Job 8 completed successfully
[queue] Processing run job PRQ-LGG5SJ
[runner:PRQ-LGG5SJ] Transitioned to state: PARSED
[runner:PRQ-LGG5SJ] Transitioned to state: NAVIGATING
[runner:PRQ-LGG5SJ] Executing step: search - Search for Almond Milk
[runner:PRQ-LGG5SJ] Run crashed: page.waitForSelector: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('input[type="search"], input[name="q"], input[placeholder*="Search" i]') to be visible

    at Navigator.search (/Users/home/Desktop/Sentinel/worker/src/agent/navigator.ts:43:16)
    at AgentRunner.run (/Users/home/Desktop/Sentinel/worker/src/agent/runner.ts:134:34)
    at async Worker.import_bullmq.Worker.connection.url (/Users/home/Desktop/Sentinel/worker/src/queue/jobs.ts:35:7)
    at async /Users/home/Desktop/Sentinel/worker/node_modules/bullmq/dist/cjs/classes/worker.js:612:32 {
  log: [
    `  - waiting for locator('input[type="search"], input[name="q"], input[placeholder*="Search" i]') to be visible`
  ],
  name: 'TimeoutError'
}
[runner:PRQ-LGG5SJ] Transitioned to state: FAILED
[queue] Job 9 completed successfully
