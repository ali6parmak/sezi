"""
Storage module for Sezi - handles persistence of reading progress and settings.
Uses SQLite for lightweight, file-based storage.
"""

import aiosqlite
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

DATABASE_PATH = Path(__file__).parent / "data" / "sezi.db"


async def init_database():
    """Initialize the database with required tables."""
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Documents table - stores info about opened documents
        await db.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                file_path TEXT UNIQUE NOT NULL,
                file_name TEXT NOT NULL,
                total_pages INTEGER DEFAULT 0,
                total_words INTEGER DEFAULT 0,
                total_sentences INTEGER DEFAULT 0,
                last_opened TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Reading progress table - stores where user left off
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reading_progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                current_page INTEGER DEFAULT 1,
                current_position INTEGER DEFAULT 0,
                reading_mode TEXT DEFAULT 'word',
                completed BOOLEAN DEFAULT FALSE,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            )
        """)
        
        # User settings table
        await db.execute("""
            CREATE TABLE IF NOT EXISTS settings (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                font_family TEXT DEFAULT 'JetBrains Mono',
                font_size INTEGER DEFAULT 48,
                font_color TEXT DEFAULT '#E2E8F0',
                background_color TEXT DEFAULT '#0F172A',
                highlight_color TEXT DEFAULT '#F97316',
                reading_speed INTEGER DEFAULT 250,
                theme TEXT DEFAULT 'midnight',
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Reading statistics
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reading_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                document_id INTEGER NOT NULL,
                session_date DATE DEFAULT CURRENT_DATE,
                words_read INTEGER DEFAULT 0,
                time_spent_seconds INTEGER DEFAULT 0,
                FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
            )
        """)
        
        # Insert default settings if not exists
        await db.execute("""
            INSERT OR IGNORE INTO settings (id) VALUES (1)
        """)
        
        await db.commit()


async def get_recent_documents(limit: int = 10):
    """Get the most recently opened documents."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT d.*, rp.current_page, rp.current_position, rp.reading_mode, rp.completed
            FROM documents d
            LEFT JOIN reading_progress rp ON d.id = rp.document_id
            ORDER BY d.last_opened DESC
            LIMIT ?
        """, (limit,))
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]


async def add_or_update_document(file_path: str, file_name: str, total_pages: int, 
                                  total_words: int, total_sentences: int):
    """Add a new document or update existing one's last_opened timestamp."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Check if document exists
        cursor = await db.execute(
            "SELECT id FROM documents WHERE file_path = ?", (file_path,)
        )
        existing = await cursor.fetchone()
        
        if existing:
            # Update last_opened
            await db.execute("""
                UPDATE documents 
                SET last_opened = CURRENT_TIMESTAMP,
                    total_pages = ?,
                    total_words = ?,
                    total_sentences = ?
                WHERE file_path = ?
            """, (total_pages, total_words, total_sentences, file_path))
            doc_id = existing[0]
        else:
            # Insert new document
            cursor = await db.execute("""
                INSERT INTO documents (file_path, file_name, total_pages, total_words, total_sentences)
                VALUES (?, ?, ?, ?, ?)
            """, (file_path, file_name, total_pages, total_words, total_sentences))
            doc_id = cursor.lastrowid
            
            # Create initial reading progress
            await db.execute("""
                INSERT INTO reading_progress (document_id)
                VALUES (?)
            """, (doc_id,))
        
        await db.commit()
        return doc_id


async def get_document_by_path(file_path: str):
    """Get document info by file path."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT d.*, rp.current_page, rp.current_position, rp.reading_mode, rp.completed
            FROM documents d
            LEFT JOIN reading_progress rp ON d.id = rp.document_id
            WHERE d.file_path = ?
        """, (file_path,))
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_reading_progress(document_id: int, current_page: int, 
                                   current_position: int, reading_mode: str,
                                   completed: bool = False):
    """Update reading progress for a document."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("""
            UPDATE reading_progress 
            SET current_page = ?, current_position = ?, reading_mode = ?, 
                completed = ?, last_updated = CURRENT_TIMESTAMP
            WHERE document_id = ?
        """, (current_page, current_position, reading_mode, completed, document_id))
        await db.commit()


async def get_settings():
    """Get user settings."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM settings WHERE id = 1")
        row = await cursor.fetchone()
        return dict(row) if row else None


async def update_settings(**kwargs):
    """Update user settings."""
    if not kwargs:
        return
    
    valid_fields = {'font_family', 'font_size', 'font_color', 'background_color', 
                    'highlight_color', 'reading_speed', 'theme'}
    filtered = {k: v for k, v in kwargs.items() if k in valid_fields}
    
    if not filtered:
        return
    
    set_clause = ", ".join([f"{k} = ?" for k in filtered.keys()])
    values = list(filtered.values())
    
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute(f"""
            UPDATE settings 
            SET {set_clause}, last_updated = CURRENT_TIMESTAMP
            WHERE id = 1
        """, values)
        await db.commit()


async def update_reading_stats(document_id: int, words_read: int, time_spent_seconds: int):
    """Update reading statistics for today's session."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # Try to update existing stat for today
        cursor = await db.execute("""
            UPDATE reading_stats 
            SET words_read = words_read + ?, time_spent_seconds = time_spent_seconds + ?
            WHERE document_id = ? AND session_date = DATE('now')
        """, (words_read, time_spent_seconds, document_id))
        
        if cursor.rowcount == 0:
            # Insert new stat for today
            await db.execute("""
                INSERT INTO reading_stats (document_id, words_read, time_spent_seconds)
                VALUES (?, ?, ?)
            """, (document_id, words_read, time_spent_seconds))
        
        await db.commit()


async def get_reading_stats(document_id: Optional[int] = None):
    """Get reading statistics, optionally filtered by document."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        
        if document_id:
            cursor = await db.execute("""
                SELECT SUM(words_read) as total_words, 
                       SUM(time_spent_seconds) as total_time,
                       COUNT(DISTINCT session_date) as sessions
                FROM reading_stats
                WHERE document_id = ?
            """, (document_id,))
        else:
            cursor = await db.execute("""
                SELECT SUM(words_read) as total_words, 
                       SUM(time_spent_seconds) as total_time,
                       COUNT(DISTINCT session_date) as sessions
                FROM reading_stats
            """)
        
        row = await cursor.fetchone()
        return dict(row) if row else None


async def delete_document(document_id: int):
    """Delete a document and its associated progress/stats."""
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("DELETE FROM documents WHERE id = ?", (document_id,))
        await db.commit()

