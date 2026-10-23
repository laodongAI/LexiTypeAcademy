"""后端应用配置中心。

职责：
- 集中读取环境变量（.env / 系统环境），提供全局唯一的配置对象
- 统一管理本地单机部署的监听地址、CORS 白名单、日志与数据目录
- 对外暴露目录路径解析方法，避免各模块各自拼接路径导致漂移
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/ 目录绝对路径：本文件位于 backend/app/core/config.py，向上三级即为 backend/
BACKEND_ROOT: Path = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """应用配置对象。

    所有字段均可通过环境变量覆盖，命名遵循大写下划线风格；
    默认值面向“本地单机、单用户、无登录”的部署形态。
    """

    # 模型配置：读取 backend/.env，忽略未声明的环境变量
    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---------- 应用基础信息 ----------
    # 应用名称，用于 OpenAPI 文档与健康检查返回
    app_name: str = Field(default="LexiType Academy API", alias="APP_NAME")
    # 应用版本号，用于健康检查与前端版本比对
    app_version: str = Field(default="0.3.0", alias="APP_VERSION")
    # 运行环境标识：development / production
    app_env: str = Field(default="development", alias="APP_ENV")

    # ---------- 监听地址 ----------
    # 监听主机：本地单机固定 127.0.0.1，不对外暴露
    host: str = Field(default="127.0.0.1", alias="APP_HOST")
    # 监听端口：默认 8010，避开本机其它项目长期占用的 8000
    port: int = Field(default=8010, alias="APP_PORT")

    # ---------- 日志 ----------
    # 日志级别：DEBUG / INFO / WARNING / ERROR
    log_level: str = Field(default="INFO", alias="LOG_LEVEL")
    # 日志目录（相对 backend/ 目录）
    log_dir: str = Field(default="logs", alias="LOG_DIR")
    # 日志文件名
    log_file: str = Field(default="app.log", alias="LOG_FILE")

    # ---------- 前端跨域 ----------
    # 允许访问后端的前端来源列表，逗号分隔
    cors_origins_raw: str = Field(
        default="http://localhost:5183,http://127.0.0.1:5183",
        alias="CORS_ORIGINS",
    )

    # ---------- 数据与模型资产 ----------
    # 业务数据目录（SQLite、导入中间文件等），相对 backend/
    data_dir: str = Field(default="data", alias="DATA_DIR")
    # 模型资产根目录（TTS/ASR 模型整体拷贝到此，不入版本库）
    models_dir: str = Field(default="models", alias="MODELS_DIR")
    # 数据库连接串，阶段2接入 SQLAlchemy 后生效
    database_url: str = Field(default="sqlite:///./data/lexitype.db", alias="DATABASE_URL")

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        """规范化日志级别：统一大写，避免小写配置导致日志级别不生效。"""
        # 去除空白并转大写后返回
        return value.strip().upper()

    @property
    def cors_origins(self) -> List[str]:
        """返回解析后的 CORS 来源列表。

        说明：BaseSettings 对 List 类型的默认解析要求 JSON 格式，
        这里改用字符串 + 手动拆分，方便 .env 中直接写逗号分隔值。
        """
        # 按逗号拆分、去空白、过滤空项
        return [item.strip() for item in self.cors_origins_raw.split(",") if item.strip()]

    @property
    def log_path(self) -> Path:
        """返回日志目录绝对路径，目录不存在时自动创建。"""
        # 拼接 backend/ 下的日志目录
        path = BACKEND_ROOT / self.log_dir
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def data_path(self) -> Path:
        """返回数据目录绝对路径，目录不存在时自动创建。"""
        # 拼接 backend/ 下的数据目录
        path = BACKEND_ROOT / self.data_dir
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def models_path(self) -> Path:
        """返回模型资产根目录绝对路径（不自动创建）。

        说明：模型由用户从本地拷贝，缺失时应报错而不是静默建空目录。
        """
        # 拼接 backend/ 下的模型目录
        return BACKEND_ROOT / self.models_dir


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """获取全局配置单例。

    使用 lru_cache 保证进程内只解析一次 .env，
    避免各模块重复读取环境变量造成初始化开销与不一致。
    """
    # 第一次调用时实例化，后续直接复用缓存对象
    return Settings()
