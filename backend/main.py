"""
Sezi Backend - A speed reading application for PDFs.
"""

import os
import tempfile
import shutil
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from pdf_processor import (
    extract_text_from_pdf, 
    get_document_stats, 
    get_bionic_word,
    ProcessedDocument
)
from storage import (
    init_database,
    get_recent_documents,
    add_or_update_document,
    get_document_by_path,
    update_reading_progress,
    get_settings,
    update_settings,
    update_reading_stats,
    get_reading_stats,
    delete_document
)


# Directory to store uploaded PDFs
UPLOAD_DIR = Path(__file__).parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database on startup."""
    await init_database()
    yield


app = FastAPI(
    title="Sezi API",
    description="Speed reading application for PDF documents",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend (allow all origins for Electron file:// protocol)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Pydantic Models ---

class SettingsUpdate(BaseModel):
    font_family: Optional[str] = None
    font_size: Optional[int] = None
    font_color: Optional[str] = None
    background_color: Optional[str] = None
    highlight_color: Optional[str] = None
    reading_speed: Optional[int] = None
    theme: Optional[str] = None


class ProgressUpdate(BaseModel):
    document_id: int
    current_page: int
    current_position: int
    reading_mode: str
    completed: bool = False


class StatsUpdate(BaseModel):
    document_id: int
    words_read: int
    time_spent_seconds: int


# --- Routes ---

@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "message": "Sezi API is running"}


@app.get("/api/documents/recent")
async def get_recent_docs(limit: int = Query(default=10, ge=1, le=50)):
    """Get recently opened documents."""
    documents = await get_recent_documents(limit)
    
    # Check if files still exist
    valid_docs = []
    for doc in documents:
        if os.path.exists(doc['file_path']):
            valid_docs.append(doc)
    
    return {"documents": valid_docs}


@app.post("/api/documents/upload")
async def upload_document(file: UploadFile = File(...)):
    """Upload and process a PDF document."""
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")
    
    # Save the uploaded file
    file_path = UPLOAD_DIR / file.filename
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Process the PDF
    try:
        processed_doc = extract_text_from_pdf(str(file_path))
        stats = get_document_stats(processed_doc)
        
        # Save to database
        doc_id = await add_or_update_document(
            file_path=str(file_path),
            file_name=file.filename,
            total_pages=stats['total_pages'],
            total_words=stats['total_words'],
            total_sentences=stats['total_sentences']
        )
        
        return {
            "success": True,
            "document_id": doc_id,
            "file_name": file.filename,
            "file_path": str(file_path),
            "stats": stats,
            "document": processed_doc.to_dict()
        }
    except Exception as e:
        # Clean up file if processing fails
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(status_code=500, detail=f"Failed to process PDF: {str(e)}")


@app.get("/api/documents/{document_id}")
async def get_document(document_id: int):
    """Get a specific document's content."""
    documents = await get_recent_documents(100)
    doc_info = None
    
    for doc in documents:
        if doc['id'] == document_id:
            doc_info = doc
            break
    
    if not doc_info:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not os.path.exists(doc_info['file_path']):
        raise HTTPException(status_code=404, detail="Document file not found on disk")
    
    # Process the document
    processed_doc = extract_text_from_pdf(doc_info['file_path'])
    stats = get_document_stats(processed_doc)
    
    return {
        "document": processed_doc.to_dict(),
        "info": doc_info,
        "stats": stats
    }


@app.delete("/api/documents/{document_id}")
async def remove_document(document_id: int):
    """Remove a document from the library."""
    await delete_document(document_id)
    return {"success": True}


@app.get("/api/settings")
async def get_user_settings():
    """Get user settings."""
    settings = await get_settings()
    return {"settings": settings}


@app.put("/api/settings")
async def update_user_settings(settings: SettingsUpdate):
    """Update user settings."""
    await update_settings(**settings.model_dump(exclude_none=True))
    updated_settings = await get_settings()
    return {"settings": updated_settings}


@app.post("/api/progress")
async def save_progress(progress: ProgressUpdate):
    """Save reading progress."""
    await update_reading_progress(
        document_id=progress.document_id,
        current_page=progress.current_page,
        current_position=progress.current_position,
        reading_mode=progress.reading_mode,
        completed=progress.completed
    )
    return {"success": True}


@app.post("/api/stats")
async def save_stats(stats: StatsUpdate):
    """Update reading statistics."""
    await update_reading_stats(
        document_id=stats.document_id,
        words_read=stats.words_read,
        time_spent_seconds=stats.time_spent_seconds
    )
    return {"success": True}


@app.get("/api/stats")
async def get_stats(document_id: Optional[int] = None):
    """Get reading statistics."""
    stats = await get_reading_stats(document_id)
    return {"stats": stats}


@app.get("/api/bionic/{word}")
async def get_bionic(word: str):
    """Get bionic reading split for a word."""
    highlighted, rest = get_bionic_word(word)
    return {
        "word": word,
        "highlighted": highlighted,
        "rest": rest
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("SEZI_PORT", 51735))
    uvicorn.run(app, host="0.0.0.0", port=port)

