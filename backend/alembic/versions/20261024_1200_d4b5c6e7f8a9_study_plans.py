"""study plans

Revision ID: d4b5c6e7f8a9
Revises: c1a2b3d4e5f6
Create Date: 2026-10-24 12:00:00

说明：
    批次C 切片2：新增学习计划三张表。
    - study_plans：计划主体（多课程、每日目标、状态、提醒开关）
    - study_plan_tasks：自定义每日任务（课时任务动态派生，不落库）
    - study_plan_checkins：每日打卡快照（plan_id + checkin_date 唯一）
    三张表均为后端独有能力，无 Dexie 历史数据需要迁移。
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# 迁移版本标识
revision: str = 'd4b5c6e7f8a9'
# 上一个版本标识（练习指标迁移）
down_revision: Union[str, None] = 'c1a2b3d4e5f6'
# 分支标签
branch_labels: Union[str, Sequence[str], None] = None
# 依赖的其他迁移
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """升级到本版本：创建学习计划相关三张表及索引。"""
    # 计划主体表
    op.create_table(
        'study_plans',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=512), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        # 关联课程 ID 数组（JSON 字符串）
        sa.Column('course_ids', sa.JSON(), nullable=True),
        sa.Column('daily_minutes', sa.Integer(), nullable=False),
        sa.Column('start_at', sa.Integer(), nullable=False),
        sa.Column('target_at', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=32), nullable=False),
        sa.Column('reminder_enabled', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_study_plans')),
    )
    with op.batch_alter_table('study_plans', schema=None) as batch_op:
        # 计划列表按更新时间倒序、按状态筛选，故均建索引
        batch_op.create_index(batch_op.f('ix_study_plans_title'), ['title'], unique=False)
        batch_op.create_index(batch_op.f('ix_study_plans_start_at'), ['start_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_study_plans_status'), ['status'], unique=False)
        batch_op.create_index(batch_op.f('ix_study_plans_created_at'), ['created_at'], unique=False)
        batch_op.create_index(batch_op.f('ix_study_plans_updated_at'), ['updated_at'], unique=False)

    # 自定义每日任务表
    op.create_table(
        'study_plan_tasks',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('plan_id', sa.String(length=64), nullable=False),
        sa.Column('title', sa.String(length=512), nullable=False),
        # 为空表示每天重复
        sa.Column('due_date', sa.Integer(), nullable=True),
        sa.Column('done_at', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.Integer(), nullable=False),
        sa.Column('updated_at', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_study_plan_tasks')),
    )
    with op.batch_alter_table('study_plan_tasks', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_study_plan_tasks_plan_id'), ['plan_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_study_plan_tasks_due_date'), ['due_date'], unique=False)
        batch_op.create_index(batch_op.f('ix_study_plan_tasks_created_at'), ['created_at'], unique=False)

    # 每日打卡快照表
    op.create_table(
        'study_plan_checkins',
        sa.Column('id', sa.String(length=64), nullable=False),
        sa.Column('plan_id', sa.String(length=64), nullable=False),
        sa.Column('checkin_date', sa.Integer(), nullable=False),
        sa.Column('minutes', sa.Integer(), nullable=False),
        sa.Column('lesson_count', sa.Integer(), nullable=False),
        sa.Column('custom_task_count', sa.Integer(), nullable=False),
        sa.Column('review_count', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), nullable=True),
        sa.Column('created_at', sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint('id', name=op.f('pk_study_plan_checkins')),
        # 同计划同一天只允许一条打卡记录（重复打卡按覆盖处理）
        sa.UniqueConstraint(
            'plan_id',
            'checkin_date',
            name='uq_study_plan_checkins_plan_date',
        ),
    )
    with op.batch_alter_table('study_plan_checkins', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_study_plan_checkins_plan_id'), ['plan_id'], unique=False)
        batch_op.create_index(
            batch_op.f('ix_study_plan_checkins_checkin_date'), ['checkin_date'], unique=False
        )
        batch_op.create_index(
            batch_op.f('ix_study_plan_checkins_created_at'), ['created_at'], unique=False
        )


def downgrade() -> None:
    """回退到上一版本：删除学习计划三张表。"""
    # 先删子表索引与表，再删主表，避免残留
    with op.batch_alter_table('study_plan_checkins', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_study_plan_checkins_created_at'))
        batch_op.drop_index(batch_op.f('ix_study_plan_checkins_checkin_date'))
        batch_op.drop_index(batch_op.f('ix_study_plan_checkins_plan_id'))
    op.drop_table('study_plan_checkins')

    with op.batch_alter_table('study_plan_tasks', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_study_plan_tasks_created_at'))
        batch_op.drop_index(batch_op.f('ix_study_plan_tasks_due_date'))
        batch_op.drop_index(batch_op.f('ix_study_plan_tasks_plan_id'))
    op.drop_table('study_plan_tasks')

    with op.batch_alter_table('study_plans', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_study_plans_updated_at'))
        batch_op.drop_index(batch_op.f('ix_study_plans_created_at'))
        batch_op.drop_index(batch_op.f('ix_study_plans_status'))
        batch_op.drop_index(batch_op.f('ix_study_plans_start_at'))
        batch_op.drop_index(batch_op.f('ix_study_plans_title'))
    op.drop_table('study_plans')
