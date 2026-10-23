"""前后端数据契约辅助。

职责：
- ORM 对象 → 前端 camelCase 字典（响应序列化）
- 前端 camelCase 请求体 → 数据库 snake_case 列字典（写入反序列化）
- 必填字段校验，统一返回 400 并给出中文字段名

说明：
    字段映射唯一来源为 app/db/field_maps.py 的 FIELD_MAPS，
    与数据迁移导入共用，避免两处映射不一致导致字段丢失。
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any, Iterable

from fastapi import HTTPException

from app.core.logging import get_logger
from app.db.field_maps import FIELD_MAPS

# 模块级日志器
logger = get_logger(__name__)


@lru_cache(maxsize=None)
def _reverse_field_map(collection: str) -> dict[str, str]:
    """取得「数据库列名 → 前端字段名」的反向映射。

    参数：
        collection: 前端集合名（如 courses、wordMasteryItems）。

    返回：
        snake_case 列名到 camelCase 字段名的字典。

    说明：
        反向映射在一个进程内只需构建一次，使用 lru_cache 缓存。
    """
    # 映射表不存在说明集合名拼写错误，直接暴露为编程错误
    if collection not in FIELD_MAPS:
        raise KeyError(f"未知集合：{collection}")

    # 反转 camel→snake 得到 snake→camel
    return {snake: camel for camel, snake in FIELD_MAPS[collection].items()}


def serialize_record(collection: str, record: Any) -> dict[str, Any]:
    """把 ORM 对象序列化为前端契约字段。

    参数：
        collection: 前端集合名。
        record: ORM 模型实例。

    返回：
        camelCase 键的字典；不存在的属性按 None 输出，保持字段完整。

    说明：
        只输出 FIELD_MAPS 声明的字段，避免把内部列名暴露给前端。
    """
    # 反向映射（列名 → 前端字段）
    reverse: dict[str, str] = _reverse_field_map(collection)

    # 逐列读取值并还原为前端字段名
    return {camel: getattr(record, snake, None) for snake, camel in reverse.items()}


def serialize_records(collection: str, records: Iterable[Any]) -> list[dict[str, Any]]:
    """批量序列化 ORM 对象列表。"""
    # 复用单条序列化，保持字段集合一致
    return [serialize_record(collection, item) for item in records]


def extract_write_values(
    collection: str,
    payload: Any,
    *,
    skip_fields: Iterable[str] = (),
) -> tuple[dict[str, Any], list[str]]:
    """把前端请求体转换为可写入 ORM 的列字典。

    参数：
        collection: 前端集合名。
        payload: 请求体（必须是对象）。
        skip_fields: 需要跳过的前端字段名（例如课程请求中的 lessons，由调用方单独处理）。

    返回：
        (列名 → 值 的字典, 被忽略的未知字段名列表)。

    异常：
        HTTPException: 请求体不是对象。

    说明：
        未知字段不会静默丢弃，而是收集后由调用方记录日志，
        便于发现前后端契约不一致。
    """
    # 请求体必须是 JSON 对象
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="请求体必须是 JSON 对象")

    # 当前集合的 camel→snake 映射
    field_map: dict[str, str] = FIELD_MAPS[collection]
    # 调用方指定跳过处理的字段集合
    skipped: set[str] = set(skip_fields)

    # 转换结果与未知字段
    values: dict[str, Any] = {}
    ignored: list[str] = []

    for key, value in payload.items():
        # 明确跳过的字段由调用方处理，不计入未知字段
        if key in skipped:
            continue

        column: str | None = field_map.get(key)
        if column is None:
            ignored.append(key)
            continue

        values[column] = value

    # 未知字段记录告警：说明前端新增字段但后端契约未同步
    if ignored:
        logger.warning("集合 %s 存在未映射字段，已忽略：%s", collection, ", ".join(ignored))

    return values, ignored


def require_fields(
    collection: str,
    values: dict[str, Any],
    required: Iterable[str],
) -> None:
    """校验必填列是否存在且非 None。

    参数：
        collection: 前端集合名（用于错误信息）。
        values: 已转换的列字典。
        required: 必填的数据库列名集合。

    异常：
        HTTPException: 缺少必填字段时返回 400。

    说明：
        FastAPI 未为通用字典请求体做模型校验，这里集中补齐最小校验，
        保证不会写出主键为空等不可用数据。
    """
    # 收集缺失字段
    missing: list[str] = [
        column for column in required if values.get(column) is None
    ]

    if missing:
        # 错误信息使用前端字段名，便于调用方定位请求体
        reverse: dict[str, str] = _reverse_field_map(collection)
        display: list[str] = [reverse.get(column, column) for column in missing]
        logger.error("集合 %s 缺少必填字段：%s", collection, ", ".join(display))
        raise HTTPException(
            status_code=400,
            detail=f"缺少必填字段：{', '.join(display)}",
        )
