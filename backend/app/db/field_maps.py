"""前后端字段映射表（唯一来源）。

职责：
- 声明「前端 Dexie camelCase 字段」→「SQLite snake_case 列」的映射关系
- 同时供数据迁移导入（app/services/migration/importer.py）与业务 REST API 使用
- 学习计划三张表为后端独有能力、无 Dexie 来源，映射条目仅服务 REST 契约

说明：
    字段映射是前后端契约的一部分，必须只有一处定义。
    历史上该表内联在 importer.py 中，批次B抽取到此模块，
    避免 API 序列化再写一份映射造成字段漂移。
"""

from __future__ import annotations

# 前端 camelCase 字段 → 数据库 snake_case 字段 的映射
# 说明：显式声明映射，避免因隐式驼峰转换规则变化导致字段被静默丢弃
FIELD_MAPS: dict[str, dict[str, str]] = {
    "courses": {
        "id": "id",
        "title": "title",
        "description": "description",
        "category": "category",
        "difficulty": "difficulty",
        "cefrLevel": "cefr_level",
        "lessonCount": "lesson_count",
        "tags": "tags",
        "coverImage": "cover_image",
        "createdAt": "created_at",
        "updatedAt": "updated_at",
        "isPreset": "is_preset",
        "author": "author",
        # 前端课程对象内嵌的课时快照（迁移时保留原始结构）
        "lessons": "lessons_snapshot",
    },
    "lessons": {
        "id": "id",
        "courseId": "course_id",
        "title": "title",
        "description": "description",
        "contentShape": "content_shape",
        "items": "items",
        "createdAt": "created_at",
        "updatedAt": "updated_at",
    },
    "courseProgress": {
        "courseId": "course_id",
        "completedLessonIds": "completed_lesson_ids",
        "currentLessonId": "current_lesson_id",
        "completionPercentage": "completion_percentage",
        "lastStudiedAt": "last_studied_at",
    },
    "practiceRecords": {
        "id": "id",
        "courseId": "course_id",
        "lessonId": "lesson_id",
        "mode": "mode",
        "accuracy": "accuracy",
        "duration": "duration",
        "completedAt": "completed_at",
        "incorrectItemIds": "incorrect_item_ids",
        # 批次C 新增：真实统计所需的题量与打字速度字段
        "totalItems": "total_items",
        "correctItems": "correct_items",
        "wpm": "wpm",
    },
    "learningList": {
        "courseId": "course_id",
        "addedAt": "added_at",
        "totalStudyTime": "total_study_time",
    },
    "wordMasteryItems": {
        "word": "word",
        "source": "source",
        "level": "level",
        "nextReview": "next_review",
        # 前端字段名是 interval，数据库列名是 interval_days
        "interval": "interval_days",
        "reviewCount": "review_count",
        "consecutiveCorrect": "consecutive_correct",
        "lastReview": "last_review",
        "createdAt": "created_at",
        "easeFactor": "ease_factor",
    },
    "reviewLogs": {
        "id": "id",
        "word": "word",
        "source": "source",
        "reviewDate": "review_date",
        "quality": "quality",
        "correct": "correct",
        "responseTime": "response_time",
        "level": "level",
    },
    "typingRecords": {
        "id": "id",
        "wpm": "wpm",
        "accuracy": "accuracy",
        "date": "date",
        "practiceType": "practice_type",
        "difficulty": "difficulty",
        "word": "word",
        "source": "source",
    },
    "learningRecords": {
        "id": "id",
        "userId": "user_id",
        "courseId": "course_id",
        "lessonId": "lesson_id",
        "activityType": "activity_type",
        "score": "score",
        "accuracy": "accuracy",
        "duration": "duration",
        "createdAt": "created_at",
        # 前端字段名 metadata，数据库列名 metadata、ORM 属性名 extra_metadata
        "metadata": "extra_metadata",
    },
    "achievements": {
        "id": "id",
        "type": "type",
        "name": "name",
        "description": "description",
        "unlockedAt": "unlocked_at",
        "courseId": "course_id",
        "lessonId": "lesson_id",
    },
    "aiTaskLogs": {
        "id": "id",
        "type": "type",
        "status": "status",
        "input": "input",
        "output": "output",
        "error": "error",
        "createdAt": "created_at",
        "completedAt": "completed_at",
    },
    "practiceAttemptEvents": {
        "id": "id",
        "createdAt": "created_at",
        "courseId": "course_id",
        "lessonId": "lesson_id",
        "unitId": "unit_id",
        "mode": "mode",
        "referenceText": "reference_text",
        "chineseHint": "chinese_hint",
        "userText": "user_text",
        "recognizedText": "recognized_text",
        "correct": "correct",
        "attemptCount": "attempt_count",
        "hintLevelAtSubmit": "hint_level_at_submit",
        "nextHintLevel": "next_hint_level",
        "similarity": "similarity",
        "scoreDetail": "score_detail",
        "extra": "extra",
    },
    "unitMasteryItems": {
        "courseId": "course_id",
        "unitId": "unit_id",
        "mode": "mode",
        "lessonId": "lesson_id",
        "level": "level",
        "nextReview": "next_review",
        # 前端字段名是 interval，数据库列名是 interval_days
        "interval": "interval_days",
        "reviewCount": "review_count",
        "consecutiveCorrect": "consecutive_correct",
        "lastReview": "last_review",
        "createdAt": "created_at",
        "easeFactor": "ease_factor",
        "rollingAccuracy": "rolling_accuracy",
        "weakDimensions": "weak_dimensions",
        "extra": "extra",
    },
    "unitReviewLogs": {
        "id": "id",
        "courseId": "course_id",
        "unitId": "unit_id",
        "mode": "mode",
        "lessonId": "lesson_id",
        "reviewDate": "review_date",
        "quality": "quality",
        "correct": "correct",
        "level": "level",
        "weakDimensions": "weak_dimensions",
        "extra": "extra",
    },
    # ------------------------------------------------------------------
    # 学习计划（后端独有能力）：前端字段 → 数据库列
    # ------------------------------------------------------------------
    "studyPlans": {
        "id": "id",
        "title": "title",
        "description": "description",
        "courseIds": "course_ids",
        "dailyMinutes": "daily_minutes",
        "startAt": "start_at",
        "targetAt": "target_at",
        "status": "status",
        "reminderEnabled": "reminder_enabled",
        "createdAt": "created_at",
        "updatedAt": "updated_at",
    },
    "studyPlanTasks": {
        "id": "id",
        "planId": "plan_id",
        "title": "title",
        "dueDate": "due_date",
        "doneAt": "done_at",
        "createdAt": "created_at",
        "updatedAt": "updated_at",
    },
    "studyPlanCheckins": {
        "id": "id",
        "planId": "plan_id",
        "checkinDate": "checkin_date",
        "minutes": "minutes",
        "lessonCount": "lesson_count",
        "customTaskCount": "custom_task_count",
        "reviewCount": "review_count",
        "note": "note",
        "createdAt": "created_at",
    },
}
