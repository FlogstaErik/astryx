---
'@astryxdesign/core': patch
---

[fix] useImperativeDialog now applies only the options of the latest `show()` call, on top of the current `defaultOptions`. Before, options from an earlier call stayed in effect, and a later change to `defaultOptions` was ignored.

@FlogstaErik
