# Secure Messaging Application

A full-stack real-time messaging application with end-to-end encryption capabilities, built with React, FastAPI, and PostgreSQL.

**Environment:** Staging

## 🚀 Features

- **Real-time Messaging**: WebSocket-based instant messaging
- **User Authentication**: JWT-based secure authentication
- **One-to-One Chat**: Private conversations between users
- **Group Chat**: Create and manage group conversations
- **Media Sharing**: Upload and share images, videos, and documents
- **Email Invitations**: Invite users via email
- **Online Status**: See who's online in real-time
- **Typing Indicators**: Know when someone is typing
- **Message Status**: Track message delivery and read status
- **Encryption Ready**: Infrastructure for end-to-end encryption

## 🛠️ Technology Stack

### Frontend
- React 18 + TypeScript
- Vite (Build tool)
- Tailwind CSS + shadcn/ui
- WebSocket for real-time communication
- React Context API for state management

### Backend
- FastAPI (Python)
- PostgreSQL (Database)
- SQLAlchemy (ORM)
- Alembic (Migrations)
- JWT Authentication (HS256)
- Bcrypt (Password hashing)
- WebSocket support

### Infrastructure
- Frontend: Vercel
- Backend: Render/Railway
- Database: Supabase/Neon
- Email: Resend (optional)

## 📚 Documentation

- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Complete project architecture and directory structure
- **[API Documentation](docs/API_DOCUMENTATION.md)** - Detailed API endpoints and WebSocket events
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Step-by-step deployment instructions

## 🚦 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Python 3.9+
- PostgreSQL database (local or cloud)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd messsaging-app
   ```

2. **Setup Backend**
   ```bash
   cd backend
   
   # Create virtual environment
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   
   # Install dependencies
   pip install -r requirements.txt
   
   # Setup environment variables
   cp .env.example .env
   # Edit .env with your database URL and secrets
   
   # Run migrations
   alembic upgrade head
   ```

3. **Setup Frontend**
   ```bash
   # From project root
   npm install
   
   # Setup environment variables
   cp .env.example .env.development
   # Edit .env.development with your backend URL
   ```

### Running Locally

1. **Start Backend**
   ```bash
   cd backend
   python main.py
   # Backend runs on http://localhost:8000
   ```

2. **Start Frontend** (in new terminal)
   ```bash
   npm run dev
   # Frontend runs on http://localhost:5173
   ```

3. **Access Application**
   - Open http://localhost:5173
   - Register a new account
   - Start messaging!

## 🔑 Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/messenger
JWT_SECRET_KEY=your-secret-key-here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:5173
```

### Frontend (.env.development)
```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_WS_URL=ws://localhost:8000
```

## 📖 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `GET /api/v1/auth/me` - Get current user

### Messages
- `POST /api/v1/messages/send` - Send message
- `GET /api/v1/messages/conversation/{user_id}` - Get conversation
- `PUT /api/v1/messages/{id}/read` - Mark as read

### Contacts & Groups
- `GET /api/v1/contacts` - List contacts
- `POST /api/v1/contacts/add` - Add contact
- `POST /api/v1/groups` - Create group
- `GET /api/v1/groups` - List groups

### Media
- `POST /api/v1/media/upload` - Upload files
- `GET /api/v1/media/{id}` - Get file

### WebSocket
- `WS /ws/{user_id}?token={jwt}` - Real-time messaging

See [API Documentation](docs/API_DOCUMENTATION.md) for complete details.

## 🗄️ Database Schema

- **users** - User accounts and authentication
- **messages** - Encrypted message content
- **contacts** - User contact relationships
- **groups** - Group chat information
- **group_members** - Group membership
- **media_attachments** - File attachments
- **invitations** - Email invitations

## 🔒 Security Features

- JWT authentication on all endpoints
- Bcrypt password hashing (10 rounds)
- JWT-authenticated WebSocket connections
- CORS protection
- SQL injection prevention (SQLAlchemy ORM)
- XSS protection (React auto-escaping)
- Prepared for end-to-end encryption

## 📦 Project Structure

```
messsaging-app/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── models/      # Database models
│   │   ├── services/    # Business logic
│   │   └── routes/      # WebSocket routes
│   ├── migrations/      # Database migrations
│   └── main.py          # Entry point
├── src/                 # React frontend
│   ├── components/      # React components
│   ├── context/         # State management
│   ├── pages/           # Page components
│   └── lib/             # Utilities
├── docs/                # Documentation
└── public/              # Static assets
```

## 🧪 Testing

```bash
# Backend tests
cd backend
pytest

# Frontend tests
npm run test
```

## 🚀 Deployment

See [Deployment Guide](docs/DEPLOYMENT.md) for detailed instructions on deploying to production.

**Quick Deploy:**
- Frontend: Deploy to Vercel with one click
- Backend: Deploy to Render or Railway
- Database: Use Supabase or Neon for PostgreSQL

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- FastAPI for the excellent Python web framework
- React team for the amazing frontend library
- shadcn/ui for beautiful UI components
- Supabase for managed PostgreSQL database
