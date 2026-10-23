"""后端统一日志配置。

职责：
- 提供分级日志（DEBUG / INFO / WARNING / ERROR）
- 同时输出到控制台与文件，文件按大小滚动，避免单机长期运行写爆磁盘
- 统一日志格式，便于开发期排查与后续问题定位
"""

from __future__ import annotations

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path
from typing import Optional

from app.core.config import get_settings

# 单日文件日志上限：10 MB
LOG_MAX_BYTES: int = 10 * 1024 * 1024
# 日志备份文件数量，超过后覆盖最旧文件
LOG_BACKUP_COUNT: int = 5
# 统一日志格式：时间 | 级别 | 模块 | 行号 | 内容
LOG_FORMAT: str = "%(asctime)s | %(levelname)-7s | %(name)s:%(lineno)d | %(message)s"
# 日志时间格式：精确到秒即可，便于阅读
LOG_DATE_FORMAT: str = "%Y-%m-%d %H:%M:%S"

# 全局标记：避免重复挂载处理器导致日志重复输出
_configured: bool = False


def _build_formatter() -> logging.Formatter:
    """构建统一日志格式化器。

    返回：
        配置好时间与格式的 Formatter 实例。
    """
    # 使用统一格式与时区无关的时间格式
    return logging.Formatter(fmt=LOG_FORMAT, datefmt=LOG_DATE_FORMAT)


def setup_logging(level: Optional[str] = None) -> None:
    """初始化根日志器。

    参数：
        level: 可选日志级别字符串；为空时使用配置中心的值。

    说明：
        重复调用是安全的，内部通过 _configured 标记做幂等保护。
    """
    global _configured

    # 已完成初始化则直接返回，避免重复添加 handler
    if _configured:
        return

    # 读取配置中心的日志级别与文件位置
    settings = get_settings()
    # 目标日志级别：优先使用入参，其次使用配置
    resolved_level: str = (level or settings.log_level).upper()

    # 根日志器：所有模块日志的公共出口
    root_logger = logging.getLogger()
    root_logger.setLevel(resolved_level)

    # 清理已有 handler，防止 uvicorn reload 时重复输出
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    # 统一格式化器
    formatter = _build_formatter()

    # 控制台输出：开发期直接观察
    console_handler = logging.StreamHandler()
    console_handler.setLevel(resolved_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 文件输出：按大小滚动，便于长期回看
    log_file_path: Path = settings.log_path / settings.log_file
    file_handler = RotatingFileHandler(
        filename=str(log_file_path),
        maxBytes=LOG_MAX_BYTES,
        backupCount=LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setLevel(resolved_level)
    file_handler.setFormatter(formatter)
    root_logger.addHandler(file_handler)

    # 降低第三方库噪音：访问日志由 uvicorn 自行管理
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

    # 标记已初始化
    _configured = True

    # 输出初始化完成信息，验证日志链路可用
    logging.getLogger(__name__).info(
        "日志系统已初始化：级别=%s，文件=%s", resolved_level, log_file_path
    )


def get_logger(name: str) -> logging.Logger:
    """获取指定模块的日志器。

    参数：
        name: 通常传入 __name__，用于区分日志来源模块。

    返回：
        绑定到根日志配置的 Logger 实例。
    """
    # 确保日志系统已初始化后再返回模块日志器
    setup_logging()
    return logging.getLogger(name)
