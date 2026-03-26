## Purpose

This file defines the mandatory operating rules for any AI agent working in this repository.
Follow these rules before planning, coding, editing, testing, reviewing, committing, or answering.

## Priority Order

1. Explicit user instruction
2. `.specify/memory/constitution.md` / project principles (constitution)
3. This `AGENTS.md`
4. Existing codebase conventions

If rules conflict, follow the highest priority and state the conflict briefly.

## Core Rules

* All repository content—code, documentation, comments, configuration, and any other file or artifact—MUST be written in English.
* Reason only from the codebase, active specs, constitution, and verified facts
* Never guess missing requirements, behaviors, APIs, or architecture
* If context is missing: say it, inspect the repo/specs/available tools, then proceed
* Be deterministic, explicit, and concise
* Prefer minimal changes with maximum correctness
* Do not bypass defined architecture, patterns, or boundaries
* Production-ready only: no placeholder logic, fake implementations, or silent hacks

## Source of Truth

When SDD/Speckit is present, always treat these artifacts as authoritative:

* active spec
* tasks / phases / checklists from SDD
* `constitution` as source of truth for stack, architecture, patterns, constraints, naming, and decisions

Never invent rules outside these artifacts when they already define the answer.

## Required Workflow

1. Detect available MCP/tools and prefer them first
2. Identify active spec and current SDD phase
3. Read `constitution` and obey project standards
4. Inspect relevant code before proposing changes
5. Plan only from verified context
6. Write/adjust tests first
7. Implement the smallest correct change
8. Run validations
9. Report what changed, what was validated, and any remaining risk

## SDD Enforcement

* Always follow the SDD flow defined in the project
* Do not jump straight to implementation without an active spec/task context
* If spec/task is missing, incomplete, or conflicting, stop implementation and surface the gap
* Do not create ad-hoc behavior outside the spec unless explicitly requested
* Keep implementation aligned with spec language, acceptance criteria, and constraints
* Only skips SDD if the user has explicitly requested it

## Code Standards

* SOLID, DRY, simple over clever
* explicit types where the language supports them
* proper error handling, no swallowed exceptions
* modular, readable, maintainable code
* preserve architectural boundaries
* prefer existing project patterns over personal preference
* avoid unnecessary dependencies, abstractions, or rewrites
* keep public APIs stable unless the spec requires change

## Editing Rules

* change only what is necessary for the task
* do not perform unrelated refactors
* do not rename/move files unless required
* do not introduce breaking changes without stating them
* preserve comments/docs unless they became wrong
* update docs/tests/config when the change requires it

## Tooling Policy

* Always check available MCP servers/tools before any lookup
* Prefer MCP/tool results over memory
* Prefer repo inspection over external assumptions
* Use external docs/web only when the repo/spec/constitution/tooling is insufficient or explicitly required

## Git / Change Hygiene

* Only commit when the user has explicitly requested it
* Use Conventional Commits
* `feat` for commits, `feature/` for branches
* `fix`
* `chore`
* `enhance`
* Each commit must be atomic, coherent, and traceable
* Group changes by solution, concern, or code area
* Never mix unrelated changes in the same commit
* If one file contains changes for different solutions, split and commit them separately
* A file is not the unit of a commit; the logical change is
* Commit by intent, not by proximity
* Keep each commit focused on a single purpose that can be reviewed, understood, and reverted safely
* Stage changes selectively to preserve commit boundaries
* Prefer multiple small commits over one mixed commit when the changes solve different problems
* Commit messages must describe the real logical change
* Do not bundle refactor, fix, test, and feature work together unless they are inseparable parts of the same change

### Commit Boundary Rules

* One solution/problem = one commit
* One concern/area = one commit
* One independent refactor = one commit
* Tests should be committed with the change they validate, unless there is a clear reason to split
* If a change can be reverted independently, it should usually be its own commit

## Communication Rules

* State assumptions explicitly
* State blockers clearly
* State conflicts between spec, constitution, and code
* Do not present guesses as facts
* Do not say something is done if it was not validated

## Forbidden Behavior

* guessing missing context
* ignoring SDD/spec/constitution
* skipping validation and claiming success
* using patterns that violate the project architecture
* making hidden breaking changes
* adding speculative code for “future use”

## Self-Improvement

This file is a living standard and must be updated when new durable lessons appear.

Update `AGENTS.md` when:

* the user corrects an agent decision and wants that mistake prevented in the future
* a repeated failure pattern is identified
* a better repo-wide rule improves consistency
* a missing rule caused ambiguity or bad output

Update rules:

* add only durable, reusable rules
* keep rules short, imperative, and tool-agnostic
* avoid project-specific noise that belongs in `constitution`
* do not add temporary or one-off instructions
* prefer tightening an existing rule over creating duplicates
* preserve low token cost and high clarity

When a new lesson is found:

1. identify the root decision failure
2. convert it into a generic rule
3. place it in the smallest correct section
4. avoid redundancy
5. keep the file compact

# Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-19

## Active Technologies

- JavaScript (ES2020+), HTML5, CSS3 — no mandatory TypeScript/build in the MVP. + **SortableJS** (only optional JS dependency, local copy); Chrome APIs (MV3). (001-chrome-ai-usage-tracker)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

JavaScript (ES2020+), HTML5, CSS3 — no mandatory TypeScript/build in the MVP: follow standard conventions

## Recent Changes

- 001-chrome-ai-usage-tracker: Added JavaScript (ES2020+), HTML5, CSS3 — no mandatory TypeScript/build in the MVP. + **SortableJS** (only optional JS dependency, local copy); Chrome APIs (MV3).
