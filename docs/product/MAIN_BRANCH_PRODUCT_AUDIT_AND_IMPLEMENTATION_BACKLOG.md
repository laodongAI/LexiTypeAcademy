# 主干产品与实现专项审计及改进清单

> 审计对象：`laodongAI/LexiTypeAcademy` 的 `main` 分支。  
> 基线提交：`e37526ec927b00cd26bf7146ac0439137c2614c3`（2026-10-24）。  
> 本轮首个代码修复提交：`82be5efd6741ad45e437a0d67c6d1fa27a890fc7`。  
> 审计方式：GitHub 主干文件静态审查、路由/Skill/工作流/任务记录交叉核对；不把历史记录中的测试结果当成本轮重新执行的证据。  
> 状态约定：`CONFIRMED_CODE` = 当前代码可直接确认；`IMPLEMENTED_UNVERIFIED` = 已实现但缺运行验收；`FIXED_PENDING_CI` = 本轮已修复、待 CI 与运行验证；`NOT_RUN` = 本轮未执行。

## 1. 执行摘要

当前产品已经超出早期原型：主干包含真实学习看板、课程/课时恢复、学习计划、课程集合关系、教材生成断点、TTS/ASR 后端、AI Provider 代理，以及 AI 教学/英语面试共享对话页面。不能再把旧基线中已修复的固定统计、虚构课程、错误首页路由等问题当作当前缺陷。

当前主要风险集中在：

1. **教材生成的增补正确性**：既有内容类型的识别依赖课时标题正则；旧规则把“课文/对话”宽泛地当作“句子”，可能错误地跳过应新增的内容类型。
2. **生成过程可恢复性**：断点、生成草稿、用户变更生成配置、预览和保存之间需要明确的恢复/保留语义；浏览器刷新与重启验收尚缺。
3. **核心学习闭环的运行证据**：首页恢复、计划持久化、跨页进度一致性、后端不可用时的状态和 Windows 实机行为仍有未验证项。
4. **课堂与内容类型契约**：不同内容类型要使用适合的学习方法；当前枚举只有 Word/Phrase/Sentence/Passage/Dialog，语法与 phonics 等教学类型不能仅靠相似的内容形态完整表达。
5. **AIMES Skill 治理**：相关 Skill 文件和注册表存在，但多个 Skill 的验证状态为 UNKNOWN；文件存在/被本次读取不等于目标 AI 工具运行时自动路由成功。
6. **测试证据覆盖**：后端有 pytest 与 GitHub Actions；前端 workflow 执行 typecheck/build，但仓库中没有与当前 Vue 页面相匹配的前端单元/E2E 测试目录证据。构建通过不能替代真实浏览器、音频和数据恢复验收。

## 2. 本轮核对的代码与治理资产

### 2.1 页面、服务与路由

- 首页：`frontend/src/renderer/views/HomePage.vue`
- 学习看板：`frontend/src/shared/services/learningDashboardService.ts`
- 教材生成：`frontend/src/renderer/components/ai/TextbookImportPanel.vue`
- 中文生成：`frontend/src/renderer/components/ai/CourseGeneratorPanel.vue`、`frontend/src/renderer/services/courseGenerationService.ts`
- 课程仓库：`frontend/src/renderer/views/CourseRepositoryPage.vue`
- 沉浸式课堂：`frontend/src/renderer/views/ClassroomPage.vue`
- 单元学习：`frontend/src/renderer/views/UnitLearningPage.vue`
- AI 教学/英语面试：`frontend/src/renderer/views/ConversationPage.vue`
- 路由：`frontend/src/renderer/router/index.ts`
- 内容模型：`frontend/src/shared/types/course.ts`

### 2.2 AIMES 与产品治理

- 规则入口：`AGENTS.md`、`CLAUDE.md`、`.trae/rules/00-aimes-governance.md`
- 工具配置：`.aimes/config.yaml`、`.aimes/manifest.json`、`.aimes/tool-capabilities.yaml`
- Skill 注册表：`.aimes/skills/registry.yaml`
- 本任务相关 Skill：
  - `.aimes/skills/product-manager/SKILL.md`
  - `.aimes/skills/market-analysis/SKILL.md`
  - `.aimes/skills/requirement-cognition/SKILL.md`
  - `.aimes/skills/ui-quality-review/SKILL.md`
  - `.aimes/skills/ui-implementation-validation/SKILL.md`
  - `.aimes/skills/design-system-governance/SKILL.md`
  - `.aimes/skills/controlled-implementation/SKILL.md`
  - `.aimes/skills/requirement-driven-testing/SKILL.md`

`product-manager/SKILL.md` 已在本轮实际读取并作为产品分析工作流使用；其头部状态为 `PROPOSED`。注册表中相关 Skill 的 `validation_status` 多为 `UNKNOWN`、`evidence: []`。因此本次可以确认“Skill 文本被读取并执行了相应分析步骤”，但不能确认 IDE/CLI 会自动加载或按触发条件自动编排这些 Skill。

### 2.3 测试与 CI 证据

- 前端命令：`frontend/package.json` 中有 `npm run typecheck`、`npm run build`、`npm run lint`。
- 前端工作流：`.github/workflows/frontend-quality.yml`，执行 `npm ci`、`npm run typecheck`、`npm run build`。
- 后端工作流：`.github/workflows/backend-quality.yml`，执行 `python -m pytest -q`。
- 后端测试目录当前包含 AI 路由/设置、课程集合、健康诊断、TTS 引擎/路由等测试文件。
- 本次核对的主干基线提交有后端 workflow 成功记录；前端真实页面交互、Windows 实机、真实 TTS 播放和 AI 多轮课堂验收仍须单独确认。对本轮新提交的 CI 结果，以该提交对应的 GitHub Actions 记录为准。

## 3. 逐项改进清单

### LTA-P0-01 教材内容类型识别必须避免误判

- **现状**：`TextbookImportPanel.vue` 的 `getExistingTypes()` 通过课时标题判断某单元已经生成了哪些内容类型。原规则把 `句子|课文|对话` 都归为 `sentences`，而 `passage` 仅匹配 `短文|阅读`。
- **缺陷/影响**：已有“课文”或“对话”课时可能被误判为“句子”已生成，系统在增补内容类型时跳过真正需要生成的句子内容；反向也可能导致同一语义被重复生成。错误会影响教材内容覆盖和增补可信度。
- **竞品参考**：Busuu 的结构化课程与 CEFR 学习路径强调课程目标/学习活动的明确归属；Babbel 的结构化课程也将语法、词汇和语境练习作为不同教学单元。参考：<https://www.busuu.com/>、<https://www.babbel.com/>。这是产品建模参考，不代表竞品内部实现已被直接验证。
- **设计方案**：按明确且不重叠的标题标记识别：phonics、grammar、passage（短文/阅读/课文/篇章）、sentences（重点句/句子）、words（单词/词汇）。不再将“对话”直接当作“句子”。后续应以持久化的显式 contentType 元数据替代标题推断，标题只作为旧数据兼容回退。
- **验收标准**：
  - [ ] 标题“Unit 1 - 课文”只识别为 passage，不识别为 sentences。
  - [ ] 标题“Unit 1 - 对话”不会自动阻止新增 sentences。
  - [ ] 标题“Unit 1 - 句子”“Unit 1 - 单词”“Unit 1 - 语法”“Unit 1 - Phonics”分别识别为对应类型。
  - [ ] 已有单词、补充句子、再补短文后，原课程不丢失、不重复生成已有类型。
  - [ ] Typecheck/build 通过，并在实际教材数据上完成增补回归。
- **状态**：`FIXED_PENDING_CI`。本轮已将宽泛正则改为按优先级执行的非重叠标记；自动化与真实教材回归尚未完成。

### LTA-P0-02 教材生成断点、配置变化与未保存草稿保护

- **现状**：`TextbookImportPanel.vue` 将生成断点写入单个 localStorage 键 `textbook_generation_checkpoint_v1`；断点匹配包含单元、内容类型、音频开关和词汇数量等配置。配置不完全匹配时会新建 checkpoint。
- **缺陷/风险**：若存在尚未保存的已生成草稿，用户改变单元或内容类型后，新 checkpoint 可能覆盖原 checkpoint 中的草稿。代码存在恢复/轮询机制，但不能仅凭代码认定切页、刷新、配置修改后不会丢失内容。
- **竞品参考**：教材/结构化学习流程应将草稿、已保存课程和生成任务状态区分；可参考 Busuu Study Plan 的目标/进度可见性原则，但本项核心标准来自数据安全和可恢复性，不是照搬竞品。
- **设计方案**：把“生成任务”和“待保存草稿”分离存储；同一教材的生成任务使用稳定 source key，配置快照单独版本化。发现存在未保存草稿且用户要切换配置时，必须提供“恢复并保存原草稿 / 保留原草稿并新建任务 / 明确丢弃”选择；默认不得静默覆盖。任务状态区分 running、paused、completed、failed、draft-saved。
- **验收标准**：
  - [ ] 生成部分内容后刷新页面，已完成内容项和当前任务可恢复。
  - [ ] 切换内容类型或单元不会静默覆盖未保存草稿。
  - [ ] 失败后继续生成只重试未完成项，不重复创建已保存课程。
  - [ ] 部分保存失败后再次保存，已成功项跳过、失败项可重试。
  - [ ] 明确丢弃时要求用户确认，并只清理对应任务草稿。
- **状态**：`IMPLEMENTED_UNVERIFIED`（断点机制存在；配置切换保护仍需设计/实施，刷新与重启实测未运行）。

### LTA-P0-03 教材生成进度必须与真实任务状态一致

- **现状**：UI 同时展示“已完成内容项 x/y”和“完整单元 x/y”；内容项分母为所选单元数 × 内容类型数，另有当前单元/类型。
- **缺陷/风险**：代码静态结构看起来具备区分，但没有当前浏览器验收证据。多类型并发、已存在类型跳过、断点恢复、部分失败时需要确保分子/分母、当前阶段、最终状态一致。
- **竞品参考**：Duolingo 的短任务进度反馈和 Babbel 的课程阶段反馈可作为进度可理解性的交互参考；不以视觉相似作为验收，关键是任务状态准确。
- **设计方案**：进度模型以每个 `unit × contentType` 任务为唯一统计单位；展示等待/生成中/已完成/已跳过（已有）/失败/待重试。只有所有所选任务成功或被确认跳过时才显示完成；不能仅由 `loading=false` 推导成功。
- **验收标准**：
  - [ ] 单元 2 个、内容类型 3 个时任务总数为 6；进度按已完成任务计数。
  - [ ] 已有类型跳过有单独状态，不伪装成新生成成功。
  - [ ] 失败后进度保留，当前失败类型可见，重试后正确更新。
  - [ ] 恢复断点时进度与持久化 checkpoint 一致。
  - [ ] 成功、部分成功和失败三种结果有明确的页面状态与下一步操作。
- **状态**：`IMPLEMENTED_UNVERIFIED`。

### LTA-P0-04 首页继续学习与真实学习数据闭环

- **现状**：`HomePage.vue` 已消费 `learningDashboardService`，显示继续学习、今日练习/复习、计划任务和到期复习；数据失败显示 warning 并可重试。继续学习通过课堂路由进入指定 lesson。
- **缺陷/风险**：静态代码已优于早期基线，但跨页进度一致、无效 lessonId、删除课程/课时、刷新/重启、后端不可用等场景仍需运行证据。首页的“今日学习”同时使用练习、复习和计划数据，必须保持各指标含义清晰，不能随意相加。
- **竞品参考**：Duolingo 的连续学习/短任务降低启动成本；Busuu Study Plan 提供目标、计划时间与进度。LexiType 应借鉴“明确下一步”，不复制 streak 等缺少可靠数据支撑的指标。参考：<https://www.duolingo.com/>、<https://www.busuu.com/>。
- **设计方案**：以“继续上次未完成课时”为主行动；按持久化 `currentLessonId` 恢复，失效时回退到首个未完成课时或诚实空状态。各统计项展示来源和口径；部分接口失败时保留可用数据并清楚标识不可用项。
- **验收标准**：
  - [ ] 首页、我的学习、课程详情、课堂显示同一课程的进度一致。
  - [ ] 刷新/关闭后重开可恢复到有效的未完成课时。
  - [ ] 课程/课时删除或失效 ID 不导致白屏/错误路由。
  - [ ] 无课程、无计划、无到期复习与接口失败分别展示正确状态。
  - [ ] 不把计划分钟、练习时长和课堂点评耗时重复相加。
- **状态**：`IMPLEMENTED_UNVERIFIED`。

### LTA-P0-05 课堂内容形态与教学方法契约

- **现状**：`ContentShape` 只有 Word、Phrase、Sentence、Passage、Dialog；课堂按内容形态选择默认模式，教材生成分别创建单词、句子、短文、语法和 phonics 课时。
- **缺陷/风险**：教学内容类型与内容形态不是同一维度。语法、phonics 属于教学目标/活动类型，不能总用 Sentence/Word 形态表达；若仅根据标题或形态推断，默认课堂模式和“已生成类型”识别可能不一致。
- **竞品参考**：Babbel 的结构化语法/词汇课程与 ELSA Speak 的发音专项训练体现不同教学目标需要不同练习方法。参考：<https://www.babbel.com/>、<https://elsaspeak.com/>。
- **设计方案**：短期先明确每种生成类型的内容形态、教学目标和推荐活动映射；中期新增可选 `contentType`（例如 vocabulary、sentence、passage、grammar、phonics、dialogue）与版本兼容策略，不把 contentShape 直接扩展成所有教学目标。课堂选择模式按 `contentType + contentShape` 决策。
- **验收标准**：
  - [ ] 单词/短语、句子、短文/对话、语法、phonics 各有明确的默认学习模式。
  - [ ] 用户手动切换模式不会被异步状态覆盖。
  - [ ] 历史课程没有 contentType 时使用稳定回退逻辑，不改变原内容。
  - [ ] 增补生成不会改变已有课时的内容形态或归属。
- **状态**：`TODO`（先做数据契约设计，不直接进行破坏性枚举变更）。

### LTA-P0-06 共享对话内核与英语面试体验

- **现状**：`/conversation` 路由指向 `ConversationPage.vue`；设计文档记录 AI 教学与英语面试共享消息模型、AI Provider 代理和会话持久化第一版。
- **缺陷/风险**：历史文档将其标为第一版/待验证；刷新恢复、长会话 token、失败重试、结束/放弃事件、面试反馈转学习计划的端到端流程未在本轮运行验证。页面存在 try/catch 不等于错误状态和恢复 UX 已充分。
- **竞品参考**：Speak 的场景化 AI 口语练习、ELSA 的具体发音反馈可作为对话任务与反馈的参考；反馈应具体、可练习，并明确模型判断的局限。参考：<https://www.speak.com/>、<https://elsaspeak.com/>。
- **设计方案**：保持场景策略与共享会话内核分离；统一 loading/streaming/timeout/retry/partial response 状态；明确会话恢复、取消、重试、结束、删除/导出和保留策略；反馈要能定位到用户原话和建议改写，面试结果只有用户确认后才转为学习任务。
- **验收标准**：
  - [ ] 教学与面试使用同一基础消息/持久化契约，但场景提示、评分和结束动作互不串扰。
  - [ ] 刷新后恢复正确会话和消息顺序。
  - [ ] 超时、断流、空正文、重复提交有可理解提示与可恢复操作。
  - [ ] 长会话具备上下文/token 预算策略，不无界发送全部历史。
  - [ ] 面试反馈保存为任务需用户明确操作；不自动修改课程完成或 SM-2 掌握度。
- **状态**：`IMPLEMENTED_UNVERIFIED`。

### LTA-P1-07 学习复习与掌握度可信度

- **现状**：后端持久化单词掌握度和复习日志；项目有 SM-2 相关逻辑与复习页面。
- **缺陷/风险**：单次正确率不等于长期掌握；相同单词在不同 source 下存在独立记录，跨课程去重和掌握度汇总口径需明确。
- **竞品参考**：Anki 的间隔重复是复习调度参考；不应仅凭一次练习将词汇标记为长期掌握。参考：<https://apps.ankiweb.net/>。
- **设计方案**：定义词条身份、来源关系、重复词策略、复习事件和掌握度计算；保留来源可追溯性，避免跨来源误合并。
- **验收标准**：
  - [ ] 同一词条跨课程/来源的去重策略有明确文档与测试。
  - [ ] 答对一次不直接标记为已掌握。
  - [ ] 复习提交后队列、日志、统计保持一致。
  - [ ] 重复事件不会重复推进复习间隔。
- **状态**：`TODO`。

### LTA-P1-08 UI/UX 设计系统与响应式验收

- **现状**：仓库已有 `UI_UX_ACCEPTANCE_STANDARD.md`、`design-system-governance`、`ui-quality-review`、`ui-implementation-validation` Skills；主前端使用 Vue 3、Element Plus 和项目 CSS variables。
- **缺陷/风险**：规范与 Skill 存在，但本轮未执行浏览器/窄屏/键盘/无障碍扫描。前端 build 不能证明布局、焦点、屏幕阅读器或错误状态通过。
- **竞品参考**：Duolingo、Busuu、Babbel 可参考清晰的课程层级与反馈；视觉取舍应以 LexiType 现有设计系统为准，不以复制竞品外观为目标。
- **设计方案**：每个页面按 UI 验收规范检查 loading/empty/error/partial success、主按钮、键盘焦点、窄屏、长文本、暗色主题和可访问名称；优先抽查首页、教材生成、课堂、对话四条主路径。
- **验收标准**：
  - [ ] 360px、768px、1280px 视口下关键路径无横向溢出和主要控件遮挡。
  - [ ] 主流程可键盘操作，焦点可见，表单错误可关联到字段。
  - [ ] 加载、空、错误、部分成功状态分别可理解。
  - [ ] 浏览器控制台无新增应用级错误，网络失败可恢复。
  - [ ] 有固定视口/数据的截图或人工验收记录。
- **状态**：`NOT_RUN`（本轮未运行浏览器验证）。

### LTA-P1-09 AIMES Skill 路由与验证证据

- **现状**：`AGENTS.md` 要求产品探索先读 product-manager Skill；注册表中存在产品、需求、UI、实现验证等 Skills。配置中的 Trae/Codex/Claude/Copilot 入口标为 template，ZCode/QCode 为 manual。
- **缺陷/风险**：Skill 文件存在不等于已注册/自动触发/实际执行。product-manager Skill 当前头部状态为 PROPOSED，注册表多个 `validation_status` 为 UNKNOWN 且无 evidence。
- **竞品参考**：本项不是竞品功能对标，而是工程治理要求：不同工具都应能给出一致、可追溯的执行证据。
- **设计方案**：为高风险任务建立路由记录：task_id、触发原因、skill_id/version/path、实际读取证据、输出产物、下一 Skill、验证状态。先建立正向/反向评测，不把所有简单任务都强制走完整产品流程。
- **验收标准**：
  - [ ] 对产品分析任务，目标工具能展示实际读取 Skill 的证据并输出对应步骤。
  - [ ] 对纯文本小改动，不误触发整套市场/产品流程。
  - [ ] 未加载、路径不可读、能力未知均报告 UNKNOWN/BLOCKED。
  - [ ] 注册表的 validation_status 与证据一致，不因文件存在自动改成 PASS。
- **状态**：`TODO`。

### LTA-P1-10 自动化测试覆盖与可复现交付

- **现状**：前端 CI 执行 typecheck/build，后端 CI 执行 pytest；前端 package scripts 中有 lint，但未发现与当前 Vue 主路径对应的专用前端单元/E2E 测试目录。
- **缺陷/风险**：编译通过不能验证教材增补语义、浏览器恢复、TTS 实际播放、真实 AI 多轮会话和 SQLite 重启持久化。
- **竞品参考**：此项按产品可靠性工程原则执行，不以竞品公开宣传替代测试。
- **设计方案**：优先为教材内容类型识别和 checkpoint 纯函数建立单元测试；随后为课程生成/保存、首页恢复、对话恢复补集成或 E2E 测试。真实模型和 TTS 验收采用可重复的人工测试脚本，并记录模型、引擎、输入、结果和耗时。
- **验收标准**：
  - [ ] 新增测试覆盖标题分类、已有类型跳过、补充类型合并、部分保存重试。
  - [ ] CI 对相关测试执行并报告。
  - [ ] E2E 记录至少包含环境、数据准备、操作步骤、预期/实际结果与证据。
  - [ ] 没有真实模型凭据的 CI 明确标记真实模型验收未运行，不伪造通过。
- **状态**：`TODO`。


### LTA-P0-11 单元默认选择与增补行为的显式验收

- **现状**：解析单元成功后，代码将 `unitForm.unitTitles = []`，没有在静态代码中自动选中全部单元；单元选项会展示已有内容类型，生成逻辑会尝试跳过已存在类型，且有“补充单元”入口。
- **结论**：针对“默认选择全部单元”的旧问题，当前主干静态代码已体现为空选择，不应再次当作已确认缺陷；但交互是否受断点恢复影响、已生成内容标签是否准确，仍未经过本轮浏览器验收。
- **设计方案**：首次解析目录后默认不选中任何单元；用户明确选择目标单元与内容类型。已有内容应显示在单元选项中；只对新增内容类型生成；补充单元沿用当前出版社/系列/教材/年级来源；预览与保存前明确列出新增、跳过和失败项。
- **验收标准**：
  - [ ] 新解析教材后，单元选择默认为空，不能无意中对全册触发长任务。
  - [ ] 重新进入或恢复断点时，只恢复此前任务的选择快照，并明确告知用户。
  - [ ] 已有内容类型显示准确；新增类型生成后与原课程合并，不改变原来源、单元归属和历史课时。
  - [ ] 手工补充的单元刷新后仍能恢复，并保存到当前教材系列/册。
- **状态**：`IMPLEMENTED_UNVERIFIED`（静态代码可确认默认空选择和补充入口；交互验收 NOT_RUN）。

### LTA-P1-12 教材生成耗时分解与安全优化

- **现状**：`TextbookImportPanel.vue` 对单元级任务使用最多 2 个并发 worker；每个单元内部按单词、句子、短文、语法、phonics 顺序执行；TTS 项目按 3 条一批并发。生成总耗时会随所选单元数、内容类型数、每种生成的模型延迟和可选 TTS 数量增加。
- **缺陷/风险**：目前没有本轮可复核的阶段耗时基线，不能仅凭“感觉慢”断言具体瓶颈。提高并发可能增加 provider 限流、资源竞争、断点竞态或本地 TTS 负载。
- **设计方案**：记录每个 `unit × contentType` 的开始/结束时间、模型请求耗时、TTS 耗时、保存耗时、重试次数和结果；用 1/3/5 个单元、1/3/5 种内容类型、TTS 开/关进行同环境基准。先定位瓶颈，再调整并发、缓存或批处理。
- **验收标准**：
  - [ ] 诊断日志能区分目录解析、各内容类型生成、TTS、合并/保存的耗时。
  - [ ] 同一输入重复测量，报告中记录环境、模型、所选单元/类型、TTS 配置和耗时，不用单次结果代表普遍性能。
  - [ ] 优化前后比较总耗时、失败率、重复生成率和内容质量；不得只以速度作为通过标准。
  - [ ] 并发/重试不导致断点丢失、同一内容重复保存或跨单元归属错误。
- **状态**：`NOT_RUN`（本轮只确认代码执行结构，没有运行模型/TTS 性能测试）。

## 4. 优先级与实施顺序

| 顺序 | 条目 | 原因 | 实施策略 |
|---|---|---|---|
| 1 | P0-01 内容类型识别 | 已发现明确逻辑缺陷，影响增补正确性，修复范围小 | 已提交最小代码修复；先等 CI，再补回归测试 |
| 2 | P0-02 草稿/断点保护 | 存在用户内容丢失风险 | 先补需求与状态模型，再实现，禁止静默覆盖 |
| 3 | P0-03 进度语义验收 | 影响长耗时任务的可信度 | 固化任务状态模型与验证矩阵 |
| 4 | P0-04 首页恢复与数据闭环 | 高频主路径 | 运行 API 故障、刷新/重启、失效课时测试 |
| 5 | P0-05 内容形态/教学方法契约 | 影响课堂默认模式及后续扩展 | 先兼容性设计，避免破坏历史课程 |
| 6 | P0-06 对话内核 | 核心场景能力，跨层影响大 | 先跑已有 CI/集成，再修错误恢复与会话状态 |
| 7 | P1-10 测试覆盖 | 降低后续改动回归风险 | 先给教材分类/checkpoint 增加可测试的纯函数 |
| 8 | P1-07 学习掌握度 | 影响长期学习效果 | 明确数据身份与事件口径后再实现 |
| 9 | P1-08 UI/UX | 需要浏览器/实机环境 | 分页面人工验收，记录视口和证据 |
| 10 | P1-09 Skill 路由 | 治理能力横切面 | 增加可验证路由记录和正反向评测 |

## 5. 本轮实施记录

- 已修改 `frontend/src/renderer/components/ai/TextbookImportPanel.vue` 的 `getExistingTypes()`：移除把“课文/对话”宽泛映射到句子的规则，改为具体标记优先、互斥分类。
- 提交：`82be5efd6741ad45e437a0d67c6d1fa27a890fc7`。
- 本轮尚未运行本地前端构建、浏览器或 Windows 实机验收；应检查该提交的 GitHub Actions 状态。此修复目前是 `FIXED_PENDING_CI`，不得标记 `VERIFIED`。
- 该修复仍属于旧课程标题兼容方案。长期正确方案是持久化显式内容类型，避免把标题当作数据契约。

## 6. 相关权威基线

- [产品改进基线](./PRODUCT_IMPROVEMENT_BASELINE.md)
- [P0 改进实施清单](./P0_IMPLEMENTATION_BACKLOG.md)
- [AI 课程生成、课程仓库与学习体验专项审计](./AI_COURSE_GENERATION_AND_LEARNING_EXPERIENCE_AUDIT.md)
- [学习数据审计与核心学习闭环](./LEARNING_DATA_AUDIT_AND_CORE_LOOP.md)
- [UI/UX 交互验收规范](./UI_UX_ACCEPTANCE_STANDARD.md)
- [AI 教学与英语面试共享对话内核设计](./AI_TUTOR_AND_INTERVIEW_CONVERSATION_ARCHITECTURE.md)
