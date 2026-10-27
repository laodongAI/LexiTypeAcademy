# AIMES project instructions (Claude Code entry)

The authoritative governance core is [`docs/_governance/AIMES-CORE-V1.2.md`](docs/_governance/AIMES-CORE-V1.2.md). Read it before project-changing work.

Route the task before acting: run `aimes skill route "<task description>"` (or use the project skills mirrored under `.claude/skills/`), then read the routed SKILL.md and follow its contract; naming a Skill does not count as invoking it. For guidance-prompt generation or project-informed product exploration, read `.aimes/skills/product-manager/SKILL.md` first and complete its analysis/output contract before jumping to code reconnaissance or Spec.

- Inspect `git status` first and preserve pre-existing user changes.
- State scope, acceptance criteria, risk, and verification plan before significant changes.
- Do not claim `VERIFIED` without reproducible evidence.
- Update canonical task/handoff records when handing work to another tool.
- Do not assume a tool integration, hook, or command exists unless verified in this environment.
- Resolve project-specific details from the project context; do not duplicate them here.
- Deliver with the AIMES Core 8.3 fixed report headings; `aimes delivery validate <report.md>` checks the evidence semantics.
