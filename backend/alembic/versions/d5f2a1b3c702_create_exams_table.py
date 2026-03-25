"""create_exams_table

Revision ID: d5f2a1b3c702
Revises: c4e9f2a3b501
Create Date: 2026-03-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5f2a1b3c702'
down_revision: Union[str, None] = 'c4e9f2a3b501'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'exams',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('course_name', sa.String(length=200), nullable=False),
        sa.Column('exam_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('exam_time', sa.String(length=20), nullable=True),
        sa.Column('location', sa.String(length=200), nullable=True),
        sa.Column('exam_type', sa.String(length=50), server_default='期末考试', nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_exams_user_id', 'exams', ['user_id'])


def downgrade() -> None:
    op.drop_index('ix_exams_user_id', table_name='exams')
    op.drop_table('exams')
