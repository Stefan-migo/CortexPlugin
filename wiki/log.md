# Wiki Log

> **ARCHIVED**: Memory now lives in Engram (`.engram/engram.db`).
> This file is maintained by `scripts/engram-export-wiki.sh` at session end.
> Do NOT write entries directly — `mem_save` to Engram instead, then export.

Entries are prefixed with date for grep-parseability.

---

## [2026-05-01] init | Cortex Wiki Created
Initialized the Cortex wiki structure. Created index.md, log.md, and subdirectories.

## [2026-05-01] install | Graphify + GSD
Installed Graphify (graph extraction, 25 tree-sitter parsers) and GSD (65 commands, 33 subagents) as companion CLI tools. Updated USER-GUIDE.md with full GSD workflow documentation.

## [2026-05-01] docs | SYSTEM-MAP + Self-Maintenance
Added SYSTEM-MAP.md with visual architecture, component-by-component usage guide, and quick reference card.
Updated AGENTS.md with Self-Maintenance section: toolkit summary, proactive behavior rules, and maintenance schedule.

## [2026-05-01] install | Planning with Files
Installed Planning with Files (context discipline skill). Adds 3-file pattern, pre/post tool hooks, and completion verification. Integrated into SYSTEM-MAP.md, AGENTS.md, and Quick Reference Card. ECC excluded to avoid agent/command conflicts with GSD.

## [2026-05-01] feature | Bootstrap + Template System
Added bootstrap skill (.opencode/skills/bootstrap/SKILL.md) for self-adaptation. Added scripts/setup.sh for CLI initialization. Updated AGENTS.md with System Overview table and proactive bootstrap triggers. The template can now be cloned and adapted for any new project.

## [2026-05-01] docs | README.md
Created comprehensive README.md for the Cortex repository. Includes quick start, architecture diagram, capability matrix, component deep-dive, bootstrap workflow, daily workflow, and community documentation.

## [2026-05-01] feature | Intelligent Bootstrap
Rewrote bootstrap skill as 5-phase workflow: Discover → Research → Synthesize → Generate → Launch. Created /new-project command. Bootstrap now asks structured questions, spawns @researcher for internet research on tech stack/industry/competitors, analyzes reference URLs, and proposes a tailored project plan before generating files.
 
## [2026-05-01] ops | Install script + README clarity
Created scripts/install-deps.sh — one-command setup for Graphify, Planning with Files global install, and tool dependencies. Updated README with clear "already in repo vs needs install" table so users know exactly what to expect after cloning.

## [2026-05-01] feature | Professional Agent Team + Smart Bootstrap
Complete bootstrap rewrite: 5-phase intelligent system with pre-flight check, deep research, and agent team architecture. Created 6 role-based agent templates (backend, frontend, database, security, devops, qa). Bootstrap now creates custom primary agents ({ProjectName}Build, {ProjectName}Plan) and specialized subagent teams. Suggests MCP servers, skills, and tools based on project stack and domain.

## [2026-05-08] export | Engram snapshot exported to wiki/engram/
Session memory synced to Obsidian-readable markdown.

## [2026-05-08] export | Engram snapshot exported to wiki/engram/
Session memory synced at 2026-05-08 01:38:11

## [2026-05-08] export | Engram snapshot exported to wiki/engram/
Session memory synced at 2026-05-08 15:01:59
