"""健康检查路由。

职责：
- 提供 /api/health 探活接口，前端与开发脚本用它判断后端是否就绪
- 返回应用版本、运行环境与关键目录可用性，便于单机部署自检
"""

from __future__ import annotations

import re

from fastapi import APIRouter, Query

from app import __version__
from app.core.config import get_settings
from app.core.logging import get_logger

# 模块级日志器：记录健康检查过程中的异常与关键信息
logger = get_logger(__name__)

# 健康检查路由：统一挂载在 /api 前缀下
router = APIRouter(tags=["health"])


@router.get("/health")
def health_check() -> dict:
    """返回后端健康状态。

    返回：
        包含状态、版本、环境与目录可用性的字典。

    说明：
        该接口不访问数据库与模型，仅做进程级探活，
        以便前端在启动早期即可判断后端是否可用。
    """
    # 读取全局配置，用于回显版本与环境
    settings = get_settings()

    # 检查模型资产目录是否存在（缺失时前端应提示用户拷贝模型）
    models_dir_exists: bool = settings.models_path.exists()

    # 检查数据目录是否可用（配置对象已保证目录创建）
    data_dir_exists: bool = settings.data_path.exists()

    # 记录一次探活日志，级别为 debug 避免刷屏
    logger.debug(
        "健康检查被调用：版本=%s，模型目录存在=%s，数据目录存在=%s",
        __version__,
        models_dir_exists,
        data_dir_exists,
    )

    # 组装响应体：字段名保持稳定，前端按此契约解析
    return {
        "status": "ok",
        "app_name": settings.app_name,
        "version": __version__,
        "env": settings.app_env,
        "host": settings.host,
        "port": settings.port,
        "paths": {
            "models_dir": str(settings.models_path),
            "models_dir_exists": models_dir_exists,
            "data_dir": str(settings.data_path),
            "data_dir_exists": data_dir_exists,
        },
    }


@router.get("/diagnostics/backend-logs")
def read_backend_logs(limit: int = Query(default=200, ge=1, le=500)) -> dict:
    """读取固定后端日志文件的末尾若干行，供本地诊断页面使用。

    安全边界：
    - 不接受文件路径参数，只能读取配置指定的 app.log
    - 最多返回 500 行，每行截断到 2000 字符
    - 对常见密钥/授权头形式做脱敏；日志仍应避免写入敏感信息
    """
    settings = get_settings()
    log_file = settings.log_path / settings.log_file
    if not log_file.is_file():
        return {"available": False, "lines": [], "message": "后端日志文件尚未生成"}

    try:
        with log_file.open("r", encoding="utf-8", errors="replace") as stream:
            lines = stream.readlines()[-limit:]
    except OSError:
        logger.exception("读取后端日志文件失败")
        return {"available": False, "lines": [], "message": "后端日志文件暂时无法读取"}

    secret_patterns = [
        (re.compile(r"(?i)(api[_-]?key\\s*[:=]\\s*)[^\\s,;]+"), r"\\1[REDACTED]"),
        (re.compile(r"(?i)(authorization\\s*[:=]\\s*bearer\\s+)[^\\s,;]+"), r"\\1[REDACTED]"),
        (re.compile(r"(?i)(bearer\\s+)[A-Za-z0-9._~+/-]+=*"), r"\\1[REDACTED]"),
    ]
    safe_lines = []
    for line in lines:
        value = line.rstrip("\\r\\n")[:2000]
        for pattern, replacement in secret_patterns:
            value = pattern.sub(replacement, value)
        safe_lines.append(value)

    return {
        "available": True,
        "lines": safe_lines,
        "count": len(safe_lines),
        "limit": limit,
        "message": "",
    }
