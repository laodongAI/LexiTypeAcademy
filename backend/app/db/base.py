"""数据库连接与 ORM 基类。

职责：
- 创建 SQLite 引擎与会话工厂（本地单机，单文件数据库）
- 定义全局声明式 Base，并统一约束命名规则，便于后续 Alembic 迁移
- 提供会话上下文管理器，保证异常时自动回滚

说明：
    SQLite 默认不启用外键约束与 WAL，这里通过连接事件统一开启，
    以兼顾单机并发读写与后续可能的关联校验。
"""

from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
from typing import Generator, Iterator

from sqlalchemy import MetaData, create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings
from app.core.logging import get_logger

# 模块级日志器
logger = get_logger(__name__)

# 统一约束命名规则：保证 Alembic 生成稳定、可读的约束名
NAMING_CONVENTION: dict[str, str] = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    """所有 ORM 模型的声明式基类。

    说明：
        通过 metadata 的命名约定统一索引、主键、外键命名，
        避免 Alembic 生成随机的约束名导致迁移不可读。
    """

    # 全局元数据：携带命名约定
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


def resolve_sqlite_url(raw_url: str) -> str:
    """把配置中的相对 SQLite 连接串解析为绝对路径。

    参数：
        raw_url: 配置中心提供的数据库连接串。

    返回：
        绝对路径的 SQLite 连接串。

    说明：
        避免因启动时工作目录不同，指向不同的数据库文件。
    """
    # 非 SQLite 连接串原样返回，交由 SQLAlchemy 处理
    if not raw_url.startswith("sqlite:///"):
        return raw_url

    # 去掉前缀得到路径部分
    raw_path: str = raw_url.removeprefix("sqlite:///")

    # 已是绝对路径（Windows 盘符或 Unix 根路径）则直接返回
    path = Path(raw_path)
    if path.is_absolute():
        return raw_url

    # 相对路径以 backend/ 目录为基准，保证不同启动目录下指向同一文件
    absolute_path: Path = (Path(__file__).resolve().parents[2] / raw_path).resolve()
    absolute_path.parent.mkdir(parents=True, exist_ok=True)
    return f"sqlite:///{absolute_path.as_posix()}"


def _build_engine() -> Engine:
    """构建 SQLAlchemy 引擎。

    返回：
        绑定本地 SQLite 文件的 Engine 实例。
    """
    # 读取配置并解析连接串
    settings = get_settings()
    url: str = resolve_sqlite_url(settings.database_url)

    # 创建引擎：关闭同线程校验以支持 FastAPI 的多线程调用
    engine = create_engine(
        url,
        echo=False,
        future=True,
        connect_args={"check_same_thread": False, "timeout": 30},
    )

    # 注册连接事件：启用外键与 WAL，提升单机读写可靠性
    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_connection, _connection_record) -> None:  # noqa: ANN001
        """SQLite 连接建立时的初始化钩子。"""
        cursor = dbapi_connection.cursor()
        # 开启外键约束（SQLite 默认关闭）
        cursor.execute("PRAGMA foreign_keys=ON")
        # 开启 WAL 模式：读写并发更友好，异常后恢复能力更强
        cursor.execute("PRAGMA journal_mode=WAL")
        # 同步模式 NORMAL：单机场景下速度与安全性的平衡点
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.close()

    logger.info("数据库引擎已创建：%s", url)
    return engine


# 全局引擎与会话工厂：进程内单例
ENGINE: Engine = _build_engine()
SessionLocal = sessionmaker(bind=ENGINE, autoflush=False, expire_on_commit=False, class_=Session)


@contextmanager
def session_scope() -> Iterator[Session]:
    """提供带事务边界的会话上下文。

    产出：
        Session 实例。

    说明：
        正常退出时提交，异常时回滚并重新抛出，调用方无需关心事务收尾。
    """
    session: Session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception as exc:  # noqa: BLE001 - 需要捕获全部异常以回滚
        session.rollback()
        logger.error("数据库事务回滚：%s", exc)
        raise
    finally:
        session.close()


def get_session() -> Generator[Session, None, None]:
    """FastAPI 依赖：提供按请求生命周期的只读会话。

    产出：
        Session 实例。

    说明：
        路由层通过 Depends(get_session) 获取，请求结束自动关闭。
    """
    session: Session = SessionLocal()
    try:
        yield session
    finally:
        session.close()
