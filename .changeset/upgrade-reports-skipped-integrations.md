---
'@astryxdesign/cli': patch
---

[fix] `astryx upgrade` now reports an integration whose codemods cannot be loaded. It prints a warning naming the integration, and the `--json` result lists it under `skippedIntegrations`. Before, the upgrade skipped those migrations without any report in `--json` mode.

@FlogstaErik
