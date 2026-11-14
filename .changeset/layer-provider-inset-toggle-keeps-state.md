---
'@astryxdesign/core': patch
---

[fix] A nested LayerProvider whose `inset` changes between set and unset now keeps the state of everything inside it. Before, the change remounted the subtree, so typed input, scroll position and open layers were lost.

@FlogstaErik
