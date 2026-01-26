# Project Structure

## Overview
This is a full-stack secure messaging application with end-to-end encryption capabilities.

## Technology Stack

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Context API
- **Real-time**: WebSocket
- **HTTP Client**: Fetch API

### Backend
- **Framework**: FastAPI (Python 3.9+)
- **Database**: PostgreSQL (Supabase/Neon)
- **ORM**: SQLAlchemy
- **Authentication**: JWT (HS256)
- **Password Hashing**: Bcrypt
- **Real-time**: WebSocket (FastAPI WebSocket)
- **Migrations**: Alembic

## Directory Structure

```
messsaging-app/
├── backend/                    # Python FastAPI backend
│   ├── app/
│   │   ├── api/               # API route handlers
│   │   │   ├── auth.py       # Authentication endpoints
│   │   │   ├── messages.py   # Message CRUD
│   │   │   ├── contacts.py   # Contact management
│   │   │   ├── groups.py     # Group chat
│   │   │   ├── media.py      # File uploads
│   │   │   ├── users.py      # User management
│   │   │   ├── invitations.py # Email invitations
│   │   │   └── admin.py      # Admin functions
│   │   ├── models/           # SQLAlchemy models
│   │   │   ├── user.py       # User model
│   │   │   ├── message.py    # Message model
│   │   │   ├── contact.py    # Contact model
│   │   │   ├── group.py      # Group chat models
│   │   │   ├── media.py      # Media attachments
│   │   │   └── invitation.py # Invitation model
│   │   ├── schemas/          # Pydantic schemas (validation)
│   │   ├── services/         # Business logic
│   │   │   ├── auth_service.py
│   │   │   ├── message_service.py
│   │   │   ├── group_service.py
│   │   │   ├── email_queue.py
│   │   │   └── enhanced_crypto_service.py
│   │   ├── middleware/       # Custom middleware
│   │   ├── utils/           # Utility functions
│   │   ├── routes/          # WebSocket routes
│   │   │   └── ws.py        # WebSocket handlers
│   │   ├── config.py        # Configuration settings
│   │   ├── database.py      # Database connection
│   │   ├── main.py          # FastAPI app initialization
│   │   └── websocket_manager.py # WebSocket connection manager
│   ├── migrations/          # Alembic database migrations
│   ├── tests/              # Backend tests
│   ├── logs/               # Application logs
│   ├── uploads/            # Uploaded media files
│   ├── main.py            # Entry point
│   ├── requirements.txt   # Python dependencies
│   ├── Dockerfile         # Docker configuration
│   └── alembic.ini       # Alembic configuration
│
├── src/                    # React frontend source
│   ├── components/        # React components
│   │   ├── auth/         # Login/Register components
│   │   ├── chat/         # Chat interface components
│   │   └── ui/           # shadcn/ui components
│   ├── context/          # React Context providers
│   │   ├── AuthContext.tsx
│   │   └── ChatContext.tsx
│   ├── pages/            # Page components
│   │   ├── Index.tsx
│   │   ├── Auth.tsx
│   │   ├── Chat.tsx
│   │   └── AcceptInvitation.tsx
│   ├── lib/              # Utility libraries
│   │   ├── websocket.ts  # WebSocket service
│   │   ├── mediaService.ts
│   │   └── utils.ts
│   ├── config/           # Frontend configuration
│   │   ├── api.ts
│   │   └── env.ts
│   ├── types/            # TypeScript type definitions
│   ├── hooks/            # Custom React hooks
│   ├── App.tsx           # Main App component
│   └── main.tsx          # Entry point
│
├── public/               # Static assets
├── docs/                # Documentation
├── .env.example         # Environment variables template
├── package.json         # Node.js dependencies
├── tsconfig.json        # TypeScript configuration
├── tailwind.config.ts   # Tailwind CSS configuration
├── vite.config.ts       # Vite configuration
└── README.md            # Project README

```

## Key Features

### Authentication
- JWT-based authentication with HS256
- Bcrypt password hashing (10 rounds)
- Email-based user invitations
- Role-based access control (user/admin)
- 24-hour token expiration

### Messaging
- Real-time WebSocket communication
- One-to-one messaging
- Group chat support
- Message status tracking (sending, sent, delivered, read)
- Typing indicators
- Online/offline status

### Media Handling
- File upload support (images, videos, documents)
- File size limit: 50MB
- Thumbnail generation for images
- Multiple file attachments per message
- Media storage in uploads directory

### Database Schema
- Users: User accounts with authentication
- Messages: Encrypted message content
- Contacts: Bidirectional contact relationships
- Groups: Group chat functionality
- GroupMembers: Group membership
- MediaAttachments: File attachments
- Invitations: Email-based invitations

### Security
- JWT authentication on all protected endpoints
- JWT authentication on WebSocket connections
- CORS protection
- SQL injection prevention (SQLAlchemy ORM)
- Password hashing with bcrypt
- Encrypted message storage (placeholder - ready for implementation)

## Environment Variables

### Backend (.env)
```
# Server
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
DEBUG=true
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# JWT
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# CORS
CORS_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app

# Email (optional)
RESEND_API_KEY=your-resend-api-key
VERIFIED_DOMAIN=yourdomain.com
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

## Development Workflow

### Setup
1. Clone repository
2. Install backend: `cd backend && pip install -r requirements.txt`
3. Install frontend: `npm install`
4. Configure environment variables
5. Run database migrations: `alembic upgrade head`

### Running Locally
- Backend: `cd backend && python main.py`
- Frontend: `npm run dev`

### Building for Production
- Frontend: `npm run build`
- Backend: Deploy with Docker or directly with uvicorn

## Database Migrations
```bash
# Create new migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## API Endpoints

### Authentication
- POST `/api/v1/auth/register` - Register new user
- POST `/api/v1/auth/login` - Login user
- GET `/api/v1/auth/me` - Get current user

### Messages
- POST `/api/v1/messages/send` - Send message
- GET `/api/v1/messages/conversation/{user_id}` - Get conversation
- PUT `/api/v1/messages/{id}/read` - Mark as read

### Contacts
- GET `/api/v1/contacts` - List contacts
- POST `/api/v1/contacts/add` - Add contact

### Groups
- POST `/api/v1/groups` - Create group
- GET `/api/v1/groups` - List groups
- POST `/api/v1/groups/{id}/members` - Add member

### Media
- POST `/api/v1/media/upload` - Upload file
- GET `/api/v1/media/{id}` - Get file

### WebSocket
- WS `/ws/{user_id}?token={jwt}` - Real-time messaging

## Message Types (WebSocket)
- `message` - Send one-to-one message
- `group_message` - Send group message
- `typing` - Typing indicator
- `delivery_confirmation` - Message delivered
- `read_confirmation` - Message read
- `new_message` - Incoming message
- `message_sent` - Message sent confirmation
- `user_online` - User came online
- `user_offline` - User went offline

## Deployment

### Frontend (Vercel)
- Automatic deployment from GitHub
- Environment variables configured in Vercel dashboard

### Backend (Render/Railway)
- Docker-based deployment
- PostgreSQL database (Supabase/Neon)
- Environment variables configured in platform

## Testing
- Backend tests: `pytest`
- Frontend: Manual testing (tests directory exists but not implemented)

## Future Enhancements
- Implement real end-to-end encryption (currently placeholder)
- Voice/video calls
- Message search
- Message editing/deletion
- File sharing improvements
- Push notifications
- Email notifications
- Two-factor authentication
