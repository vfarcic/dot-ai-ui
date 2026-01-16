**Towncrier Release Notes Infrastructure**

Release notes now contain meaningful descriptions of what changed and why, instead of just artifact versions. The release workflow uses towncrier to collect changelog fragments that accumulate as features merge, then combines them into rich release notes when a version is published.

Release timing is now controlled—releases happen when maintainers push a version tag or trigger the workflow manually, not automatically on every merge to main. The release workflow supports two modes: full releases publish all artifacts with generated notes, while notes-only mode updates release descriptions without republishing artifacts.
