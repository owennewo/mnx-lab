<!-- Split out of CLAUDE.md; CLAUDE.md links here and keeps the rules that
     must hold in every session. Paths in prose are repo-root-relative. -->

# Worktrees: why the contract is shaped this way

The contract itself — take a worktree first, rebase, `--ff-only`, delete on completion —
is in CLAUDE.md. This is the reasoning behind it, for the moments when the rules look
like they could be bent.

## Why every session, including "small" changes

Sessions run concurrently and independently, so the primary checkout is shared
integration space rather than anyone's workspace. The asymmetry that settles the "is this
change small enough to skip it?" question is that **the cost of a collision is paid by
whoever discovers it, not whoever caused it** — an agent mid-task finds a dirty tree it
did not create, on a branch it did not choose, and has to reconstruct what happened
before it can do its own work. A one-line edit made directly on `main` is cheap for the
author and expensive for everyone else, which is exactly the trade the rule refuses.

Read-only sessions — answering questions, reading the roadmap, explaining code — change
nothing and need no worktree.

## Why outside the repo

Worktrees live at `~/dev/mnx-labs-worktrees/`, a sibling of the checkout rather than a
directory inside it, so that **nothing in the tree ever has to know they exist**: not
`.gitignore`, not the corpus police, not the boundary checker, not Vite's file watching,
not a glob in a harness script. An in-tree worktree would need every one of those to
learn an exclusion, and each exclusion is a place for a future bug to hide.

Worktrees do **not** share `node_modules`, hence the `npm ci` in the recipe.
`git worktree add` also does not populate submodules, so `vendor/mnx` starts empty; no
build requires it (the compare pane degrades with a warning), which is why populating it
is opt-in for spec-loop work rather than part of setup.

## Why the branch name is the collision guard

Git refuses to check out one branch in two worktrees. Naming the branch after the task —
the roadmap doc's slug where the work has one — turns that refusal into a free ownership
check: if `add` refuses, another agent already owns that task. The correct response is to
pick up something else, not to invent a variant name and work in parallel on the same
item.

## Why rebase, never merge

`main` stays linear so that the next agent's rebase is legible: a conflict resolves
against a single sequence of commits rather than a braid. `--ff-only` on the self-merge
is the enforcement — a refusal means `main` moved while the gates were running, so the
gates were run against a tree that no longer exists and the whole sequence has to run
again. That is the point of the refusal, not an obstacle to route around.

## Why goldens are regenerated rather than merged

A rebase can silently resurrect a stale golden: both sides of the conflict are valid
files, and a textual merge of two snapshot outputs produces a third that no code ever
emitted. Regeneration is the only trustworthy resolution — take either side wholesale,
run `npm run update:primitives`, and let `git diff -- scenarios/` be the verdict.

The related ban on hand-editing a `status:` or `verification:` block is stronger, and it
is not really about merging at all: those fields record **a human's assertion about
rendered output**. Editing one by hand fabricates that assertion, whatever the intent.
If a change really did move the output, `update:primitives` demotes the scenario and the
attention queue asks a human — which is the correct outcome, not a problem to work
around. See [corpus.md](corpus.md).

## Why removal precedes the roadmap move

The roadmap doc's move to `complete/` is the last commit of a work item, and it happens
in the primary checkout on `main`. Requiring the worktree to be gone first makes "no
worktree for this task exists" a **precondition** of writing that commit — a checkable
invariant rather than a habit that erodes. It also means the disk is a truthful index of
what is actually in flight.

A worktree stops being needed the moment the work is done *or* clearly unwanted —
abandoned, superseded, and turned-out-to-be-a-no-op all count, and all mean remove it
now. `worktree remove` refusing on a dirty tree is information: go look at what is
uncommitted before reaching for `--force`, because uncommitted work in an abandoned
worktree is usually the only copy. `branch -d` refusing (rather than `-D`, which is never
correct here) means the work is not on `main` yet.
