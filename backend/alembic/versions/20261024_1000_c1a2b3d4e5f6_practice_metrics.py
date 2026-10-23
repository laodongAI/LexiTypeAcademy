"""practice metrics

Revision ID: c1a2b3d4e5f6
Revises: e45749c807d5
Create Date: 2026-10-24 10:00:00

说明：
    批次C：为练习记录补充真实统计所需的三个可空字段。
    - total_items：本次练习总题数
    - correct_items：本次练习答对题数
    - wpm：打字速度（词/分钟），仅键盘输入类练习有值
    历史记录保持 NULL，前端聚合时自动跳过，避免用 0 污染平均值。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# 迁移版本标识
revision: str = 'c1a2b3d4e5f6'
# 上一个版本标识（初始迁移）
down_revision: Union[str, None] = 'e45749c807d5'
# 分支标签
branch_labels: Union[str, Sequence[str], None] = None
# 依赖的其他迁移
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """升级到本版本：新增练习指标字段。"""
    # SQLite 使用批量模式追加可空列，避免重建表
    with op.batch_alter_table('practice_records', schema=None) as batch_op:
        batch_op.add_column(sa.Column('total_items', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('correct_items', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('wpm', sa.Float(), nullable=True))


def downgrade() -> None:
    """回退到上一版本：移除练习指标字段。"""
    with op.batch_alter_table('practice_records', schema=None) as batch_op:
        batch_op.drop_column('wpm')
        batch_op.drop_column('correct_items')
        batch_op.drop_column('total_items')
