# Media Sharing Feature - Integration Guide

## Overview
This feature enables users to share images, documents (PDF, DOC, ZIP), and videos in direct messages and group chats.

## Backend Implementation

### 1. Database Schema
- **New Table**: `media_attachments`
  - Stores file metadata (name, type, size, URL)
  - Links to messages via `message_id`
- **Updated Table**: `messages`
  - Added `has_media` boolean flag
  - Added relationship to media_attachments

### 2. API Endpoints
- `POST /api/v1/media/upload` - Upload media file
- `GET /api/v1/media/files/{filename}` - Serve media file
- `GET /api/v1/media/message/{message_id}` - Get message media
- `DELETE /api/v1/media/{media_id}` - Delete media

### 3. File Storage
- Files stored in `backend/uploads/` directory
- Unique UUID-based filenames to prevent conflicts
- Max file size: 50MB

### 4. Supported File Types
**Images**: .jpg, .jpeg, .png, .gif, .webp, .bmp
**Documents**: .pdf, .doc, .docx, .txt, .zip, .rar
**Videos**: .mp4, .avi, .mov, .mkv, .webm

## Frontend Implementation

### 1. Components Created
- **MediaUpload**: File picker with preview and validation
- **MediaPreview**: Display media in messages (images, videos, documents)

### 2. Integration Example

```typescript
// In your MessageInput component
import { MediaUpload } from '@/components/chat/MediaUpload';
import { MediaPreview } from '@/components/chat/MediaPreview';

function MessageInput() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const mediaUploadRef = useRef<any>(null);

  const handleSendMessage = async () => {
    // 1. Send message first
    const messageResponse = await sendMessage(messageText);
    const messageId = messageResponse.id;

    // 2. Upload media if files selected
    if (selectedFiles.length > 0 && mediaUploadRef.current) {
      await mediaUploadRef.current.uploadFiles(messageId);
    }

    // 3. Clear state
    setSelectedFiles([]);
    setMessageText('');
  };

  return (
    <div>
      <MediaUpload
        ref={mediaUploadRef}
        onMediaSelected={setSelectedFiles}
      />
      <input
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
      />
      <button onClick={handleSendMessage}>Send</button>
    </div>
  );
}

// In your Message component
function Message({ message }) {
  const [media, setMedia] = useState([]);

  useEffect(() => {
    if (message.has_media) {
      fetchMessageMedia(message.id).then(setMedia);
    }
  }, [message.id]);

  return (
    <div>
      <p>{message.content}</p>
      <MediaPreview media={media} />
    </div>
  );
}
```

## Setup Instructions

### 1. Run Database Migration
```bash
cd backend
alembic upgrade head
```

### 2. Create Uploads Directory
```bash
mkdir backend/uploads
```

### 3. Update Environment Variables (Optional)
```env
# In .env file
MAX_UPLOAD_SIZE=52428800  # 50MB in bytes
UPLOAD_DIR=uploads
```

### 4. Install Dependencies (if needed)
```bash
# Backend - already included in requirements.txt
pip install python-multipart

# Frontend - already included in package.json
npm install
```

## Usage Flow

### Sending Message with Media
1. User clicks upload button
2. Selects files (validates type and size)
3. Files shown in preview
4. User types message (optional)
5. Clicks send
6. Message created in DB
7. Files uploaded and linked to message
8. WebSocket broadcasts message with `has_media: true`

### Receiving Message with Media
1. WebSocket receives message
2. Frontend checks `has_media` flag
3. Fetches media attachments via API
4. Displays media based on type:
   - Images: Inline preview with lightbox
   - Videos: Inline video player
   - Documents: Download button with file info

## Security Considerations

1. **File Validation**: Type and size checked on both client and server
2. **Authentication**: All endpoints require JWT token
3. **File Storage**: Files stored with UUID names (prevents path traversal)
4. **Access Control**: Users can only access media from their messages
5. **Cleanup**: Media deleted when message is deleted (CASCADE)

## Future Enhancements

1. **Cloud Storage**: Integrate AWS S3 or similar for production
2. **Thumbnails**: Generate thumbnails for images and videos
3. **Compression**: Compress images before upload
4. **Progress Tracking**: Show upload progress bar
5. **Drag & Drop**: Add drag-and-drop file upload
6. **Preview Modal**: Full-screen media preview
7. **Multiple Files**: Batch upload multiple files at once

## API Examples

### Upload Media
```bash
curl -X POST "http://localhost:8000/api/v1/media/upload" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/image.jpg" \
  -F "message_id=MESSAGE_UUID"
```

### Get Message Media
```bash
curl "http://localhost:8000/api/v1/media/message/MESSAGE_UUID" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Download File
```bash
curl "http://localhost:8000/api/v1/media/files/FILENAME" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded_file.jpg
```
