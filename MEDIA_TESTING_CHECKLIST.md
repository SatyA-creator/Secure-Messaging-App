# Media Feature Testing Checklist

## Pre-Testing Setup
- [ ] Run setup script (`setup-media-feature.bat` or `.sh`)
- [ ] Verify `backend/uploads/` directory exists
- [ ] Backend server is running
- [ ] Frontend dev server is running
- [ ] Database migration completed successfully

## Backend API Testing

### Upload Endpoint
- [ ] Upload JPG image (< 5MB)
- [ ] Upload PNG image (< 5MB)
- [ ] Upload PDF document
- [ ] Upload ZIP file
- [ ] Upload MP4 video
- [ ] Try uploading file > 50MB (should fail)
- [ ] Try uploading .exe file (should fail)
- [ ] Upload without auth token (should fail with 401)

### Download Endpoint
- [ ] Download uploaded image
- [ ] Download uploaded document
- [ ] Download uploaded video
- [ ] Try downloading non-existent file (should return 404)

### Get Message Media
- [ ] Get media for message with attachments
- [ ] Get media for message without attachments (should return empty array)
- [ ] Try with invalid message ID (should handle gracefully)

### Delete Endpoint
- [ ] Delete uploaded media
- [ ] Verify file removed from disk
- [ ] Try deleting non-existent media (should return 404)

## Frontend Component Testing

### MediaUpload Component
- [ ] Click upload button opens file picker
- [ ] Select single image file
- [ ] Select multiple files at once
- [ ] Preview shows selected files
- [ ] Remove file from preview
- [ ] Try selecting invalid file type (should show error)
- [ ] Try selecting file > 50MB (should show error)

### MediaPreview Component
- [ ] Image displays inline with preview
- [ ] Video displays with player controls
- [ ] Document shows file card with download button
- [ ] Click image opens in new tab
- [ ] Click download button downloads file
- [ ] Multiple media items display correctly

## Integration Testing

### Send Message with Media
- [ ] Select image and send message
- [ ] Select document and send message
- [ ] Select video and send message
- [ ] Select multiple files and send message
- [ ] Send message with text + media
- [ ] Send message with only media (no text)

### Receive Message with Media
- [ ] Receive message with image
- [ ] Receive message with document
- [ ] Receive message with video
- [ ] Receive message with multiple media
- [ ] Media displays correctly in chat history
- [ ] Can download received media

### Group Chat Media
- [ ] Send media in group chat
- [ ] All group members receive media
- [ ] Media displays for all members
- [ ] Can download media in group chat

## Edge Cases

### File Handling
- [ ] Upload file with special characters in name
- [ ] Upload file with very long name
- [ ] Upload file with no extension
- [ ] Upload file with uppercase extension (.JPG)
- [ ] Upload same file twice (should create unique copies)

### Network Issues
- [ ] Upload with slow connection
- [ ] Upload interrupted (refresh page)
- [ ] Download with slow connection
- [ ] Offline mode handling

### Database
- [ ] Delete message with media (cascade delete)
- [ ] Verify media removed from disk
- [ ] Check media_attachments table
- [ ] Verify has_media flag set correctly

### Security
- [ ] Upload without authentication (should fail)
- [ ] Access other user's media (should fail)
- [ ] SQL injection in filename (should be safe)
- [ ] Path traversal attempt (should be safe)

## Performance Testing

### Upload Performance
- [ ] Upload 1MB file (should be fast)
- [ ] Upload 10MB file (should complete)
- [ ] Upload 50MB file (should complete)
- [ ] Upload 5 files simultaneously

### Display Performance
- [ ] Load chat with 10 media messages
- [ ] Load chat with 50 media messages
- [ ] Scroll through media-heavy chat
- [ ] Load large image (should not freeze UI)

## Mobile/Responsive Testing
- [ ] Upload from mobile device
- [ ] View media on mobile
- [ ] Download on mobile
- [ ] Touch interactions work correctly
- [ ] Media scales properly on small screens

## Browser Compatibility
- [ ] Chrome/Edge (Chromium)
- [ ] Firefox
- [ ] Safari
- [ ] Mobile browsers

## Error Handling

### User-Friendly Errors
- [ ] File too large shows clear message
- [ ] Invalid file type shows clear message
- [ ] Upload failure shows retry option
- [ ] Network error shows helpful message

### Logging
- [ ] Upload logged in backend
- [ ] Download logged in backend
- [ ] Errors logged with details
- [ ] No sensitive data in logs

## Cleanup Testing
- [ ] Delete message removes media
- [ ] Delete media removes file from disk
- [ ] No orphaned files in uploads directory
- [ ] Database constraints enforced

## Documentation Verification
- [ ] API docs accessible at /docs
- [ ] All endpoints documented
- [ ] Example requests work
- [ ] Response schemas correct

## Final Checks
- [ ] No console errors in browser
- [ ] No errors in backend logs
- [ ] Database queries efficient
- [ ] File permissions correct
- [ ] .gitignore includes uploads/
- [ ] README updated with feature info

## Sign-Off
- [ ] All critical tests passed
- [ ] Known issues documented
- [ ] Ready for production deployment

---

**Tester Name**: _______________
**Date**: _______________
**Environment**: Development / Staging / Production
**Status**: Pass / Fail / Needs Review

**Notes**:
_______________________________________
_______________________________________
_______________________________________
