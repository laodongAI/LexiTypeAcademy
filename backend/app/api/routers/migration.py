"""数据迁移路由。

职责：
- 提供导出文件的 HTTP 上传导入入口（前端设置页可直接调用）
- 提供历史报告查询，便于回看每次迁移的校验结果

说明：
    本地单机、单用户，接口不涉及鉴权；导入为覆盖式写入，
    调用前请确认已理解行为，服务内部会先自动备份数据库。
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.migration.importer import MigrationError, run_import

# 模块级日志器
logger = get_logger(__name__)

# 迁移路由：统一挂载在 /api/migration
router = APIRouter(prefix="/migration", tags=["migration"])

# 上传文件大小上限：100 MB（纯 JSON 文本，含全部业务数据）
MAX_UPLOAD_BYTES: int = 100 * 1024 * 1024


@router.post("/import")
async def import_indexeddb(file: UploadFile = File(...)) -> dict[str, Any]:
    """上传导出 JSON 并执行迁移。

    参数：
        file: 前端导出脚本生成的 JSON 文件。

    返回：
        迁移校验报告。

    异常：
        HTTPException: 文件为空/过大/格式错误/导入失败。
    """
    # 读取上传内容（本地单机，文件不大，一次性读入内存）
    content: bytes = await file.read()

    # 空文件直接拒绝
    if not content:
        raise HTTPException(status_code=400, detail="上传文件为空")

    # 体积上限保护，避免异常大文件占用内存
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="上传文件超过 100 MB 限制")

    # 写入临时文件，复用基于文件路径的迁移实现
    settings = get_settings()
    tmp_dir: Path = settings.data_path / "tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    tmp_path: Path = tmp_dir / f"import-{file.filename or 'export.json'}"
    tmp_path.write_bytes(content)

    logger.info("收到迁移文件：%s（%s 字节）", tmp_path, len(content))

    try:
        report = run_import(tmp_path)
    except MigrationError as exc:
        logger.error("迁移失败：%s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    finally:
        # 临时文件用完即删，避免长期堆积
        if tmp_path.exists():
            tmp_path.unlink()

    return report


@router.get("/reports")
def list_reports() -> dict[str, Any]:
    """列出已有迁移报告。

    返回：
        报告 ID 列表（按文件名倒序，最新在前）。
    """
    report_dir: Path = get_settings().data_path / "migration-reports"

    # 目录不存在时返回空列表
    if not report_dir.exists():
        return {"total": 0, "report_ids": []}

    # 只取 .json 文件，并按名称倒序
    report_ids: list[str] = sorted(
        (path.stem for path in report_dir.glob("*.json")), reverse=True
    )

    return {"total": len(report_ids), "report_ids": report_ids}


@router.get("/reports/{report_id}")
def get_report(report_id: str) -> dict[str, Any]:
    """按 ID 读取单份迁移报告。

    参数：
        report_id: 报告文件名（不含扩展名）。

    返回：
        报告内容字典。

    异常：
        HTTPException: 报告不存在或内容非法。
    """
    report_path: Path = get_settings().data_path / "migration-reports" / f"{report_id}.json"

    # 文件不存在返回 404
    if not report_path.exists():
        raise HTTPException(status_code=404, detail=f"报告不存在：{report_id}")

    try:
        with report_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=500, detail=f"报告内容损坏：{exc}") from exc
