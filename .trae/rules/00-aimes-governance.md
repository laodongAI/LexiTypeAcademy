# AIMES governance rule for Trae Code

Authoritative governance core: `docs/_governance/AIMES-CORE-V1.2.md`. Confirm this rule is loaded by the installed Trae Code version before relying on it.

Route the task before acting: run `aimes skill route "<task description>"`, then read the routed `.aimes/skills/<name>/SKILL.md` and follow its contract; naming a Skill does not count as invoking it. For requests to generate a guidance/development prompt or deepen a product idea from project knowledge, first read `.aimes/skills/product-manager/SKILL.md`, analyze current project knowledge and only then produce the full prompt. Do not jump straight to code reconnaissance or Spec.

- Inspect repository state before edits; preserve user changes.
- Establish scope, acceptance criteria, risk and verification plan.
- Use project-defined commands; do not invent commands.
- Record evidence for verification; do not infer success from intent.
- Keep task/handoff state in canonical repository records.
- Deliver with AIMES Core 8.3 fixed report headings (`aimes delivery validate <report.md>` checks them).
- If this rule is not loaded or conflicts with another instruction, report it.
