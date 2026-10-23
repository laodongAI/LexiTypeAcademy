"""IndexedDB 导出数据导入与校验服务。

职责：
- 读取前端导出脚本生成的 JSON（库名 LexiTypeAcademyDB）
- 导入前对现有 SQLite 数据库做一致性备份，保证可回滚
- 按「整表替换」模式写入 14 张业务表，并保留主键以维持引用关系
- 生成校验报告：行数一致、SM-2 掌握度逐条比对、今日复习队列数量相等

约束：
- 输入必须是可结构化克隆的纯 JSON（不含 Blob）；ttsCacheItems 明确跳过
- 导入过程在单个事务内完成，任一步失败全部回滚
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy import delete, func, insert, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.logging import get_logger
from app.db.base import ENGINE, session_scope
# 字段映射从统一模块导入：保证迁移与 REST API 使用同一份契约
# 说明：映射表已抽取到 app/db/field_maps.py，此处不再重复定义
from app.db.field_maps import FIELD_MAPS
from app.db.models import SKIPPED_COLLECTIONS, TABLE_MODEL_MAP, UnitMasteryItem, WordMasteryItem
from app.services.migration.legacy_react import convert_legacy_payload, is_legacy_payload

# 模块级日志器
logger = get_logger(__name__)

# 掌握度比对允许的浮点误差
FLOAT_TOLERANCE: float = 1e-6


class MigrationError(Exception):
    """迁移过程中的业务异常（输入格式错误、导入失败等）。"""


def load_export_payload(file_path: Path) -> dict[str, Any]:
    """读取并解析导出 JSON。

    参数：
        file_path: 导出文件路径。

    返回：
        解析后的字典。

    异常：
        MigrationError: 文件不存在或 JSON 非法。
    """
    # 文件必须存在
    if not file_path.exists():
        raise MigrationError(f"导出文件不存在：{file_path}")

    try:
        # 以 UTF-8 读取，兼容中文内容
        with file_path.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except json.JSONDecodeError as exc:
        raise MigrationError(f"导出文件不是合法 JSON：{exc}") from exc

    # 顶层必须是对象
    if not isinstance(payload, dict):
        raise MigrationError("导出文件顶层结构必须是对象")

    logger.info("已读取导出文件：%s", file_path)
    return payload


def validate_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """校验导出数据结构并返回概况。

    参数：
        payload: 导出 JSON 解析结果。

    返回：
        包含 tables 字典与告警信息的概况。

    异常：
        MigrationError: 缺少必要字段或 tables 结构非法。
    """
    # tables 必须存在且为对象
    tables: Any = payload.get("tables")
    if not isinstance(tables, dict):
        raise MigrationError("导出文件缺少 tables 字段，或 tables 不是对象")

    # 交互中识别出的告警（不阻断导入）
    warnings: list[str] = []

    # 检查库名：IndexedDB 库名是冻结标识，改名意味着数据来源不对
    db_name: str = str(payload.get("dbName", ""))
    if db_name and db_name != "LexiTypeAcademyDB":
        warnings.append(f"导出库名为 {db_name}，与约定 LexiTypeAcademyDB 不一致")

    # 检查映射覆盖情况：出现未知集合说明前端新增了表但后端未同步
    unknown_collections: list[str] = [
        name for name in tables if name not in TABLE_MODEL_MAP and name not in SKIPPED_COLLECTIONS
    ]
    if unknown_collections:
        warnings.append(f"存在未映射的集合：{', '.join(unknown_collections)}")

    # 跳过项的说明
    for name in SKIPPED_COLLECTIONS:
        if name in tables:
            warnings.append(f"集合 {name} 按既定决策跳过（可重建的音频缓存）")

    # 每个已知集合必须是数组
    for name in tables:
        if name in TABLE_MODEL_MAP and not isinstance(tables[name], list):
            raise MigrationError(f"集合 {name} 的数据不是数组")

    logger.info(
        "导出结构校验通过：共 %s 个集合，告警 %s 条", len(tables), len(warnings)
    )

    return {
        "tables": tables,
        "warnings": warnings,
        "unknown_collections": unknown_collections,
        "db_name": db_name,
        "origin": payload.get("origin"),
        "exported_at": payload.get("exportedAt"),
        "schema_version": payload.get("schemaVersion"),
    }


def backup_database() -> Path:
    """导入前备份当前 SQLite 数据库。

    返回：
        备份文件路径。

    说明：
        使用 SQLite 官方 backup API 生成一致性快照，
        比直接复制文件更安全（可处理 WAL 中的未落盘数据）。
    """
    # 数据库实际文件路径
    db_file: str = str(ENGINE.url.database)
    source_path = Path(db_file)

    # 目标备份目录：backend/data/backups/
    backup_dir: Path = get_settings().data_path / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)

    # 备份文件名带时间戳，便于回滚到指定时点
    timestamp: str = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path: Path = backup_dir / f"lexitype-{timestamp}.db"

    # 数据库文件尚未产生时，直接返回一个空标记路径（首次迁移场景）
    if not source_path.exists():
        logger.info("数据库文件尚不存在，跳过备份：%s", source_path)
        return backup_path

    # 使用 sqlite3 backup API 做在线备份
    source_conn = sqlite3.connect(str(source_path))
    try:
        target_conn = sqlite3.connect(str(backup_path))
        try:
            source_conn.backup(target_conn)
        finally:
            target_conn.close()
    finally:
        source_conn.close()

    logger.info("数据库已备份：%s", backup_path)
    return backup_path


def map_row(collection: str, raw: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    """把一行前端数据映射为数据库列字典。

    参数：
        collection: 前端集合名。
        raw: 单条原始数据。

    返回：
        (映射后的字典, 被忽略的字段名列表)。

    说明：
        未在映射表中的字段会被忽略并记录，避免静默丢数据。
    """
    # 当前集合的字段映射
    field_map: dict[str, str] = FIELD_MAPS[collection]

    # 映射结果
    mapped: dict[str, Any] = {}
    # 未识别字段
    ignored: list[str] = []

    for key, value in raw.items():
        # 已知字段：按映射写入
        if key in field_map:
            mapped[field_map[key]] = value
        else:
            ignored.append(key)

    return mapped, ignored


def _count_source(tables: dict[str, Any], collection: str) -> int:
    """统计导出数据中某集合的条数。"""
    # 缺失集合按 0 处理
    return len(tables.get(collection, []))


def import_tables(payload_info: dict[str, Any], mode: str = "replace") -> dict[str, Any]:
    """把导出数据写入数据库。

    参数：
        payload_info: validate_payload 的返回结果。
        mode: 导入模式；当前仅支持 replace（整表替换）。

    返回：
        每张表的导入统计。

    异常：
        MigrationError: 模式非法或导入失败。
    """
    # 目前只实现整表替换，保证校验结果可复现
    if mode != "replace":
        raise MigrationError(f"不支持的导入模式：{mode}")

    # 前端集合数据
    tables: dict[str, Any] = payload_info["tables"]

    # 逐表统计结果
    stats: list[dict[str, Any]] = []

    # 单事务写入：任一表失败则整体回滚
    with session_scope() as session:
        for collection, model in TABLE_MODEL_MAP.items():
            # 清空目标表，保证重复导入结果一致
            session.execute(delete(model))

            rows: list[dict[str, Any]] = []
            ignored_fields: set[str] = set()

            for raw in tables.get(collection, []):
                # 跳过非对象行，防止脏数据打断整批导入
                if not isinstance(raw, dict):
                    logger.warning("集合 %s 中存在非对象行，已跳过：%r", collection, raw)
                    continue

                mapped, ignored = map_row(collection, raw)
                ignored_fields.update(ignored)

                # 自增主键为空的记录交给数据库生成
                if "id" in mapped and mapped["id"] is None:
                    mapped.pop("id")

                rows.append(mapped)

            # 批量插入：空列表时跳过
            if rows:
                session.execute(insert(model), rows)

            stats.append(
                {
                    "collection": collection,
                    "table": model.__tablename__,
                    "source_count": _count_source(tables, collection),
                    "imported_count": len(rows),
                    "ignored_fields": sorted(ignored_fields),
                }
            )

            logger.info(
                "已导入 %s → %s：%s 条（源 %s 条）",
                collection,
                model.__tablename__,
                len(rows),
                _count_source(tables, collection),
            )

    return {"mode": mode, "tables": stats}


def _compare_mastery(
    session: Session,
    collection: str,
    model: type[Any],
    rows: Iterable[dict[str, Any]],
    key_fields: tuple[str, ...],
    compared_fields: tuple[str, ...],
) -> dict[str, Any]:
    """逐条比对掌握度数据。

    参数：
        session: 数据库会话。
        collection: 前端集合名（用于报告展示）。
        model: ORM 模型类。
        rows: 源数据行。
        key_fields: 组成比对键的数据库列名。
        compared_fields: 需要逐条比对的数据库列名。

    返回：
        比对结果字典。
    """
    # 源数据键 → 比对值元组
    source_map: dict[tuple[Any, ...], tuple[Any, ...]] = {}
    for row in rows:
        source_map[tuple(row.get(field) for field in key_fields)] = tuple(
            row.get(field) for field in compared_fields
        )

    # 数据库数据键 → 比对值元组
    db_map: dict[tuple[Any, ...], tuple[Any, ...]] = {}
    statement = select(*[getattr(model, field) for field in key_fields + compared_fields])
    for record in session.execute(statement):
        key = tuple(record[i] for i in range(len(key_fields)))
        values = tuple(record[i + len(key_fields)] for i in range(len(compared_fields)))
        db_map[key] = values

    # 缺失键：源有库无
    missing: list[str] = [str(key) for key in source_map if key not in db_map]
    # 多余键：库有源无
    extra: list[str] = [str(key) for key in db_map if key not in source_map]

    # 值不一致的键
    mismatched: list[dict[str, Any]] = []
    for key, source_values in source_map.items():
        db_values = db_map.get(key)
        if db_values is None:
            continue

        # 浮点按容差比较，整型精确比较
        same: bool = True
        for source_value, db_value in zip(source_values, db_values):
            if isinstance(source_value, float) or isinstance(db_value, float):
                if abs(float(source_value or 0) - float(db_value or 0)) > FLOAT_TOLERANCE:
                    same = False
                    break
            elif source_value != db_value:
                same = False
                break

        if not same:
            mismatched.append(
                {
                    "key": str(key),
                    "source": list(source_values),
                    "database": list(db_values),
                }
            )

    # 通过条件：无缺失、无多余、无不一致
    passed: bool = not missing and not extra and not mismatched

    logger.info(
        "掌握度比对 %s：源 %s 条，库 %s 条，缺失 %s，多余 %s，不一致 %s",
        collection,
        len(source_map),
        len(db_map),
        len(missing),
        len(extra),
        len(mismatched),
    )

    return {
        "name": f"{collection}_mastery_match",
        "passed": passed,
        "source_total": len(source_map),
        "database_total": len(db_map),
        "missing_count": len(missing),
        "extra_count": len(extra),
        "mismatched_count": len(mismatched),
        "missing_samples": missing[:5],
        "extra_samples": extra[:5],
        "mismatched_samples": mismatched[:5],
    }


def verify_import(payload_info: dict[str, Any], import_result: dict[str, Any]) -> list[dict[str, Any]]:
    """执行导入后的完整性校验。

    参数：
        payload_info: validate_payload 的返回结果。
        import_result: import_tables 的返回结果。

    返回：
        校验项列表，每项含 name/passed/expected/actual。

    说明：
        校验在导入事务提交后进行，读取的是数据库真实状态。
    """
    # 校验项集合
    checks: list[dict[str, Any]] = []
    # 源数据集合
    tables: dict[str, Any] = payload_info["tables"]

    with session_scope() as session:
        # ---------- 校验 1：每张表行数一致 ----------
        for stat in import_result["tables"]:
            model = TABLE_MODEL_MAP[stat["collection"]]
            # 数据库实际行数
            db_count: int = int(
                session.execute(select(func.count()).select_from(model)).scalar_one()
            )
            expected: int = stat["source_count"]
            passed: bool = db_count == expected

            checks.append(
                {
                    "name": f"row_count:{stat['table']}",
                    "passed": passed,
                    "expected": expected,
                    "actual": db_count,
                }
            )

        # ---------- 校验 2：单词掌握度逐条比对（SM-2 关键字段） ----------
        word_rows: list[dict[str, Any]] = []
        for raw in tables.get("wordMasteryItems", []):
            mapped, _ = map_row("wordMasteryItems", raw)
            word_rows.append(mapped)

        checks.append(
            _compare_mastery(
                session=session,
                collection="wordMasteryItems",
                model=WordMasteryItem,
                rows=word_rows,
                key_fields=("word", "source"),
                compared_fields=("level", "next_review", "ease_factor"),
            )
        )

        # ---------- 校验 3：Unit 掌握度逐条比对 ----------
        unit_rows: list[dict[str, Any]] = []
        for raw in tables.get("unitMasteryItems", []):
            mapped, _ = map_row("unitMasteryItems", raw)
            unit_rows.append(mapped)

        checks.append(
            _compare_mastery(
                session=session,
                collection="unitMasteryItems",
                model=UnitMasteryItem,
                rows=unit_rows,
                key_fields=("course_id", "unit_id", "mode"),
                compared_fields=("level", "next_review", "ease_factor"),
            )
        )

        # ---------- 校验 4：今日复习队列数量一致 ----------
        # 队列定义：下次复习时间 <= 当前时间 的单词掌握度记录
        now_ms: int = int(datetime.now().timestamp() * 1000)

        expected_due: int = 0
        for raw in tables.get("wordMasteryItems", []):
            mapped, _ = map_row("wordMasteryItems", raw)
            next_review = mapped.get("next_review") or 0
            if next_review <= now_ms:
                expected_due += 1

        actual_due: int = int(
            session.execute(
                select(func.count()).select_from(WordMasteryItem).where(
                    WordMasteryItem.next_review <= now_ms
                )
            ).scalar_one()
        )

        checks.append(
            {
                "name": "today_review_queue",
                "passed": expected_due == actual_due,
                "expected": expected_due,
                "actual": actual_due,
            }
        )

    return checks


def _write_report(report: dict[str, Any]) -> Path:
    """把校验报告写入磁盘。

    参数：
        report: 报告字典。

    返回：
        报告文件路径。
    """
    # 报告目录：backend/data/migration-reports/
    report_dir: Path = get_settings().data_path / "migration-reports"
    report_dir.mkdir(parents=True, exist_ok=True)

    # 文件以 report_id 命名，便于 API 按 ID 回查
    report_path: Path = report_dir / f"{report['report_id']}.json"
    with report_path.open("w", encoding="utf-8") as handle:
        json.dump(report, handle, ensure_ascii=False, indent=2)

    logger.info("迁移报告已写入：%s", report_path)
    return report_path


def run_import(file_path: Path, mode: str = "replace", adapter: str = "auto") -> dict[str, Any]:
    """执行完整迁移流程：读取 → 适配 → 校验结构 → 备份 → 导入 → 校验 → 出报告。

    参数：
        file_path: 前端导出的 JSON 文件路径。
        mode: 导入模式，当前仅支持 replace。
        adapter: 来源适配策略；auto 自动识别旧 React 版，none 不做适配，
            legacy-react 强制按旧版规则转换。

    返回：
        完整报告字典。

    异常：
        MigrationError: 任一环节校验失败时抛出。
    """
    # 报告 ID：时间戳 + 短随机串，保证唯一且可读
    report_id: str = (
        datetime.now().strftime("%Y%m%d-%H%M%S") + "-" + uuid.uuid4().hex[:6]
    )

    logger.info("开始迁移，报告 ID=%s，文件=%s，模式=%s，适配=%s", report_id, file_path, mode, adapter)

    # 1. 读取与结构校验
    payload = load_export_payload(file_path)

    # 1.1 旧版数据适配：把 LexiTypeDB 的字段映射为当前 schema
    # 说明：适配后仍保留真实 dbName，便于报告回溯数据来源
    if adapter == "legacy-react" or (adapter == "auto" and is_legacy_payload(payload)):
        payload = convert_legacy_payload(payload)

    payload_info = validate_payload(payload)

    # 2. 备份现有数据库（可回滚）
    backup_path = backup_database()

    # 3. 导入数据
    # 说明：导入失败（主键冲突、类型不符等）会被包装为 MigrationError，
    # 事务已在 session_scope 内回滚，数据库保持导入前状态
    try:
        import_result = import_tables(payload_info, mode=mode)
    except Exception as exc:  # noqa: BLE001 - 需要统一包装为迁移异常
        logger.error("导入阶段失败，已回滚：%s", exc)
        raise MigrationError(f"导入失败，已回滚：{exc}") from exc

    # 4. 完整性校验
    checks = verify_import(payload_info, import_result)

    # 5. 汇总结果
    failed_checks = [item for item in checks if not item["passed"]]

    report: dict[str, Any] = {
        "report_id": report_id,
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "source": {
            "file": str(file_path),
            "db_name": payload_info["db_name"],
            "origin": payload_info["origin"],
            "exported_at": payload_info["exported_at"],
            "schema_version": payload_info["schema_version"],
        },
        "mode": mode,
        "adapter": adapter,
        # 旧版适配元数据：当前 schema 来源不包含该字段时为 None
        "legacy_source": payload.get("legacySource"),
        "backup_path": str(backup_path),
        "skipped_collections": list(SKIPPED_COLLECTIONS),
        "warnings": payload_info["warnings"],
        "tables": import_result["tables"],
        "checks": checks,
        "summary": {
            "total_checks": len(checks),
            "passed_checks": len(checks) - len(failed_checks),
            "failed_checks": len(failed_checks),
            "status": "PASS" if not failed_checks else "FAIL",
        },
    }

    # 6. 落盘报告
    report_path = _write_report(report)
    report["report_path"] = str(report_path)

    if failed_checks:
        # 校验失败视为整体失败，调用方据此决定是否继续使用新数据
        logger.error(
            "迁移校验未通过：失败项=%s",
            ", ".join(item["name"] for item in failed_checks),
        )
    else:
        logger.info("迁移校验全部通过：共 %s 项", len(checks))

    return report
