"""Alembic 运行环境配置。

职责：
- 把应用的 ORM 元数据接入 Alembic，支持自动生成迁移脚本
- 复用应用的数据库连接串解析逻辑，保证迁移与运行时指向同一文件
- 在离线模式下输出 SQL，便于人工审阅

用法（在 backend/ 目录下）：
    .\.venv\Scripts\python.exe -m alembic revision --autogenerate -m "描述"
    .\.venv\Scripts\python.exe -m alembic upgrade head
"""

from __future__ import annotations

import sys
from logging.config import fileConfig
from pathlib import Path

from alembic import context
from sqlalchemy import engine_from_config, pool

# 把 backend/ 目录加入 sys.path，保证 alembic 能导入 app 包
BACKEND_ROOT: Path = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.core.config import get_settings  # noqa: E402  需要在 sys.path 调整后导入
from app.db.base import Base, resolve_sqlite_url  # noqa: E402
from app.db import models  # noqa: E402,F401  导入以注册全部 ORM 模型

# Alembic 配置对象
config = context.config

# 使用应用配置中的数据库连接串覆盖 alembic.ini 的占位值
settings = get_settings()
config.set_main_option("sqlalchemy.url", resolve_sqlite_url(settings.database_url))

# 日志配置：仅在存在配置文件时加载
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 目标元数据：自动生成迁移的比对基准
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式：仅生成 SQL，不连接数据库。"""
    # 读取连接串与元数据
    url: str = config.get_main_option("sqlalchemy.url")

    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        # 使用批量模式，兼容 SQLite 的 ALTER 限制
        render_as_batch=True,
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：连接数据库并执行迁移。"""
    # 建立引擎（连接池使用 NullPool，迁移结束后立即释放）
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            # SQLite 需要批量模式才能做列变更
            render_as_batch=True,
            compare_type=True,
        )

        with context.begin_transaction():
            context.run_migrations()


# 按运行模式分派
if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
