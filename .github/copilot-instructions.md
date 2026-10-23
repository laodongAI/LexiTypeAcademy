# Lexitype Academy 开发指南
> 本文件为项目全局上下文，所有 Copilot 交互均会自动包含此内容。请保持内容简洁、聚焦核心决策信息，避免上下文过载。

## 项目核心引用
- [产品愿景与功能定义](../PRODUCT.md)：项目的核心目标、功能模块、用户角色与学习流程。
- [系统架构与设计原则](../ARCHITECTURE.md)：技术栈选型、系统架构、核心链路、组件设计规范。
- [开发规范与最佳实践](../CONTRIBUTING.md)：代码风格、命名规范、性能要求、安全规范、文档与索引规则。
- [核心数据模型](../DATA_MODELS.md)：课程、句子、错误记录、用户进度等核心数据结构的 TypeScript 接口定义。
- [业务规则手册](../BUSINESS_RULES.md)：练习模式、错误分类、复习算法、提示层级等核心业务逻辑的详细规则。

## 1. 项目概述
Lexitype Academy 是一个基于 **Vue3+ TypeScript + Electron** 构建的 AI 辅助英语学习系统，支持桌面端运行。系统提供**听、说、读、写**全维度的学习功能，集成 **ASR（自动语音识别）、TTS（文本转语音）、语音评估、AI 对话教练** 等核心能力，打造自适应、游戏化、数据驱动的英语学习平台。

### 核心目标
- 构建**错误数据驱动**的自适应学习平台，动态生成复习内容与专项课程。
- 实现**内容类型 × 学习方式**的网状组合，支持单词、短语、句子、段落的多模式练习。
- 提供**可量化的成长曲线**，包括词汇、短语、语法结构的掌握度图谱。
- 支持**离线优先**的容错设计，确保弱网或断网环境下的学习体验。

### 关键术语
- **学习单元**：最小内容实体（词汇、短语、句子、段落）。
- **掌握度**：系统为某单元动态计算的评分（0–100）。
- **错误分类**：拼写、语义、语法、发音、听力识别、使用场景。
- **复习队列**：基于间隔算法（SM2 改良）+ 错误权重 + 遗忘曲线生成的练习列表。
- **CEFR**：欧洲共同语言参考标准（A1–C1），用于课程分级。
- **Shadowing**：影子跟读，核心口语练习模式。

## 2. 技术栈规范
Copilot 生成代码时，必须严格遵循以下技术栈选型，禁止使用未指定的技术或框架。

---
agent: development_assistant
---
Define the task to achieve: Build a high-performance, secure, maintainable desktop application with Vue 3 + Element Plus + Tailwind CSS frontend and Electron integration. Follow agile development methodology with full documentation traceability, establish a structured code indexing system to minimize AI token consumption, and enforce strict coding, performance, and security standards.

## Code Generation Rules

1.  **Language & Comments**:
    - All comments in the code must be written in **chinese**.
    - Ensure comments are clear, concise, and explain the "why" behind complex logic, not just the "what".
    - All generated files must include a standard header comment describing the file's purpose, main functionality, and key considerations.
    - Vue components and TypeScript functions must include detailed comments for props, parameters, return values, and exceptions.

2.  **Code Style**:
    - Strictly follow the existing project structure and enforced naming conventions.
    - Use TypeScript for all new logic files; Vue components must use `<script setup lang="ts">` syntax exclusively.
    - Prefer Vue 3 Composition API over Options API; no Options API is allowed for new components.
    - All Vue component props must use TypeScript interfaces for type safety; runtime-only validation is prohibited.
    - **Naming Conventions**:
      - Components: PascalCase (e.g., UserSettings.vue)
      - Composables: useCamelCase (e.g., useFileUpload.ts)
      - Electron Main Files: main_[function].ts (e.g., main_windowManager.ts)
      - Utilities: camelCase (e.g., formatDate.ts)
      - Interfaces: IPascalCase (e.g., IUserProfile.ts)
    - **Forbidden Patterns**:
      - Electron: `nodeIntegration: true`, `contextIsolation: false`
      - Vue: Global event listeners without cleanup, unbounded list rendering
      - IPC: Synchronous calls in renderer process, duplicate function implementations

3.  **Tech Stack**:
    - Frontend: Vue 3 (Composition API only), TypeScript 5.2+, Vite 5.0+, Element Plus v2.3.7+ (stable), Tailwind CSS v3.4.10+ (stable)
    - Desktop: Electron v28.2.0+ (LTS/stable, main/renderer separation with context isolation)
    - State Management: Pinia 2.1.7+ (replaces Vuex for better performance and TypeScript support)
    - Routing: Vue Router 4.2.5+
    - Build Tool: Vite with optimized plugins for Electron, Vue, and Tailwind CSS
    - Code Quality: ESLint + Prettier for mandatory code checks

4.  **Performance Requirements**:
    - **Vue-Specific Optimization**:
      - Use `v-memo` for lists with more than 50 items to reduce re-renders.
      - Virtualize large tables with Element Plus `ElTable` + `lazy-load` or `ElVirtualList`.
      - Debounce search and filter inputs with a minimum delay of 300ms.
      - Use `v-once` for static, non-reactive UI elements.
    - **Electron-Specific Optimization**:
      - Limit IPC payload size to less than 100KB; chunk large data transfers.
      - Avoid blocking the main process event loop; use async/await and `setImmediate` for heavy operations.
      - Lazy-load non-critical components (modals, charts) in the renderer process.
      - Explicitly destroy unused BrowserWindow instances with `destroy()` to reduce memory usage.
    - **General Requirements**:
      - All UI components must render in less than 80ms (95th percentile).
      - Electron application memory footprint must be less than 200MB in idle state.
      - Minimize bundle size through code splitting, tree shaking, and lazy loading.

5.  **Coding Standards**:
    - All generated code must pass ESLint and Prettier checks; no syntax errors, unused variables, or inconsistent formatting are allowed.
    - All code must be checked for calls to unimplemented methods and references to undefined variables before submission.
    - Ensure code logic is clear, readable, and free of logical errors; complex logic must be split into smaller functions with clear purposes.
    - No duplicate method or function names are allowed in the same file; duplicate functionality implementations across files are strictly prohibited.
    - Before implementing any new code, check the relevant code index files to ensure the same functionality has not already been defined.
    - All new or modified functions and methods must be recorded in the corresponding code index files; index entries must be concise and follow the standard format.
    - The `any` type is prohibited in TypeScript code, except for legacy integrations with documented justification.

6.  **Code Indexing System**:
    - A structured code indexing system is established to minimize AI token consumption and enable quick lookup of functionality; all index files are stored in `docs/code_index/` and use Markdown format.
    - **Index File Structure**:
      - `frontend.md`: Index of all Vue components, composables, utilities, routes, and assets.
      - `electron.md`: Index of all Electron main process modules, IPC handlers, and native integrations.
      - `shared.md`: Index of shared utilities, types, interfaces, and constants used across frontend and backend.
    - **Indexing Rules**:
      - All index entries must be concise, with a maximum of 80 words per entry; redundant details are strictly prohibited.
      - Never include full code snippets in index entries; only reference critical patterns and link to relevant documentation.
      - All developers must update the relevant index files before merging new or modified code; index entries must be updated before code changes are committed.
      - When deleting code files, the corresponding index entries must be removed before the file deletion is committed.
    - **Index Update Requirements**:
      - After completing any code implementation, the relevant code index files must be updated first to reflect the new or modified code.
      - Index entries must include the file path, core purpose, key functionality, and relevant performance or security considerations.
      - Index entries must follow the standard format to ensure consistency and readability.

7.  **Documentation**:
    - All generated documents must be saved in the `docs/` directory by category and use Markdown format for consistency.
    - **Documentation Structure**:
      - Requirements documents: Saved in `docs/requirements/`; organized by feature with unique `REQ-[MODULE]-[ID]` traceability IDs.
      - Design documents: Saved in `docs/design/`; include architecture diagrams, performance budgets, security design, and technical specifications.
      - Task documents: Saved in `docs/tasks/`; organized by sprint with `todo.md` (active tasks) and `completed.md` (completed tasks with benchmarks).
      - Knowledge base: Saved in `docs/knowledge/`; include security patterns, performance optimization techniques, anti-patterns, and decision logs.
      - Code indexes: Saved in `docs/code_index/`; include `frontend.md`, `electron.md`, and `shared.md` as described in the code indexing system.
    - **Documentation Rules**:
      - All requirements documents must include clear user stories, acceptance criteria, performance requirements, and security considerations.
      - All design documents must include performance budgets for each feature and link to the corresponding requirements documents.
      - All task documents must include clear links to requirements and design documents, and completed tasks must include actual performance metrics and lessons learned.
      - All documentation must be updated in a timely manner to reflect the latest project status; outdated documentation is strictly prohibited.
    - **Traceability Requirements**:
      - All design documents must link to the corresponding requirements documents using traceability IDs.
      - All task documents must link to the corresponding requirements and design documents.
      - All code index entries must link to the corresponding requirement IDs for full traceability.

## Task Management Rules

1.  **Agile Workflow**:
    - The project follows agile development methodology with 1-week sprints; all tasks are managed in the `docs/tasks/` directory by sprint.
    - **Before Starting Any Task**:
      1. Verify the corresponding requirement in `docs/requirements/` using the traceability ID.
      2. Review the design document and performance budget in `docs/design/`.
      3. Check all relevant code index files to understand existing implementations and avoid duplication.
      4. Create a task entry in the current sprint's `todo.md` file with the standard template, including requirement ID, design document link, performance budget, and security requirements.
    - **After Completing Any Task**:
      1. Update the relevant code index files first to reflect the new or modified code.
      2. Record the actual performance metrics in the sprint's `completed.md` file, including render time, memory usage, and security check results.
      3. Verify that the completed task is consistent with the corresponding requirement and that all acceptance criteria are met.
      4. Add 2-3 data-driven product improvement suggestions based on the implementation experience.
      5. Document any performance, security, or functionality trade-offs in the project knowledge base.

2.  **Task Documentation**:
    - All tasks must be saved in the `docs/tasks/` directory by sprint and use Markdown format.
    - Each sprint must have a `todo.md` file for active tasks and a `completed.md` file for completed tasks.
    - At the end of each sprint, the `todo.md` file must be updated to mark completed tasks, document the reasons for uncompleted tasks, and add new tasks for the next sprint.
    - All task entries must include clear links to the corresponding requirements and design documents to ensure full traceability.
    - Before creating a new task, check the existing task documents to ensure that the task does not already exist; duplicate tasks are strictly prohibited.
    - All completed tasks must include actual performance metrics, security check results, and lessons learned to facilitate continuous improvement.

3.  **Product Improvement Suggestions**:
    - After completing each task, the AI assistant must act as a product manager and provide 2-3 specific, data-driven product improvement suggestions.
    - The suggestions must be based on the implementation experience and relevant telemetry data, focusing on user experience, performance optimization, security enhancement, or maintainability improvement.
    - The suggestions must be added to the sprint's `completed.md` file and linked to the corresponding task for future reference.

## AI Interaction Optimization Rules

1.  **Index-First Policy**:
    - Before generating any new code or modifying existing code, the AI assistant must first check the relevant code index files to understand existing implementations and avoid duplication.
    - The AI assistant must report the findings from the index check before generating any code to ensure consistency with the existing codebase.

2.  **Granular File Access**:
    - When modifying existing files, the AI assistant must request only the specific sections of the file that need to be changed, rather than the entire file.
    - The AI assistant must never request entire files unless creating new files from scratch, to minimize token consumption.

3.  **Knowledge-Based Generation**:
    - The AI assistant must reference the project knowledge base for all performance, security, and coding standards, including electron security patterns, Vue performance optimization techniques, and project-specific anti-patterns.
    - The AI assistant must ensure that all generated code complies with the project's security and performance requirements by referencing the relevant knowledge base documents.

4.  **Token Budget Enforcement**:
    - The AI assistant must keep all responses under 500 tokens whenever possible, prioritizing critical code and logic over non-essential details.
    - The AI assistant must prefer links to documentation over long explanations to reduce token consumption and improve readability.
    - The AI assistant must omit code comments that duplicate information in the code index files to avoid redundancy and reduce token usage.

## Electron Security Rules

1.  **Renderer Process Isolation**:
    - The AI assistant must enforce strict renderer process isolation for all Electron windows, with `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false` set in the web preferences.
    - All Electron windows must use a preload script to expose only validated APIs to the renderer process; direct access to Node.js or Electron APIs from the renderer process is strictly prohibited.

2.  **IPC Sanitization**:
    - All IPC handlers in the main process must include mandatory input sanitization and validation, including path validation against an allowlist, parameter type checking, and data sanitization.
    - The AI assistant must ensure that all IPC communications follow the project's security pattern, with validated inputs and proper error handling to prevent security vulnerabilities.

3.  **Dependency Vetting**:
    - The AI assistant must ensure that all new npm packages are vetted for security vulnerabilities, including an `npm audit` report and a vulnerability assessment in the pull request description.
    - The AI assistant must prohibit the use of any packages with critical or high security vulnerabilities, as well as specific prohibited packages such as `electron-is-dev` and the `remote` module.