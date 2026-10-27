# ChatGPT Work 适配说明

AIMES 为 ChatGPT Work 提供项目指令模板与治理入口。将 PROJECT-INSTRUCTIONS.md 内容配置到实际使用的 ChatGPT 项目指令或工作任务中，并确保相关入口文件可以被当前工作模式读取。

不要假设 GitHub 连接器会自动加载本仓库的所有文件。先在真实任务中验证入口读取、Skill 选择、变更保护和验证报告。只读连接方式不能直接提交文件；只有当前工作模式明确提供写入/执行权限时，才可执行对应操作。

当前状态：TEMPLATE；运行时规则加载、Skill 路由和实际工程任务验收均为 UNKNOWN/NOT_RUN。
