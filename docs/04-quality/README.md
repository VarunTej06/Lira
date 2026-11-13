# Quality

| Document | Purpose |
|---|---|
| [`definition-of-done.md`](definition-of-done.md) | What "done" means for a change |
| [`ai-code-review-checklist.md`](ai-code-review-checklist.md) | Review checklist aimed at the typical weaknesses of AI-generated code ("slop") |
| [`test-strategy.md`](test-strategy.md) | What is tested where, and how tenant isolation is proved |
| [`baseline-metrics.md`](baseline-metrics.md) | Measured quality on 9 Nov 2026 (the numbers to improve and not worsen) |
| [`manual-test-checklist.md`](manual-test-checklist.md) | Everything to click through by hand after the refactor, screen by screen |
| [`doc-freshness.md`](doc-freshness.md) | Which document owns which fact, and how to keep them true |

Principle: AI assistants speed up writing code, not the responsibility for it. "Vibe coding" (accepting generated code without reading it) is fine for a throw-away prototype and not for an enterprise application. The remedy is not to avoid AI but to **review small diffs, delete aggressively, and measure**.
