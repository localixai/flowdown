# Changesets

Every change a user of `@localix/flowdown` would notice comes with a changeset: `bun run changeset`,
pick the bump, and write one or two sentences for the person upgrading — what they can now do, or
what they must change. Refactors, tests and docs need none.

Versions follow semver. Before 1.0, a breaking change is a minor bump (`0.x.0`) and says in the
changeset what to change; after 1.0 it is a major one.
