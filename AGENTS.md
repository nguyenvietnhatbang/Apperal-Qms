# AGENTS.md

## Purpose

This file is the shared instruction entry point for every agent working in this repository.

Detailed rules should not live directly in this file. Instead, agents must read and use the skills in:

```txt
skills/
  dtm-*/SKILL.md
```

The goal is to keep one reusable skill set that can be shared across multiple agents without copying the same long rules into every agent configuration.

---

## Required Workflow

Before starting work:

1. Read `AGENTS.md`.
2. Identify the type of task requested by the user.
3. Select the relevant skills from `skills/`.
4. Read the full `SKILL.md` file for each selected skill before editing code.
5. Follow the selected skills while still prioritizing the user's direct request.

If the agent supports invoking skills with `$skill-name`, use that syntax.

If the agent does not support direct skill invocation, open:

```txt
skills/<skill-name>/SKILL.md
```

and follow the instructions manually.

Do not skip a skill when the task clearly falls within that skill's scope.

---

## Foundation Skills

For most software development tasks, start with these foundation skills:

```txt
skills/dtm-core-principles/SKILL.md
skills/dtm-project-context/SKILL.md
skills/dtm-codebase-review/SKILL.md
```

Use them when you need to:

* Maintain production-quality standards
* Understand the project domain correctly
* Read existing code before changing it
* Avoid introducing architecture or patterns that do not fit the repo

---

## Select Skills By Task Type

### Project Structure And Framework

Use these when creating files, moving files, adding pages, adding route handlers, or organizing modules:

```txt
skills/dtm-tech-framework/SKILL.md
skills/dtm-app-router-structure/SKILL.md
skills/dtm-code-style/SKILL.md
skills/dtm-dependencies/SKILL.md
```

Quick reminders:

* This project uses Next.js App Router.
* Prefer the root-level `app/` convention.
* Do not introduce the legacy `pages/` router unless there is an explicit migration request.
* API routes should use `app/api/[resource]/route.ts`.

### API, Services, And Database

Use these when writing or changing APIs, service layers, queries, schemas, transactions, validation, or security-sensitive code:

```txt
skills/dtm-api-services/SKILL.md
skills/dtm-business-logic/SKILL.md
skills/dtm-validation/SKILL.md
skills/dtm-data-persistence/SKILL.md
skills/dtm-security/SKILL.md
```

Quick reminders:

* Keep route handlers thin.
* Put business logic in the appropriate service, domain, or lib module.
* Validate input on the backend.
* Optimize queries for PostgreSQL.
* Avoid `SELECT *`, avoid N+1 queries, and implement pagination, filtering, searching, and sorting at the database level.
* Do not expose secrets, tokens, connection strings, or internal errors.

### Admin Screens, Data Tables, And CRUD

Use these when building management pages, tables, internal dashboards, CRUD flows, search, filters, sorting, or pagination:

```txt
skills/dtm-screen-structure/SKILL.md
skills/dtm-ui-ux/SKILL.md
skills/dtm-component-design/SKILL.md
skills/dtm-search-filtering/SKILL.md
skills/dtm-data-presentation/SKILL.md
skills/dtm-dialog-detail/SKILL.md
skills/dtm-forms/SKILL.md
```

Quick reminders:

* Data screens must include search, filters, sorting, and pagination.
* Management tables should include View, Create, Edit, and Delete when appropriate.
* Always handle loading, empty, and error states.
* UI should be compact, clear, enterprise-style, and optimized for repeated work.
* Components should be small, focused, and reusable.

### Import, Export, Workflow, And Business States

Use these when implementing data processing, CSV/Excel/JSON, workflows, statuses, approve/reject/archive flows, or state transitions:

```txt
skills/dtm-import-export/SKILL.md
skills/dtm-workflow-state/SKILL.md
skills/dtm-business-logic/SKILL.md
skills/dtm-validation/SKILL.md
```

Quick reminders:

* Separate input, validation, transformation, processing, and output.
* Workflows must use explicit states.
* Destructive or irreversible actions must require confirmation.
* Workflow restrictions must be enforced on the backend, not only in the UI.

### Testing And Final Review

Use these before finishing a task or when changing important logic:

```txt
skills/dtm-testing/SKILL.md
skills/dtm-output-rules/SKILL.md
skills/dtm-final-check/SKILL.md
```

Quick reminders:

* Prioritize tests for business logic, validation, CRUD, critical workflows, security-sensitive behavior, data processing, integrations, and PostgreSQL queries.
* Before finishing, check architecture, validation, security, pagination, search/filter behavior, loading/empty/error states, dependency choices, and maintainability.
* If tests or verification could not be run, say so clearly.

---

## Domain Documentation

When a task relates to CRM, consulting services, commerce, inventory, purchasing, sales, receivables, projects, or reporting, also read:

```txt
docs/huongdan.md
```

This document describes the core business domain and should be used to understand the data flow before designing schemas, APIs, or UI.

---

## Combining Multiple Skills

A task may require multiple skills. Select the smallest set of skills that fully covers the work.

Examples:

* Add a customer list API:
  * `dtm-codebase-review`
  * `dtm-app-router-structure`
  * `dtm-api-services`
  * `dtm-validation`
  * `dtm-data-persistence`
  * `dtm-security`
  * `dtm-testing`

* Add a customer management screen:
  * `dtm-codebase-review`
  * `dtm-screen-structure`
  * `dtm-ui-ux`
  * `dtm-component-design`
  * `dtm-search-filtering`
  * `dtm-data-presentation`
  * `dtm-forms`
  * `dtm-final-check`

* Add Excel import:
  * `dtm-import-export`
  * `dtm-validation`
  * `dtm-api-services`
  * `dtm-data-persistence`
  * `dtm-security`
  * `dtm-testing`

---

## Instruction Conflicts

Priority order:

1. The user's direct request in the current conversation.
2. Safety, security, and data-loss prevention rules.
3. The specific skills in `skills/`.
4. `AGENTS.md`.
5. Existing codebase patterns.

If a skill and the current codebase differ, prefer the existing codebase pattern unless the skill describes a convention the user explicitly asked to apply.

If unsure, read more relevant code first. Ask the user only when the decision is high-risk or cannot be inferred safely from the repository.

---

## Updating Guidelines

Do not add long detailed rules back into `AGENTS.md`.

When detailed guidance needs to change:

1. Update the relevant skill in `skills/<skill-name>/SKILL.md`.
2. Update `skills/<skill-name>/agents/openai.yaml` if the display name or skill description changes.
3. Keep `AGENTS.md` as a concise routing file.

When a new rule category is needed, create a new skill in:

```txt
skills/<skill-name>/
  SKILL.md
  agents/openai.yaml
```

Skill names should use lowercase hyphen-case.

---

## Final Checklist

Before the final response:

* Were the relevant skills read?
* Was the related existing code inspected?
* Does the work follow Next.js App Router?
* Are UI, API, business logic, and persistence separated appropriately?
* Are API queries optimized for PostgreSQL?
* Are external inputs validated and handled securely?
* Do table UIs include search, filters, sorting, pagination, loading, empty, and error states when needed?
* Were appropriate tests or verification run?
* Is any unverified work or remaining risk clearly reported?

