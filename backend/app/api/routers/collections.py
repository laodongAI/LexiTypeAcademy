"""课程集合与课程归属 API。"""

from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.db.base import session_scope
from app.db.models import Course, CourseCollection, CourseCollectionMembership

router = APIRouter(prefix="/course-collections", tags=["course-collections"])


def _now_ms() -> int:
    return int(time.time() * 1000)


def _serialize_collection(row: CourseCollection, course_ids: list[str]) -> dict[str, Any]:
    return {
        "id": row.id,
        "name": row.name,
        "parentId": row.parent_id,
        "description": row.description or "",
        "sortOrder": row.sort_order,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
        "courseIds": course_ids,
    }


@router.get("")
def list_collections() -> dict[str, Any]:
    """返回集合节点及其课程归属；前端可据 parentId 构建任意深度树。"""
    with session_scope() as session:
        nodes = list(session.scalars(select(CourseCollection).order_by(CourseCollection.sort_order, CourseCollection.name)))
        memberships = list(session.scalars(select(CourseCollectionMembership)))
        course_ids_by_collection: dict[str, list[str]] = {}
        for membership in memberships:
            course_ids_by_collection.setdefault(membership.collection_id, []).append(membership.course_id)
        items = [_serialize_collection(node, course_ids_by_collection.get(node.id, [])) for node in nodes]
    return {"items": items, "total": len(items)}


@router.post("")
def create_collection(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="集合名称不能为空")
    if len(name) > 256:
        raise HTTPException(status_code=422, detail="集合名称不能超过 256 个字符")
    parent_id = payload.get("parentId")
    now = _now_ms()
    collection_id = str(payload.get("id") or f"collection_{now}_{time.time_ns() % 1000000000:09d}")
    with session_scope() as session:
        if parent_id and session.get(CourseCollection, str(parent_id)) is None:
            raise HTTPException(status_code=404, detail="父级课程集合不存在")
        if session.get(CourseCollection, collection_id) is not None:
            raise HTTPException(status_code=409, detail="课程集合 ID 已存在")
        row = CourseCollection(
            id=collection_id,
            name=name,
            parent_id=str(parent_id) if parent_id else None,
            description=str(payload.get("description") or "").strip() or None,
            sort_order=int(payload.get("sortOrder") or 0),
            created_at=now,
            updated_at=now,
        )
        session.add(row)
        session.flush()
        result = _serialize_collection(row, [])
    return result


@router.put("/{collection_id}")
def update_collection(collection_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    with session_scope() as session:
        row = session.get(CourseCollection, collection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="课程集合不存在")
        if "name" in payload:
            name = str(payload.get("name") or "").strip()
            if not name or len(name) > 256:
                raise HTTPException(status_code=422, detail="集合名称不能为空且不能超过 256 个字符")
            row.name = name
        if "description" in payload:
            row.description = str(payload.get("description") or "").strip() or None
        if "sortOrder" in payload:
            try:
                row.sort_order = int(payload["sortOrder"])
            except (TypeError, ValueError) as exc:
                raise HTTPException(status_code=422, detail="sortOrder 必须是整数") from exc
        if "parentId" in payload:
            parent_id = payload.get("parentId")
            if parent_id in (None, ""):
                row.parent_id = None
            else:
                parent_id = str(parent_id)
                if parent_id == collection_id:
                    raise HTTPException(status_code=409, detail="集合不能成为自身的父级")
                if session.get(CourseCollection, parent_id) is None:
                    raise HTTPException(status_code=404, detail="父级课程集合不存在")
                # 避免移动到自身后代，造成层级环。
                cursor = parent_id
                visited: set[str] = set()
                while cursor:
                    if cursor == collection_id:
                        raise HTTPException(status_code=409, detail="不能将集合移动到自己的子级中")
                    if cursor in visited:
                        raise HTTPException(status_code=409, detail="现有集合层级存在循环，请先修复")
                    visited.add(cursor)
                    ancestor = session.get(CourseCollection, cursor)
                    cursor = ancestor.parent_id if ancestor else None
                row.parent_id = parent_id
        row.updated_at = _now_ms()
        session.flush()
        course_ids = list(session.scalars(select(CourseCollectionMembership.course_id).where(CourseCollectionMembership.collection_id == collection_id)))
        result = _serialize_collection(row, course_ids)
    return result


@router.delete("/{collection_id}")
def delete_collection(collection_id: str) -> dict[str, Any]:
    with session_scope() as session:
        row = session.get(CourseCollection, collection_id)
        if row is None:
            raise HTTPException(status_code=404, detail="课程集合不存在")
        has_children = session.scalar(select(CourseCollection.id).where(CourseCollection.parent_id == collection_id).limit(1))
        has_courses = session.scalar(select(CourseCollectionMembership.course_id).where(CourseCollectionMembership.collection_id == collection_id).limit(1))
        if has_children or has_courses:
            raise HTTPException(status_code=409, detail="集合仍包含子集合或课程，请先移动内容")
        session.delete(row)
    return {"success": True, "id": collection_id}


@router.put("/{collection_id}/courses/{course_id}")
def assign_course(collection_id: str, course_id: str) -> dict[str, Any]:
    now = _now_ms()
    with session_scope() as session:
        if session.get(CourseCollection, collection_id) is None:
            raise HTTPException(status_code=404, detail="课程集合不存在")
        if session.get(Course, course_id) is None:
            raise HTTPException(status_code=404, detail="课程不存在")
        membership = session.get(CourseCollectionMembership, course_id)
        if membership is None:
            membership = CourseCollectionMembership(course_id=course_id, collection_id=collection_id, created_at=now)
            session.add(membership)
        else:
            membership.collection_id = collection_id
            membership.created_at = now
        session.flush()
    return {"success": True, "courseId": course_id, "collectionId": collection_id}


@router.delete("/courses/{course_id}")
def unassign_course(course_id: str) -> dict[str, Any]:
    with session_scope() as session:
        membership = session.get(CourseCollectionMembership, course_id)
        if membership is not None:
            session.delete(membership)
    return {"success": True, "courseId": course_id}
