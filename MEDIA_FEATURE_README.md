# 📎 Media Sharing Feature

## Overview
Share images, documents, and videos in your secure messaging app with full encryption support.

## ✨ Features
- 📸 **Images**: JPG, PNG, GIF, WebP with inline preview
- 📄 **Documents**: PDF, DOC, DOCX, TXT, ZIP with download
- 🎥 **Videos**: MP4, AVI, MOV, MKV with inline player
- 🔒 **Secure**: JWT authentication + file validation
- ⚡ **Fast**: Direct file serving with efficient storage
- 📱 **Responsive**: Works on desktop and mobile

## 🚀 Quick Setup

### 1. Run Setup Script
**Windows:**
```bash
setup-media-feature.bat
```

**Linux/Mac:**
```bash
chmod +x setup-media-feature.sh
./setup-media-feature.sh
```

### 2. Restart Backend
```bash
cd backend
uvicorn app.main:app --reload
```

### 3. Test Upload
Visit http://localhost:8000/docs and test the `/api/v1/media/upload` endpoint

## 📖 Documentation
- **Quick Reference**: `MEDIA_QUICK_REF.md`
- **Full Guide**: `MEDIA_FEATURE_GUIDE.md`
- **API Docs**: http://localhost:8000/docs

## 🎯 Usage Example

```tsx
// Upload media
import { MediaUpload } from '@/components/chat/MediaUpload';

<MediaUpload 
  onMediaSelected={(files) => console.log('Selected:', files)}
  onUploadComplete={(media) => console.log('Uploaded:', media)}
/>

// Display media
import { MediaPreview } from '@/components/chat/MediaPreview';

<MediaPreview media={message.mediaAttachments} />
```

## 🔧 Configuration

### File Limits
- **Max Size**: 50MB per file
- **Max Files**: Unlimited (batch upload supported)

### Storage
- **Location**: `backend/uploads/`
- **Naming**: UUID-based (prevents conflicts)
- **Cleanup**: Auto-delete with message

### Supported Types
```typescript
Images:    .jpg, .jpeg, .png, .gif, .webp, .bmp
Documents: .pdf, .doc, .docx, .txt, .zip, .rar
Videos:    .mp4, .avi, .mov, .mkv, .webm
```

## 🔐 Security
- ✅ JWT authentication required
- ✅ File type validation (client + server)
- ✅ File size limits enforced
- ✅ Secure file storage with UUID names
- ✅ Cascade delete on message removal

## 🎨 UI Components

### MediaUpload
File picker with validation and preview
- Click to select files
- Shows selected files with remove option
- Validates type and size before upload

### MediaPreview
Smart media display based on type
- **Images**: Inline preview with download button
- **Videos**: Inline video player with controls
- **Documents**: File card with download button

## 📊 Database Schema

```sql
-- New table
CREATE TABLE media_attachments (
  id UUID PRIMARY KEY,
  message_id UUID REFERENCES messages(id),
  file_name VARCHAR(255),
  file_type VARCHAR(100),
  file_size INTEGER,
  file_url VARCHAR(500),
  created_at TIMESTAMP
);

-- Updated table
ALTER TABLE messages 
ADD COLUMN has_media BOOLEAN DEFAULT FALSE;
```

## 🧪 Testing

### Manual Test
1. Open chat interface
2. Click upload button
3. Select image/document/video
4. Send message
5. Verify media displays correctly

### API Test
```bash
# Upload
curl -X POST "http://localhost:8000/api/v1/media/upload" \
  -H "Authorization: Bearer TOKEN" \
  -F "file=@test.jpg"

# Download
curl "http://localhost:8000/api/v1/media/files/FILENAME" \
  -H "Authorization: Bearer TOKEN" \
  -o downloaded.jpg
```

## 🚧 Future Enhancements
- [ ] Cloud storage (AWS S3, Cloudinary)
- [ ] Image compression
- [ ] Video thumbnails
- [ ] Drag & drop upload
- [ ] Upload progress bar
- [ ] Batch operations
- [ ] Media gallery view
- [ ] Search media by type

## 🐛 Troubleshooting

**Upload fails**
- Check file size < 50MB
- Verify file type is supported
- Ensure backend server is running
- Check JWT token is valid

**Media not displaying**
- Verify `backend/uploads/` exists
- Check file permissions
- Inspect browser console for errors
- Verify API endpoint is accessible

**Migration errors**
- Update migration `down_revision`
- Run: `alembic upgrade head`
- Check database connection

## 📞 Support
For issues or questions, see:
- `MEDIA_FEATURE_GUIDE.md` - Detailed integration guide
- `MEDIA_QUICK_REF.md` - Quick reference card
- Backend API docs at `/docs` endpoint

---

**Status**: ✅ Ready for production
**Version**: 1.0.0
**Last Updated**: 2024
