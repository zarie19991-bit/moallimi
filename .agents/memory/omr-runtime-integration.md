---
name: OMR runtime integration boundary
description: Preserve newer upstream features when integrating verified OMR changes; distinguish local profile fixtures from original authentication.
---

Integrate verified OMR development patches three-way against their supplied
deployed-source baseline and the newest upstream source; do not replace newer
production modules wholesale.

**Why:** Upstream has independent bank-content validation and option-balancing
improvements absent from the older supplied deployed export. A wholesale copy
would silently undo them.

**How to apply:** Keep newer upstream behavior and test deployment-path modules,
not only the isolated development copies. Local teacher-profile fixtures do not
prove the separately deployed authentication function, and local repaired SQL
grants do not prove original production ACL equivalence.
