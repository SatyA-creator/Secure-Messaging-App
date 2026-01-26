# API Documentation

## Base URL
- Development: `http://localhost:8000/api/v1`
- Production: `https://your-backend.render.com/api/v1`

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

---

## Authentication Endpoints

### Register User
**POST** `/auth/register`

Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "securepassword",
  "full_name": "John Doe"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "full_name": "John Doe",
    "public_key": "base64-encoded-key",
    "is_active": true,
    "role": "user"
  }
}
```

**Errors:**
- `400` - User already exists
- `422` - Validation error

---

### Login
**POST** `/auth/login`

Authenticate user and get JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:** `200 OK`
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "full_name": "John Doe",
    "is_active": true,
    "role": "user"
  }
}
```

**Errors:**
- `401` - Invalid credentials

---

### Get Current User
**GET** `/auth/me`

Get currently authenticated user profile.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "username",
  "full_name": "John Doe",
  "public_key": "base64-encoded-key",
  "is_active": true,
  "is_verified": false,
  "role": "user",
  "avatar_url": null,
  "bio": null,
  "created_at": "2026-01-26T10:00:00Z"
}
```

**Errors:**
- `401` - Invalid or expired token

---

## Message Endpoints

### Send Message
**POST** `/messages/send`

Send a new message to a user.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "sender_id": "uuid",
  "recipient_id": "uuid",
  "encrypted_content": "encrypted:Hello",
  "encrypted_session_key": "session-key"
}
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "sender_id": "uuid",
  "recipient_id": "uuid",
  "encrypted_content": "encrypted:Hello",
  "encrypted_session_key": "session-key",
  "created_at": "2026-01-26T10:00:00Z",
  "is_read": false
}
```

---

### Get Conversation
**GET** `/messages/conversation/{other_user_id}?current_user_id={uuid}`

Get all messages between current user and another user.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `current_user_id` (required): UUID of current user

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "sender_id": "uuid",
    "recipient_id": "uuid",
    "encrypted_content": "encrypted:Hello",
    "encrypted_session_key": "session-key",
    "created_at": "2026-01-26T10:00:00Z",
    "is_read": false,
    "has_media": false,
    "media_attachments": []
  }
]
```

---

### Mark Message as Read
**PUT** `/messages/{message_id}/read`

Mark a specific message as read.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "status": "Message marked as read"
}
```

---

## Contact Endpoints

### Get Contacts
**GET** `/contacts?user_id={uuid}`

Get all contacts for a user.

**Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**
- `user_id` (required): UUID of user

**Response:** `200 OK`
```json
[
  {
    "id": "contact-uuid",
    "contact_id": "user-uuid",
    "contact_user_id": "user-uuid",
    "contact_username": "username",
    "contact_email": "user@example.com",
    "contact_full_name": "John Doe",
    "contact_public_key": "base64-key",
    "contact_last_seen": "2026-01-26T10:00:00Z",
    "is_online": false,
    "created_at": "2026-01-26T09:00:00Z"
  }
]
```

---

### Add Contact
**POST** `/contacts/add`

Add a new contact by email.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "user_id": "uuid",
  "contact_email": "friend@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "Contact added successfully",
  "contact": {
    "id": "uuid",
    "username": "friendname",
    "email": "friend@example.com"
  }
}
```

**Errors:**
- `404` - User not found
- `400` - Already a contact

---

## Group Endpoints

### Create Group
**POST** `/groups`

Create a new group chat.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "name": "My Group",
  "admin_id": "uuid",
  "member_emails": ["user1@example.com", "user2@example.com"],
  "is_private": true
}
```

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "My Group",
  "admin_id": "uuid",
  "is_private": true,
  "created_at": "2026-01-26T10:00:00Z",
  "members": [
    {
      "id": "uuid",
      "username": "user1",
      "email": "user1@example.com"
    }
  ]
}
```

---

### Get Groups
**GET** `/groups?user_id={uuid}`

Get all groups for a user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "My Group",
    "admin_id": "uuid",
    "is_private": true,
    "created_at": "2026-01-26T10:00:00Z",
    "member_count": 5
  }
]
```

---

### Get Group Details
**GET** `/groups/{group_id}`

Get detailed information about a group.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "My Group",
  "admin_id": "uuid",
  "is_private": true,
  "created_at": "2026-01-26T10:00:00Z",
  "members": [
    {
      "user_id": "uuid",
      "username": "user1",
      "email": "user1@example.com",
      "full_name": "User One",
      "is_admin": false,
      "joined_at": "2026-01-26T10:00:00Z"
    }
  ]
}
```

---

## Media Endpoints

### Upload Media
**POST** `/media/upload`

Upload media file(s).

**Headers:**
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

**Form Data:**
- `files`: File(s) to upload (max 50MB each)
- `message_id` (optional): UUID of associated message

**Response:** `200 OK`
```json
{
  "uploaded_files": [
    {
      "id": "uuid",
      "file_name": "image.jpg",
      "file_type": "image/jpeg",
      "file_size": 1024567,
      "file_url": "/uploads/uuid/image.jpg",
      "category": "image",
      "thumbnail_url": "/uploads/uuid/thumb_image.jpg"
    }
  ]
}
```

**Errors:**
- `400` - File too large
- `400` - Invalid file type

---

### Get Media
**GET** `/media/{media_id}`

Get media file details.

**Headers:**
```
Authorization: Bearer <token>
```

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "message_id": "uuid",
  "file_name": "image.jpg",
  "file_type": "image/jpeg",
  "file_size": 1024567,
  "file_url": "/uploads/uuid/image.jpg",
  "category": "image",
  "thumbnail_url": "/uploads/uuid/thumb_image.jpg",
  "created_at": "2026-01-26T10:00:00Z"
}
```

---

## Invitation Endpoints

### Send Invitation
**POST** `/invitations/send`

Send an email invitation to join.

**Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "inviter_id": "uuid",
  "invitee_email": "newuser@example.com"
}
```

**Response:** `200 OK`
```json
{
  "message": "Invitation sent successfully",
  "invitation": {
    "id": "uuid",
    "invitee_email": "newuser@example.com",
    "invitation_token": "secure-token",
    "expires_at": "2026-02-02T10:00:00Z",
    "is_accepted": false
  }
}
```

---

### Accept Invitation
**POST** `/invitations/accept`

Accept an invitation and create contact relationship.

**Request Body:**
```json
{
  "token": "invitation-token",
  "user_id": "uuid"
}
```

**Response:** `200 OK`
```json
{
  "message": "Invitation accepted successfully",
  "inviter": {
    "id": "uuid",
    "username": "inviter",
    "email": "inviter@example.com"
  }
}
```

**Errors:**
- `400` - Invalid token
- `400` - Invitation expired
- `400` - Already accepted

---

## WebSocket API

### Connection
**WS** `/ws/{user_id}?token={jwt_token}`

Establish WebSocket connection for real-time messaging.

**Query Parameters:**
- `token`: JWT authentication token

**Connection Flow:**
1. Send JWT token in query parameter
2. Backend verifies token
3. Connection accepted
4. User marked as online
5. Begin receiving/sending messages

---

### Message Types

#### Send Message
```json
{
  "type": "message",
  "recipient_id": "uuid",
  "encrypted_content": "encrypted:Hello",
  "encrypted_session_key": "session-key",
  "message_id": "uuid"
}
```

#### Send Group Message
```json
{
  "type": "group_message",
  "group_id": "uuid",
  "encrypted_content": "encrypted:Hello",
  "encrypted_session_keys": {
    "user1-uuid": "key1",
    "user2-uuid": "key2"
  },
  "message_id": "uuid"
}
```

#### Typing Indicator
```json
{
  "type": "typing",
  "recipient_id": "uuid",
  "is_typing": true
}
```

#### Read Confirmation
```json
{
  "type": "read_confirmation",
  "message_id": "uuid"
}
```

---

### Received Events

#### New Message
```json
{
  "type": "new_message",
  "message_id": "uuid",
  "sender_id": "uuid",
  "encrypted_content": "encrypted:Hello",
  "encrypted_session_key": "session-key",
  "timestamp": "2026-01-26T10:00:00Z"
}
```

#### Message Sent Confirmation
```json
{
  "type": "message_sent",
  "message_id": "uuid",
  "status": "sent",
  "timestamp": "2026-01-26T10:00:00Z"
}
```

#### User Online
```json
{
  "type": "user_online",
  "user_id": "uuid",
  "timestamp": "2026-01-26T10:00:00Z"
}
```

#### User Offline
```json
{
  "type": "user_offline",
  "user_id": "uuid",
  "timestamp": "2026-01-26T10:00:00Z"
}
```

#### Typing Event
```json
{
  "type": "typing",
  "sender_id": "uuid",
  "is_typing": true
}
```

#### Contact Added
```json
{
  "type": "contact_added",
  "contact_id": "uuid",
  "username": "newuser",
  "email": "newuser@example.com",
  "full_name": "New User"
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error message description"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request (validation error, business logic error)
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `422` - Unprocessable Entity (validation error)
- `500` - Internal Server Error

---

## Rate Limiting
Currently not implemented. To be added in future versions.

## Pagination
Currently not implemented. All list endpoints return full results.
