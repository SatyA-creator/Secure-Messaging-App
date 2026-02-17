# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Frontend
```bash
npm run dev        # Start dev server (runs on port 8080)
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # ESLint
npm run preview    # Preview production build
```

### Backend
```bash
cd backend
python main.py                    # Start FastAPI server (port 8000)
pytest                            # Run all tests
pytest tests/test_auth.py         # Run a single test file
alembic upgrade head              # Apply all migrations
alembic revision --autogenerate -m "description"  # Create migration
```

### Setup
```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env  # then edit with real values

# Frontend
npm install
# Create .env.development with VITE_API_URL and VITE_WS_URL
```

## Environment Variables

**Backend (`backend/.env`)**:
- `DATABASE_URL` — PostgreSQL URL (supports Supabase, Neon, local)
- `JWT_SECRET_KEY` — Secret for JWT signing (HS256)
- `RESEND_API_KEY` — Email API for invitations
- `FRONTEND_URL`, `CORS_ORIGINS` — Allowed frontend origins
- `ENVIRONMENT` — `development` or `production`

**Frontend (`.env.development`)**:
- `VITE_API_URL` — Backend API base URL (e.g., `http://localhost:8000/api/v1`)
- `VITE_WS_URL` — WebSocket base URL (e.g., `ws://localhost:8000`)

Frontend defaults (in `src/config/env.ts`) fall back to the Render production deployment if env vars are absent.

## Architecture

### Frontend (`src/`)

**Entry & routing**: `src/main.tsx` → `src/App.tsx`. Routes: `/` (Index/Chat), `/accept-invitation/:token`, `*` (404).

**State management** (React Context, no Redux):
- `src/context/AuthContext.tsx` — Auth state (user, token in `localStorage['authToken']`), login/register/logout
- `src/context/ChatContext.tsx` — Contacts, conversations, WebSocket lifecycle, message sending

**Key libraries**:
- `src/lib/websocket.ts` — Singleton `WebSocketService`, connects to `WS /ws/{user_id}?token={jwt}`, auto-reconnects (5 attempts)
- `src/lib/cryptoService.ts` — E2E encryption: ECDH P-256 key exchange + AES-256-GCM message encryption; keys persisted in IndexedDB (`quantchat-crypto` DB via `idb`)
- `src/lib/localStore.ts` — IndexedDB message cache (Dexie)
- `src/lib/offlineQueue.ts` — Queues messages when WebSocket is disconnected
- `src/lib/relayClient.ts` — Polls `/api/v1/relay` for messages when recipient was offline
- `src/lib/mediaService.ts` — File upload to `/api/v1/media/upload`
- `src/lib/markdownSerializer.ts` — Export/import conversations as Markdown
- `src/config/env.ts` — Centralizes `VITE_API_URL` / `VITE_WS_URL`

**Path alias**: `@/` → `src/`

**UI**: shadcn/ui components in `src/components/ui/`, chat-specific components in `src/components/chat/`.

---

### Backend (`backend/`)

**Entry**: `backend/main.py` starts uvicorn. The FastAPI app is defined in `backend/app/main.py`.

**Request flow**: HTTP → CORS middleware → `/api/v1` prefix → routers in `app/api/`. WebSocket at `/ws/{user_id}?token={jwt}`.

**API routers** (`backend/app/api/`): `auth`, `messages`, `contacts`, `users`, `groups`, `media`, `invitations`, `admin`, `relay`.

**Services** (`backend/app/services/`):
- `auth_service.py` — JWT creation/verification, password hashing (bcrypt)
- `message_service.py` — Message persistence and retrieval
- `group_service.py` — Group management
- `relay_service.py` — TTL-based store-and-forward for offline users
- `email_queue.py` — Background async email queue using Resend API
- `enhanced_crypto_service.py` — Server-side crypto utilities

**Models** (`backend/app/models/`): `user`, `message`, `group`, `contact`, `media`, `invitation`, `relay_message`.

**Database** (`backend/app/database.py`): SQLAlchemy with connection-pool auto-detection for pgbouncer (Supabase port 6543) vs. direct PostgreSQL (port 5432). `get_db()` is the FastAPI dependency.

**Config** (`backend/app/config.py`): Pydantic `Settings` reads from `.env`. Access via `from app.config import settings`.

---

### Real-time Messaging Flow

1. Client connects WebSocket: `WS /ws/{user_id}?token={jwt}` — token validated server-side before accepting.
2. Messages are typed JSON payloads: `{ type, payload }`.
3. Message types: `message` (DM), `group_message`, `typing`, `delivery_confirmation`, `contact_added`.
4. Server saves to DB then forwards to recipient's live WebSocket connection. If recipient is offline, `relay_service` stores the message until they reconnect.
5. Frontend `WebSocketService` emits typed events handled by `ChatContext`.

### Encryption
- Frontend generates ECDH P-256 keypairs at registration (stored in IndexedDB).
- Per-message AES-256-GCM session key derived from ECDH shared secret.
- `encrypted_content` and `encrypted_session_key` fields are sent to the backend opaquely — the server never decrypts message content.

### Database Migrations
Alembic manages schema changes. Migration files are in `backend/migrations/versions/`. Always run `alembic upgrade head` after pulling changes that include new migrations.
