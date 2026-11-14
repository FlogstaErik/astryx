---
'@astryxdesign/core': patch
---

[fix] A Button with `tooltip=""` no longer adds an `aria-describedby` reference to a tooltip that does not render, so screen readers read the caller's own description only.

@FlogstaErik
