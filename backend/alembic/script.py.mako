"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

说明：本迁移脚本由 Alembic 自动生成，请人工复核后再执行 upgrade。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

# 迁移版本标识
revision: str = ${repr(up_revision)}
# 上一个版本标识（首个迁移为空）
down_revision: Union[str, None] = ${repr(down_revision)}
# 分支标签
branch_labels: Union[str, Sequence[str], None] = ${repr(branch_labels)}
# 依赖的其他迁移
depends_on: Union[str, Sequence[str], None] = ${repr(depends_on)}


def upgrade() -> None:
    """升级到本版本。"""
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    """回滚本版本。"""
    ${downgrades if downgrades else "pass"}
