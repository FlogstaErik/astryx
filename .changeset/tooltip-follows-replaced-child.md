---
'@astryxdesign/core': patch
---

[fix] A Tooltip around an element now follows that element when it is replaced, including when a child component swaps its own root element. The tooltip also keeps its `aria-describedby` reference when the child re-renders with a new `aria-describedby`, and removes only its own reference when it detaches.

@FlogstaErik
