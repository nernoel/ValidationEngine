import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from app.schemas import ValidationResponse, ValidationSummary

DB_PATH = Path(__file__).resolve().parents[1] / "validation_history.db"


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS validations (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                user_idea TEXT NOT NULL,
                narrowed_down_idea TEXT NOT NULL DEFAULT '',
                pros TEXT NOT NULL DEFAULT '',
                cons TEXT NOT NULL DEFAULT '',
                difficulty_score TEXT NOT NULL DEFAULT '',
                competitors_list TEXT NOT NULL DEFAULT '',
                validation_score TEXT NOT NULL DEFAULT '',
                validation_score_reasoning TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()


def _row_factory(cursor: sqlite3.Cursor, row: tuple) -> dict:
    return {column[0]: row[index] for index, column in enumerate(cursor.description)}


def _make_title(user_idea: str) -> str:
    title = " ".join(user_idea.strip().split())
    if len(title) <= 54:
        return title
    return f"{title[:51].rstrip()}..."


def save_validation(response: ValidationResponse) -> ValidationResponse:
    init_db()
    validation_id = uuid4().hex
    created_at = datetime.now(timezone.utc).isoformat()
    title = _make_title(response.user_idea)

    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO validations (
                id,
                title,
                user_idea,
                narrowed_down_idea,
                pros,
                cons,
                difficulty_score,
                competitors_list,
                validation_score,
                validation_score_reasoning,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                validation_id,
                title,
                response.user_idea,
                response.narrowed_down_idea,
                response.pros,
                response.cons,
                response.difficulty_score,
                response.competitors_list,
                response.validation_score,
                response.validation_score_reasoning,
                created_at,
            ),
        )
        conn.commit()

    response.id = validation_id
    response.title = title
    response.created_at = created_at
    return response


def list_validations() -> list[ValidationSummary]:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = _row_factory
        rows = conn.execute(
            """
            SELECT id, title, user_idea, validation_score, difficulty_score, created_at
            FROM validations
            ORDER BY created_at DESC
            """
        ).fetchall()

    return [ValidationSummary(**row) for row in rows]


def get_validation(validation_id: str) -> ValidationResponse | None:
    init_db()
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = _row_factory
        row = conn.execute(
            """
            SELECT
                id,
                title,
                user_idea,
                narrowed_down_idea,
                pros,
                cons,
                difficulty_score,
                competitors_list,
                validation_score,
                validation_score_reasoning,
                created_at
            FROM validations
            WHERE id = ?
            """,
            (validation_id,),
        ).fetchone()

    if row is None:
        return None
    return ValidationResponse(**row)
