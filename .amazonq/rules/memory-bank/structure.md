# Project Structure

## Architecture Overview
Full-stack messaging application with separate frontend and backend codebases in a monorepo structure. The frontend is a React SPA, and the backend is a FastAPI REST API with WebSocket support.

## Directory Structure

### Root Level
```
messsaging-app/
├── backend/           # Python FastAPI backend
├── src/              # React frontend source
├── public/           # Static assets
├── .amazonq/         # Amazon Q configuration and rules
├── .venv-1/          # Python virtual environment
└── [config files]    # Various configuration files
```

### Backend Structure (`backend/`)
```
backend/
├── app/
│   ├── api/              # API route handlers
│   ├── middleware/       # Custom middleware (auth, logging, etc.)
│   ├── models/          # SQLAlchemy database models
│   ├── routes/          # Route definitions
│   ├── schemas/         # Pydantic schemas for validation
│   ├── services/        # Business logic layer
│   ├── utils/           # Utility functions
│   ├── config.py        # Application configuration
│   ├── database.py      # Database connection setup
│   ├── main.py          # FastAPI application entry point
│   └── websocket_manager.py  # WebSocket connection management
├── migrations/          # Alembic database migrations
│   └── versions/       # Migration version files
├── tests/              # Test suite
│   ├── integration/    # Integration tests
│   └── unit/          # Unit tests
├── logs/              # Application logs
├── requirements.txt   # Python dependencies
├── alembic.ini       # Alembic configuration
└── Dockerfile        # Container configuration
```

### Frontend Structure (`src/`)
```
src/
├── components/
│   ├── auth/          # Authentication components
│   ├── chat/          # Chat interface components
│   └── ui/            # shadcn-ui components
├── config/
│   ├── api.ts         # API configuration
│   └── env.ts         # Environment variables
├── context/
│   ├── AuthContext.tsx    # Authentication state management
│   └── ChatContext.tsx    # Chat state management
├── hooks/
│   ├── use-mobile.tsx     # Mobile detection hook
│   └── use-toast.ts       # Toast notification hook
├── lib/
│   ├── utils.ts           # Utility functions
│   └── websocket.ts       # WebSocket client
├── pages/
│   ├── AcceptInvitation.tsx  # Invitation acceptance page
│   ├── Auth.tsx              # Login/register page
│   ├── Chat.tsx              # Main chat interface
│   ├── Index.tsx             # Landing page
│   └── NotFound.tsx          # 404 page
├── types/
│   └── messaging.ts       # TypeScript type definitions
├── App.tsx               # Root application component
├── main.tsx             # Application entry point
└── index.css            # Global styles
```

## Core Components and Relationships

### Backend Architecture

**Entry Point**: `backend/app/main.py`
- Initializes FastAPI application
- Configures CORS middleware
- Sets up WebSocket connection manager
- Includes API routers
- Manages startup/shutdown events

**Database Layer**: `backend/app/database.py`
- SQLAlchemy engine and session management
- Connection pooling configuration
- Database initialization

**Models**: `backend/app/models/`
- User, Message, GroupMessage, Group, GroupMember, Contact models
- SQLAlchemy ORM definitions
- Relationships between entities

**Services**: `backend/app/services/`
- AuthService: JWT token management, password hashing
- EmailQueue: Asynchronous email sending
- Business logic separated from routes

**API Routes**: `backend/app/api/` and `backend/app/routes/`
- RESTful endpoints for CRUD operations
- Authentication endpoints
- Message and group management

**WebSocket Manager**: `backend/app/main.py` (ConnectionManager class)
- Manages active WebSocket connections
- Handles real-time message routing
- Broadcasts user status updates

### Frontend Architecture

**Entry Point**: `src/main.tsx`
- React application initialization
- QueryClient setup for data fetching
- Root component rendering

**Application Root**: `src/App.tsx`
- React Router configuration
- Provider setup (Auth, Query, Tooltip)
- Route definitions

**Context Providers**:
- **AuthContext**: User authentication state, login/logout, token management
- **ChatContext**: Chat state, message history, active conversations

**Pages**:
- **Index**: Landing page with authentication
- **Chat**: Main messaging interface
- **AcceptInvitation**: Contact invitation acceptance flow

**Components**:
- **auth/**: Login, register, and authentication forms
- **chat/**: Message list, input, contact list, group chat components
- **ui/**: Reusable UI components from shadcn-ui

**WebSocket Client**: `src/lib/websocket.ts`
- Manages WebSocket connection to backend
- Handles message sending/receiving
- Connection state management

## Architectural Patterns

### Backend Patterns
- **Layered Architecture**: Routes → Services → Models → Database
- **Dependency Injection**: Database sessions injected into routes
- **Repository Pattern**: Models encapsulate database operations
- **Middleware Pattern**: CORS, authentication, logging middleware
- **WebSocket Manager Pattern**: Centralized connection management

### Frontend Patterns
- **Component-Based Architecture**: Reusable React components
- **Context API**: Global state management for auth and chat
- **Custom Hooks**: Encapsulated logic (use-mobile, use-toast)
- **Route-Based Code Splitting**: Pages loaded on demand
- **Provider Pattern**: Wrapping components with context providers

### Communication Patterns
- **REST API**: HTTP endpoints for CRUD operations
- **WebSocket**: Real-time bidirectional communication
- **JWT Authentication**: Token-based stateless authentication
- **Request/Response**: Synchronous API calls
- **Pub/Sub**: WebSocket message broadcasting

## Data Flow

### Authentication Flow
1. User submits credentials → Frontend
2. Frontend sends POST to `/api/v1/auth/login` → Backend
3. Backend validates credentials → Database
4. Backend generates JWT tokens → Frontend
5. Frontend stores tokens → LocalStorage/Context
6. Frontend includes token in subsequent requests

### Messaging Flow
1. User types message → Frontend
2. Message encrypted → Frontend
3. WebSocket sends message → Backend
4. Backend saves to database → PostgreSQL
5. Backend routes to recipient(s) → WebSocket
6. Recipient receives message → Frontend
7. Frontend decrypts and displays message

### Group Chat Flow
1. Admin creates group → REST API
2. Admin adds members → REST API
3. Member sends message → WebSocket
4. Backend verifies membership → Database
5. Backend broadcasts to all members → WebSocket
6. Members receive message → Frontend
