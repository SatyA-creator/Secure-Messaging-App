# Media Feature - Quick Reference

## 🚀 Quick Start

### Windows
```bash
setup-media-feature.bat
```

### Linux/Mac
```bash
chmod +x setup-media-feature.sh
./setup-media-feature.sh
```

## 📁 Files Created

### Backend
- `backend/app/models/media.py` - MediaAttachment model
- `backend/app/api/media.py` - Media upload/download endpoints
- `backend/migrations/versions/add_media_attachments.py` - Database migration
- `backend/uploads/` - File storage directory

### Frontend
- `src/components/chat/MediaUpload.tsx` - File upload component
- `src/components/chat/MediaPreview.tsx` - Media display component
- `src/types/messaging.ts` - Updated with MediaAttachment type

## 🎯 Supported File Types

| Category | Extensions | Max Size |
|----------|-----------|----------|
| Images | .jpg, .jpeg, .png, .gif, .webp, .bmp | 50MB |
| Documents | .pdf, .doc, .docx, .txt, .zip, .rar | 50MB |
| Videos | .mp4, .avi, .mov, .mkv, .webm | 50MB |

## 🔌 API Endpoints

```
POST   /api/v1/media/upload              Upload file
GET    /api/v1/media/files/{filename}    Download file
GET    /api/v1/media/message/{id}        Get message media
DELETE /api/v1/media/{id}                Delete media
```

## 💻 Frontend Integration

### Basic Usage
```tsx
import { MediaUpload } from '@/components/chat/MediaUpload';
import { MediaPreview } from '@/components/chat/MediaPreview';

// In your message input
<MediaUpload 
  onMediaSelected={(files) => setSelectedFiles(files)}
  onUploadComplete={(media) => console.log('Uploaded:', media)}
/>

// In your message display
<MediaPreview media={message.mediaAttachments} />
```

## 🔒 Security Features

✅ File type validation (client + server)
✅ File size limits (50MB)
✅ JWT authentication required
✅ UUID-based filenames (prevents conflicts)
✅ Cascade delete (media deleted with message)

## 📊 Database Schema

```sql
CREATE TABLE media_attachments (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id) ON DELETE CASCADE,
  file_name VARCHAR(255),
  file_type VARCHAR(100),
  file_size INTEGER,
  file_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  created_at TIMESTAMP
);

ALTER TABLE messages ADD COLUMN has_media BOOLEAN DEFAULT FALSE;
```

## 🧪 Testing

### Test Upload (cURL)
```bash
curl -X POST "http://localhost:8000/api/v1/media/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@test.jpg"
```

### Test in Browser
1. Go to http://localhost:8000/docs
2. Authorize with your JWT token
3. Try POST /api/v1/media/upload
4. Upload a test file

## 🐛 Troubleshooting

**Upload fails with 413 error**
- File exceeds 50MB limit
- Solution: Compress file or split into parts

**Upload fails with 400 error**
- File type not allowed
- Solution: Check supported extensions

**Files not displaying**
- Check `backend/uploads/` directory exists
- Verify file permissions
- Check browser console for errors

**Migration fails**
- Update `down_revision` in migration file
- Run: `alembic revision --autogenerate -m "add media"`

## 📚 Next Steps

1. ✅ Run setup script
2. ✅ Restart backend server
3. ✅ Test upload via Swagger UI
4. ✅ Integrate components in chat UI
5. ⬜ Add drag-and-drop support
6. ⬜ Implement cloud storage (S3)
7. ⬜ Add image compression
8. ⬜ Generate video thumbnails

## 🔗 Related Files

- Full guide: `MEDIA_FEATURE_GUIDE.md`
- Product docs: `.amazonq/rules/memory-bank/product.md`
- Type definitions: `src/types/messaging.ts`
