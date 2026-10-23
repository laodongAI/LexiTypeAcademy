"""迁移命令行入口。

用法：
    # 在 backend/ 目录下执行
    .\.venv\Scripts\python.exe -m app.services.migration.cli ..\export.json

职责：
- 调用 importer.run_import 执行完整迁移
- 控制台打印校验摘要，校验失败时以非零退出码结束
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from app.core.logging import get_logger
from app.services.migration.importer import MigrationError, run_import

# 模块级日志器
logger = get_logger(__name__)


def main() -> int:
    """命令行主流程。

    返回：
        进程退出码：校验全部通过返回 0，否则返回 1。
    """
    # 命令行参数
    parser = argparse.ArgumentParser(description="导入 IndexedDB 导出数据到本地 SQLite")
    parser.add_argument("file", type=Path, help="前端导出的 JSON 文件路径")
    parser.add_argument(
        "--mode",
        default="replace",
        choices=["replace"],
        help="导入模式（当前仅支持 replace：整表替换）",
    )
    parser.add_argument(
        "--adapter",
        default="auto",
        choices=["auto", "none", "legacy-react"],
        help="来源适配：auto 自动识别旧 React 版（LexiTypeDB），none 不做适配",
    )
    parser.add_argument("--json", action="store_true", help="以 JSON 输出完整报告")
    args = parser.parse_args()

    try:
        report = run_import(args.file, mode=args.mode, adapter=args.adapter)
    except MigrationError as exc:
        logger.error("迁移失败：%s", exc)
        return 1

    # 输出方式：JSON 或摘要
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print("=" * 72)
        print(f"报告 ID   : {report['report_id']}")
        print(f"数据来源  : {report['source']['db_name']} / origin={report['source']['origin']}")
        # 旧版适配信息：仅旧版数据迁移时存在
        legacy_source = report.get("legacy_source")
        if legacy_source:
            print(f"适配器    : {legacy_source.get('adapter')}（源库 v{legacy_source.get('source_db_version')}）")
            dropped = legacy_source.get("dropped_collections") or {}
            if dropped:
                print(f"丢弃集合  : {dropped}")
        print(f"备份文件  : {report['backup_path']}")
        print(f"报告文件  : {report.get('report_path', '(未写入)')}")
        print("-" * 72)
        for stat in report["tables"]:
            print(
                f"{stat['table']:<26} 源 {stat['source_count']:>6} 条  "
                f"导入 {stat['imported_count']:>6} 条"
            )
        print("-" * 72)
        for check in report["checks"]:
            if "expected" in check:
                status = "PASS" if check["passed"] else "FAIL"
                print(
                    f"[{status}] {check['name']:<38} "
                    f"期望 {check['expected']} / 实际 {check['actual']}"
                )
            else:
                status = "PASS" if check["passed"] else "FAIL"
                print(
                    f"[{status}] {check['name']:<38} "
                    f"源 {check['source_total']} / 库 {check['database_total']} / "
                    f"不一致 {check['mismatched_count']}"
                )
        print("-" * 72)
        print(
            f"校验结果  : {report['summary']['status']} "
            f"({report['summary']['passed_checks']}/{report['summary']['total_checks']} 通过)"
        )
        if report["warnings"]:
            print("告警      :")
            for warning in report["warnings"]:
                print(f"  - {warning}")
        print("=" * 72)

    # 校验失败返回非零退出码
    return 0 if report["summary"]["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.exit(main())
