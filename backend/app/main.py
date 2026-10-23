"""FastAPI 应用入口。

职责：
- 创建应用实例并注册全局中间件（CORS）
- 挂载路由（当前阶段仅健康检查）
- 提供本地单机启动入口：python -m app.main

部署形态：本地单机、单用户、无登录体系，
因此监听 127.0.0.1，并通过 CORS 白名单限制来源。
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api.routers import health
from app.core.config import get_settings
from app.core.logging import get_logger, setup_logging

# 启动引导：先建立日志系统，再创建应用，确保启动过程可追踪
setup_logging()

# 模块级日志器
logger = get_logger(__name__)


def create_app() -> FastAPI:
    """创建并配置 FastAPI 应用实例。

    返回：
        完成路由与中间件注册的 FastAPI 应用。

    说明：
        工厂函数形式便于测试时构造独立实例，避免全局状态污染。
    """
    # 读取全局配置
    settings = get_settings()

    # 应用元信息用于自动生成的 OpenAPI 文档
    app = FastAPI(
        title=settings.app_name,
        version=__version__,
        description="LexiType Academy 本地单机后端服务",
    )

    # 跨域配置：仅允许本机前端页面访问，符合单机部署安全边界
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 注册健康检查路由，统一前缀 /api
    app.include_router(health.router, prefix="/api")

    # 记录启动信息，便于确认实际生效的配置
    logger.info(
        "应用已创建：name=%s，version=%s，env=%s，cors=%s",
        settings.app_name,
        __version__,
        settings.app_env,
        ",".join(settings.cors_origins),
    )

    return app


# 模块级应用实例：供 uvicorn 直接引用（uvicorn app.main:app）
app = create_app()


def main() -> None:
    """本地单机启动入口。

    说明：
        使用 uvicorn 以单进程方式启动，绑定 127.0.0.1，
        符合“本地单机、无外网暴露”的部署约束。
    """
    # 延迟导入 uvicorn，避免测试环境不安装时导入失败
    import uvicorn

    # 读取监听地址与端口
    settings = get_settings()

    # 记录启动参数
    logger.info("开始启动服务：http://%s:%s", settings.host, settings.port)

    # 启动 ASGI 服务器
    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=(settings.app_env == "development"),
        log_config=None,
    )


# 允许通过 python -m app.main 直接运行
if __name__ == "__main__":
    main()
