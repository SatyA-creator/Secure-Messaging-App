from fastapi import APIRouter, UploadFile, File, Depends, HTTPException, Form
from sqlalchemy.orm import Session
from typing import Optional
import os
import uuid
import shutil
from pathlib import Path

from app.database import get_db
from app.api.auth import get_current_user
from app.models.user import User
from app.models.media import MediaAttachment
from app.models.message import Message

router = APIRouter()

# Configuration
# Use /tmp for Render deployment (ephemeral but better than ./uploads)
UPLOAD_DIR = Path("/tmp/uploads") if os.getenv("ENVIRONMENT") == "production" else Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True, parents=True)

# Allowed file types
ALLOWED_EXTENSIONS = {
    'image': {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'},
    'document': {'.pdf', '.doc', '.docx', '.txt', '.zip', '.rar'},
    'video': {'.mp4', '.avi', '.mov', '.mkv', '.webm'}
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB

def get_file_category(filename: str) -> str:
    ext = Path(filename).suffix.lower()
    for category, extensions in ALLOWED_EXTENSIONS.items():
        if ext in extensions:
            return category
    return 'other'

def is_allowed_file(filename: str) -> bool:
    ext = Path(filename).suffix.lower()
    all_allowed = set().union(*ALLOWED_EXTENSIONS.values())
    return ext in all_allowed

@router.post("/upload")
async def upload_media(
    file: UploadFile = File(...),
    message_id: Optional[str] = Form(None),  # Ignored - always set to None
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Upload media file (message_id will be linked later when message is created)"""
    
    # Validate file
    if not is_allowed_file(file.filename):
        raise HTTPException(status_code=400, detail="File type not allowed")
    
    # Check file size
    file.file.seek(0, 2)
    file_size = file.file.tell()
    file.file.seek(0)
    
    if file_size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")
    
    # Generate unique filename
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = UPLOAD_DIR / unique_filename
    
    # Save file
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        logger.info(f"📎 File uploaded: {unique_filename} ({file.content_type}, {file_size} bytes)")
        logger.info(f"📁 Saved to: {file_path}")
        
        # ⚠️ WARNING for production deployments
        if os.getenv("ENVIRONMENT") == "production":
            logger.warning("⚠️ Files stored in /tmp will be DELETED on server restart!")
            logger.warning("⚠️ For persistent storage, configure AWS S3 or similar cloud storage.")
    except Exception as e:
        logger.error(f"❌ File upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Create media record
    # Don't set message_id yet - it will be linked when the message is created
    media = MediaAttachment(
        id=uuid.uuid4(),
        message_id=None,  # Always None on upload, will be linked later
        file_name=file.filename,
        file_type=file.content_type or 'application/octet-stream',
        file_size=file_size,
        file_url=f"/api/v1/media/files/{unique_filename}"
    )
    
    db.add(media)
    db.commit()
    db.refresh(media)
    
    return {
        "id": str(media.id),
        "file_name": media.file_name,
        "file_type": media.file_type,
        "file_size": media.file_size,
        "file_url": media.file_url,
        "category": get_file_category(media.file_name)
    }

@router.get("/files/{filename}")
async def get_media_file(filename: str):
    """Serve uploaded media file"""
    from fastapi.responses import FileResponse
    import mimetypes
    import logging
    
    logger = logging.getLogger(__name__)
    logger.info(f"📥 File download request: {filename}")
    logger.info(f"📁 Upload directory: {UPLOAD_DIR}")
    logger.info(f"🔍 Looking for: {UPLOAD_DIR / filename}")
    
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        logger.error(f"❌ File not found: {file_path}")
        logger.error(f"📁 Upload directory exists: {UPLOAD_DIR.exists()}")
        if UPLOAD_DIR.exists():
            files_in_dir = list(UPLOAD_DIR.glob('*'))
            logger.error(f"📋 Files in directory ({len(files_in_dir)}): {[f.name for f in files_in_dir[:10]]}")
        else:
            logger.error("📋 Upload directory does not exist!")
        raise HTTPException(
            status_code=404, 
            detail=f"File not found: {filename}. On Render, files in /tmp are ephemeral and cleared on restart."
        )
    
    # Get MIME type
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if mime_type is None:
        mime_type = "application/octet-stream"
    
    logger.info(f"✅ Serving file: {filename} ({mime_type}, {file_path.stat().st_size} bytes)")
    
    # Use 'inline' for images/videos to display in browser, 'attachment' for documents
    disposition = "inline" if mime_type and (mime_type.startswith('image/') or mime_type.startswith('video/')) else "attachment"
    
    return FileResponse(
        file_path,
        media_type=mime_type,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "*",
            "Access-Control-Expose-Headers": "*",
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "public, max-age=31536000",
        }
    )

@router.options("/files/{filename}")
async def options_media_file(filename: str):
    """Handle CORS preflight for media files"""
    from fastapi.responses import Response
    
    return Response(
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Authorization, Content-Type",
            "Access-Control-Allow-Credentials": "true",
        }
    )

@router.get("/message/{message_id}")
async def get_message_media(
    message_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all media attachments for a message"""
    
    media_list = db.query(MediaAttachment).filter(
        MediaAttachment.message_id == uuid.UUID(message_id)
    ).all()
    
    return [{
        "id": str(m.id),
        "file_name": m.file_name,
        "file_type": m.file_type,
        "file_size": m.file_size,
        "file_url": m.file_url,
        "category": get_file_category(m.file_name),
        "created_at": m.created_at.isoformat()
    } for m in media_list]

@router.delete("/{media_id}")
async def delete_media(
    media_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete media attachment"""
    
    media = db.query(MediaAttachment).filter(MediaAttachment.id == uuid.UUID(media_id)).first()
    if not media:
        raise HTTPException(status_code=404, detail="Media not found")
    
    # Delete file from disk
    filename = Path(media.file_url).name
    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        file_path.unlink()
    
    db.delete(media)
    db.commit()
    
    return {"message": "Media deleted successfully"}
