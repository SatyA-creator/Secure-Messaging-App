# Technology Stack

## Programming Languages
- **Frontend**: TypeScript 5.8.3
- **Backend**: Python 3.x
- **Styling**: CSS with Tailwind CSS
- **Configuration**: JavaScript (config files)

## Frontend Technologies

### Core Framework
- **React** 18.3.1 - UI library for building component-based interfaces
- **React DOM** 18.3.1 - React rendering for web
- **Vite** 5.4.19 - Fast build tool and development server

### Routing & State Management
- **React Router DOM** 6.30.1 - Client-side routing
- **TanStack React Query** 5.83.0 - Server state management and data fetching
- **React Context API** - Global state management (AuthContext, ChatContext)

### UI Components & Styling
- **shadcn-ui** - Component library built on Radix UI primitives
- **Radix UI** - Unstyled, accessible component primitives
  - Dialog, Dropdown, Popover, Toast, Avatar, Tabs, and 20+ more components
- **Tailwind CSS** 3.4.17 - Utility-first CSS framework
- **tailwindcss-animate** 1.0.7 - Animation utilities
- **Lucide React** 0.462.0 - Icon library
- **class-variance-authority** 0.7.1 - Component variant management
- **clsx** 2.1.1 - Conditional className utility
- **tailwind-merge** 2.6.0 - Merge Tailwind classes

### Form Handling & Validation
- **React Hook Form** 7.61.1 - Form state management
- **Zod** 3.25.76 - TypeScript-first schema validation
- **@hookform/resolvers** 3.10.0 - Validation resolver for React Hook Form

### Additional Libraries
- **date-fns** 3.6.0 - Date utility library
- **embla-carousel-react** 8.6.0 - Carousel component
- **next-themes** 0.3.0 - Theme management (dark/light mode)
- **sonner** 1.7.4 - Toast notifications
- **cmdk** 1.1.1 - Command menu component
- **vaul** 0.9.9 - Drawer component

## Backend Technologies

### Core Framework
- **FastAPI** 0.115.5 - Modern Python web framework
- **Uvicorn** 0.32.1 - ASGI server for FastAPI
- **Python-Multipart** 0.0.12 - Multipart form data parsing

### Database & ORM
- **SQLAlchemy** 2.0.36 - SQL toolkit and ORM
- **Psycopg2-Binary** 2.9.10 - PostgreSQL adapter
- **Alembic** 1.14.0 - Database migration tool
- **PostgreSQL** - Production database (Supabase hosted)

### Authentication & Security
- **PyJWT** 2.10.1 - JSON Web Token implementation
- **Python-Jose[cryptography]** 3.3.0 - JWT encoding/decoding
- **Bcrypt** 4.2.1 - Password hashing
- **Passlib** 1.7.4 - Password hashing library
- **Cryptography** 43.0.3 - Cryptographic recipes

### Real-Time Communication
- **Python-SocketIO** 5.12.0 - WebSocket support
- **Python-EngineIO** 4.11.0 - Engine.IO protocol implementation
- **WebSocket** - Native FastAPI WebSocket support

### Data Validation
- **Pydantic** 2.10.3 - Data validation using Python type hints
- **Pydantic-Settings** 2.7.0 - Settings management
- **Email-Validator** - Email validation

### Caching & Messaging
- **Redis** 5.2.1 - In-memory data store for caching

### HTTP & Requests
- **Requests** 2.32.3 - HTTP library
- **HTTPX** 0.28.1 - Async HTTP client
- **FastAPI-CORS** 0.0.6 - CORS middleware

### Testing
- **Pytest** 8.3.4 - Testing framework
- **Pytest-Asyncio** 0.24.0 - Async test support

### Monitoring & Logging
- **Sentry-SDK** 2.20.0 - Error tracking
- **Python-JSON-Logger** 2.0.7 - Structured logging

### Environment & Configuration
- **Python-Dotenv** 1.0.1 - Environment variable management

## Build Tools & Development

### Frontend Build Tools
- **Vite** 5.4.19 - Build tool and dev server
- **@vitejs/plugin-react-swc** 3.11.0 - React plugin with SWC
- **PostCSS** 8.5.6 - CSS transformation
- **Autoprefixer** 10.4.21 - CSS vendor prefixing

### Code Quality
- **ESLint** 9.32.0 - JavaScript/TypeScript linter
- **@eslint/js** 9.32.0 - ESLint JavaScript rules
- **eslint-plugin-react-hooks** 5.2.0 - React Hooks linting
- **eslint-plugin-react-refresh** 0.4.20 - React Refresh linting
- **typescript-eslint** 8.38.0 - TypeScript ESLint support

### TypeScript Configuration
- **@types/node** 22.16.5 - Node.js type definitions
- **@types/react** 18.3.23 - React type definitions
- **@types/react-dom** 18.3.7 - React DOM type definitions

## Infrastructure & Deployment

### Hosting Platforms
- **Vercel** - Frontend hosting
- **Railway/Render** - Backend hosting
- **Supabase** - PostgreSQL database hosting

### Containerization
- **Docker** - Container platform (Dockerfile included)

### Email Service
- **Resend** - Email delivery service

### Environment Management
- Development: `.env.development`
- Production: `.env.production`
- Example: `.env.example`

## Development Commands

### Frontend Commands
```bash
npm run dev          # Start development server
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

### Backend Commands
```bash
# Development
uvicorn app.main:app --reload

# Database migrations
alembic revision --autogenerate -m "message"
alembic upgrade head

# Testing
pytest
pytest tests/unit
pytest tests/integration
```

## Configuration Files

### Frontend Configuration
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration
- `tsconfig.app.json` - App-specific TypeScript config
- `tsconfig.node.json` - Node-specific TypeScript config
- `tailwind.config.ts` - Tailwind CSS configuration
- `postcss.config.js` - PostCSS configuration
- `eslint.config.js` - ESLint configuration
- `components.json` - shadcn-ui configuration

### Backend Configuration
- `alembic.ini` - Alembic migration configuration
- `requirements.txt` - Python dependencies
- `Dockerfile` - Docker container configuration
- `Procfile` - Process file for deployment
- `vercel.json` - Vercel deployment configuration

## API Endpoints

### Base URLs
- **Development Frontend**: http://localhost:5173
- **Development Backend**: http://localhost:8000
- **Production Frontend**: https://secure-messaging-app-omega.vercel.app
- **Production Backend**: https://secure-messaging-app-backend.onrender.com

### WebSocket URLs
- **Development**: ws://localhost:8000/ws/{user_id}?token={jwt_token}
- **Production**: wss://secure-messaging-app-backend.onrender.com/ws/{user_id}?token={jwt_token}

## Database Schema
- **PostgreSQL** with connection pooling
- Pool size: 20 connections
- Max overflow: 40 connections
- Hosted on Supabase (AWS ap-south-1 region)

## Security Configuration
- JWT Algorithm: HS256
- Access Token Expiry: 1440 minutes (24 hours)
- Refresh Token Expiry: 30 days
- Bcrypt Salt Rounds: 12
- Max Login Attempts: 5
- Lockout Duration: 15 minutes
