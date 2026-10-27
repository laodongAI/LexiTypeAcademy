# AIMES project instructions (Codex-compatible entry)

This file is a thin tool entry point. The authoritative governance core is [`docs/_governance/AIMES-CORE-V1.2.md`](docs/_governance/AIMES-CORE-V1.2.md).

Route the task before acting (必须遵守):
1. Run `aimes skill route "<task description>"` (or call the `aimes_skill_route` MCP tool) and read the routed `.aimes/skills/<name>/SKILL.md`; merely naming a Skill does not count as invoking it.
2. For requests to generate a guidance/development prompt or explore a product idea using project knowledge, read `.aimes/skills/product-manager/SKILL.md` first; analyze project knowledge before producing a full prompt, and do not jump straight to Spec or coding.

Before making changes:
1. Read the governance core and relevant project instructions.
2. Inspect `git status` and preserve all pre-existing user changes.
3. Identify task scope, acceptance criteria, risks, and verification commands.
4. Do not claim `VERIFIED` without reproducible evidence.
5. Record task status and cross-tool handoff in the project's canonical records.
6. If instructions conflict or tool capability is unknown, stop and report the conflict rather than guessing.

At delivery: write the report with AIMES Core 8.3 fixed headings and check it with `aimes delivery validate <report.md>`; `aimes hook install --type pre-commit` can enforce `aimes validate`/`docs check` at commit time.

This entry does not replace tool-native safety controls or project-specific instructions.
