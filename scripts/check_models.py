"""模型资产自检脚本。

职责：
- 读取 backend/models/manifest.json，逐项检查模型目录/文件是否存在
- 输出体积与授权信息，帮助确认“整目录拷贝、不改名”的落地情况
- 必需模型缺失时以非零退出码结束，便于在启动脚本中前置拦截

用法：
    python scripts/check_models.py
    python scripts/check_models.py --json
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Tuple

# 项目根目录：本脚本位于 scripts/，上一级即仓库根
PROJECT_ROOT: Path = Path(__file__).resolve().parents[1]
# 模型清单文件路径
MANIFEST_PATH: Path = PROJECT_ROOT / "backend" / "models" / "manifest.json"

# 模块级日志器：统一输出级别与格式
logger = logging.getLogger("check_models")


def configure_logging(verbose: bool) -> None:
    """配置脚本日志输出。

    参数：
        verbose: 为 True 时输出 DEBUG 级别日志。
    """
    # 基础格式：时间 | 级别 | 内容
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s | %(levelname)-7s | %(message)s",
        datefmt="%H:%M:%S",
    )


def human_size(size_bytes: int) -> str:
    """把字节数转换为人类可读的大小文本。

    参数：
        size_bytes: 待转换的字节数。

    返回：
        形如 "1.2 GB" / "345.6 MB" 的字符串。
    """
    # 逐级换算到合适的单位
    units: Tuple[str, ...] = ("B", "KB", "MB", "GB", "TB")
    # 当前数值，使用浮点便于小数展示
    value: float = float(size_bytes)
    # 单位下标
    index: int = 0
    # 超过 1024 即进一位
    while value >= 1024 and index < len(units) - 1:
        value /= 1024
        index += 1
    return f"{value:.1f} {units[index]}"


def measure_path_size(target: Path) -> int:
    """统计目录或文件的总字节数。

    参数：
        target: 目标路径。

    返回：
        总字节数；路径不存在时返回 0。
    """
    # 不存在直接返回 0，避免抛异常打断自检流程
    if not target.exists():
        return 0

    # 文件直接取大小
    if target.is_file():
        return target.stat().st_size

    # 目录递归累加所有文件大小
    total: int = 0
    for item in target.rglob("*"):
        if item.is_file():
            # 单个文件可能因权限或占用读取失败，跳过并记录
            try:
                total += item.stat().st_size
            except OSError as exc:
                logger.debug("跳过无法读取的文件 %s：%s", item, exc)
    return total


def load_manifest() -> Dict[str, Any]:
    """读取并解析模型清单。

    返回：
        清单字典。

    异常：
        FileNotFoundError: 清单文件不存在。
        json.JSONDecodeError: 清单格式非法。
    """
    # 清单缺失属于工程配置错误，直接抛出由主流程处理
    if not MANIFEST_PATH.exists():
        raise FileNotFoundError(f"模型清单不存在：{MANIFEST_PATH}")

    # 以 UTF-8 读取，避免中文说明乱码
    with MANIFEST_PATH.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def check_entries(manifest: Dict[str, Any]) -> List[Dict[str, Any]]:
    """逐项检查模型资产是否存在。

    参数：
        manifest: 模型清单字典。

    返回：
        每项检查结果的列表，元素包含 id/type/path/exists/size_text/license 等字段。
    """
    # 模型根目录由清单声明，兼容后续目录调整
    root: Path = PROJECT_ROOT / manifest.get("root", "backend/models")
    # 模块级日志：开始检查
    logger.info("开始检查模型资产，根目录：%s", root)

    # 结果集合
    results: List[Dict[str, Any]] = []

    # 遍历清单条目
    for entry in manifest.get("entries", []):
        # 单个模型的实际路径
        target: Path = root / entry["path"]
        # 是否存在
        exists: bool = target.exists()
        # 占用体积
        size_bytes: int = measure_path_size(target)

        # 按级别输出提示：必需缺失为 ERROR，可选缺失为 WARNING
        if not exists and entry.get("required", False):
            logger.error("必需模型缺失：%s（%s）", entry["id"], target)
        elif not exists:
            logger.warning("可选模型未安装：%s（%s）", entry["id"], target)
        else:
            logger.debug(
                "模型就绪：%s，体积=%s，授权=%s",
                entry["id"],
                human_size(size_bytes),
                entry.get("license", "unknown"),
            )

        # 记录该项结果
        results.append(
            {
                "id": entry["id"],
                "type": entry.get("type", "unknown"),
                "kind": entry.get("kind", "directory"),
                "path": str(target),
                "required": bool(entry.get("required", False)),
                "exists": exists,
                "size_bytes": size_bytes,
                "size_text": human_size(size_bytes),
                "license": entry.get("license", "unknown"),
                "role": entry.get("role", ""),
                "note": entry.get("note", ""),
            }
        )

    return results


def print_table(results: List[Dict[str, Any]]) -> None:
    """以表格形式打印检查结果。

    参数：
        results: check_entries 返回的结果列表。
    """
    # 表头：状态 | 类型 | 标识 | 体积 | 授权
    header: str = f"{'状态':<6}{'类型':<6}{'标识':<38}{'体积':<12}{'授权':<16}"
    print(header)
    print("-" * len(header))

    # 逐行输出，状态文本保持固定宽度以对齐
    for item in results:
        # 状态列：就绪 / 必需缺失 / 可选缺失
        if item["exists"]:
            status: str = "OK"
        elif item["required"]:
            status = "MISS"
        else:
            status = "SKIP"

        print(
            f"{status:<6}{item['type']:<6}{item['id']:<38}"
            f"{item['size_text']:<12}{item['license']:<16}"
        )


def main() -> int:
    """脚本主流程。

    返回：
        进程退出码：全部必需模型就绪返回 0，否则返回 1。
    """
    # 解析命令行参数
    parser = argparse.ArgumentParser(description="检查 LexiType Academy 模型资产是否就绪")
    parser.add_argument("--json", action="store_true", help="以 JSON 格式输出检查结果")
    parser.add_argument("--verbose", action="store_true", help="输出 DEBUG 级别日志")
    args = parser.parse_args()

    # 配置日志
    configure_logging(args.verbose)

    try:
        # 读取清单
        manifest = load_manifest()
        # 执行检查
        results = check_entries(manifest)
    except (FileNotFoundError, json.JSONDecodeError) as exc:
        # 清单层错误：直接失败并返回非零退出码
        logger.error("模型清单加载失败：%s", exc)
        return 1

    # 统计必需项缺失数量
    missing_required: List[Dict[str, Any]] = [
        item for item in results if item["required"] and not item["exists"]
    ]

    # 输出方式：JSON 或表格
    if args.json:
        print(
            json.dumps(
                {
                    "root": manifest.get("root", "backend/models"),
                    "total": len(results),
                    "missing_required": len(missing_required),
                    "entries": results,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
    else:
        print_table(results)
        print()
        # 汇总信息
        print(f"共 {len(results)} 项，就绪 {sum(1 for i in results if i['exists'])} 项，"
              f"必需缺失 {len(missing_required)} 项")

    # 存在必需缺失则返回 1
    if missing_required:
        logger.error(
            "存在必需模型缺失：%s",
            ", ".join(item["id"] for item in missing_required),
        )
        return 1

    logger.info("模型资产自检通过")
    return 0


if __name__ == "__main__":
    # 使用显式退出码，便于 CI 或启动脚本判断
    sys.exit(main())
