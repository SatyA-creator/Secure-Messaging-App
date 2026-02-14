# Microservices Migration Plan - Messaging App
## Detailed Phase-by-Phase Implementation Guide

**Current Architecture:** Monolithic FastAPI Application  
**Target Architecture:** Microservices with API Gateway  
**Timeline:** 12-16 Weeks  
**Team Size:** 2-4 Developers

---

## Table of Contents

1. [Current System Analysis](#current-system-analysis)
2. [Proposed Microservices Architecture](#proposed-microservices-architecture)
3. [Migration Strategy](#migration-strategy)
4. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
5. [Infrastructure Setup](#infrastructure-setup)
6. [Testing Strategy](#testing-strategy)
7. [Rollback Plan](#rollback-plan)

---

## Current System Analysis

### System Overview

**Backend Stack:**
- Framework: FastAPI (Python 3.9+)
- Database: PostgreSQL (SQLAlchemy ORM)
- Caching: Redis
- Real-time: WebSocket (native FastAPI)
- Authentication: JWT (PyJWT)
- Migration Tool: Alembic

**Frontend Stack:**
- Framework: React 18 with TypeScript
- Build Tool: Vite
- UI Library: Radix UI + shadcn/ui
- State Management: React Context + TanStack Query
- Real-time: WebSocket client
- Local Storage: Dexie (IndexedDB)

### Current API Endpoints

```
/api/v1/
├── /auth           # Authentication (login, register, token refresh)
├── /users          # User management and search
├── /messages       # Direct messaging
├── /groups         # Group chat management
├── /contacts       # Contact management
├── /invitations    # User invitations
├── /media          # File upload and storage
├── /relay          # Offline message queuing
└── /admin          # Admin operations
```

### Database Tables

```sql
-- Current monolithic database
users
messages
groups
group_members
group_messages
contacts
invitations
media_attachments
relay_messages
deleted_users
```

### Service Layer

**Already modularized services (good foundation!):**
- `auth_service.py` - Authentication logic
- `message_service.py` - Message handling
- `group_service.py` - Group operations
- `invitation_service.py` - Invitation management
- `relay_service.py` - Offline message relay
- `email_queue.py` - Email notifications
- `enhanced_crypto_service.py` - Encryption
- `backup_service.py` - Data backup
- `secure_deletion_service.py` - Secure data deletion

### Key Dependencies Between Services

```
AuthService ← MessageService (user verification)
AuthService ← GroupService (user verification)
MessageService → RelayService (offline messages)
MessageService → MediaService (file attachments)
GroupService → MessageService (group messages)
InvitationService → AuthService (user creation)
All Services → EmailQueue (notifications)
```

---

## Proposed Microservices Architecture

### Target Service Decomposition

```mermaid
graph TB
    Client[React Frontend]
    
    subgraph "API Gateway Layer"
        Gateway[Kong/Traefik<br/>Port 8000]
    end
    
    subgraph "Microservices"
        Auth[Auth Service<br/>Port 8001]
        User[User Service<br/>Port 8002]
        Message[Message Service<br/>Port 8003]
        Group[Group Service<br/>Port 8004]
        Media[Media Service<br/>Port 8005]
        Relay[Relay Service<br/>Port 8006]
        Notification[Notification Service<br/>Port 8007]
        WSS[WebSocket Service<br/>Port 8008]
    end
    
    subgraph "Data Layer"
        AuthDB[(Auth DB)]
        UserDB[(User DB)]
        MessageDB[(Message DB)]
        GroupDB[(Group DB)]
        MediaStore[(S3/MinIO)]
        Cache[(Redis)]
    end
    
    subgraph "Message Queue"
        MessageBroker[RabbitMQ/Kafka]
    end
    
    Client --> Gateway
    Gateway --> Auth
    Gateway --> User
    Gateway --> Message
    Gateway --> Group
    Gateway --> Media
    Gateway --> Relay
    Gateway --> WSS
    
    Auth --> AuthDB
    User --> UserDB
    Message --> MessageDB
    Group --> GroupDB
    Media --> MediaStore
    
    Message --> MessageBroker
    Group --> MessageBroker
    Relay --> MessageBroker
    Notification --> MessageBroker
    WSS --> MessageBroker
    
    WSS --> Cache
    Auth --> Cache
```

### Service Definitions

#### 1. **Auth Service** (Port 8001)
- **Responsibilities:** 
  - User authentication (login/register)
  - JWT token generation and validation
  - Password management
  - Session management
- **Database:** `auth_db` (users table only)
- **APIs:** 
  - `POST /auth/register`
  - `POST /auth/login`
  - `POST /auth/refresh`
  - `GET /auth/me`
  - `POST /auth/logout`

#### 2. **User Service** (Port 8002)
- **Responsibilities:** 
  - User profile management
  - User search
  - Contact management
  - User invitations
- **Database:** `user_db` (contacts, invitations, user_profiles)
- **APIs:** 
  - `GET /users/search`
  - `GET /users/{id}`
  - `PUT /users/{id}`
  - `POST /contacts`
  - `POST /invitations`

#### 3. **Message Service** (Port 8003)
- **Responsibilities:** 
  - Direct messaging
  - Message encryption/decryption
  - Message history
  - Message deletion
- **Database:** `message_db` (messages table)
- **APIs:** 
  - `POST /messages/send`
  - `GET /messages/conversation/{userId}`
  - `PUT /messages/{id}/read`
  - `DELETE /messages/{id}`

#### 4. **Group Service** (Port 8004)
- **Responsibilities:** 
  - Group creation and management
  - Group membership
  - Group messaging
- **Database:** `group_db` (groups, group_members, group_messages)
- **APIs:** 
  - `POST /groups`
  - `GET /groups/{id}`
  - `POST /groups/{id}/members`
  - `POST /groups/{id}/messages`

#### 5. **Media Service** (Port 8005)
- **Responsibilities:** 
  - File upload/download
  - Image processing
  - Thumbnail generation
  - Storage management
- **Storage:** S3/MinIO
- **Database:** `media_db` (media_attachments metadata)
- **APIs:** 
  - `POST /media/upload`
  - `GET /media/{id}`
  - `DELETE /media/{id}`

#### 6. **Relay Service** (Port 8006)
- **Responsibilities:** 
  - Offline message queuing
  - TTL-based message expiry
  - Message delivery tracking
- **Storage:** Redis (in-memory with persistence)
- **APIs:** 
  - `POST /relay/queue`
  - `GET /relay/pending/{userId}`
  - `DELETE /relay/{messageId}`

#### 7. **Notification Service** (Port 8007)
- **Responsibilities:** 
  - Email notifications
  - Push notifications
  - Notification templates
- **Storage:** Email queue (Redis)
- **APIs:** 
  - `POST /notifications/email`
  - `POST /notifications/push`

#### 8. **WebSocket Service** (Port 8008)
- **Responsibilities:** 
  - Real-time communication
  - Connection management
  - Presence tracking
  - Message broadcasting
- **Storage:** Redis (connection state)
- **Protocol:** WebSocket

---

## Migration Strategy

### Approach: Strangler Fig Pattern

We'll use the **Strangler Fig Pattern**:
1. Build new microservices alongside the monolith
2. Gradually route traffic to new services
3. Deprecate monolith endpoints one by one
4. Eventually retire the monolith

### Principles

1. **Zero Downtime:** Users should not experience interruptions
2. **Data Consistency:** Maintain data integrity during migration
3. **Incremental Migration:** One service at a time
4. **Rollback Ready:** Each phase can be rolled back
5. **Feature Parity:** New services must match monolith functionality
6. **Testing First:** Comprehensive tests before switching traffic

### Migration Order (Why?)

1. **Relay Service** - Least dependencies, already isolated
2. **Media Service** - Independent, file-based storage
3. **Notification Service** - Async, no critical path
4. **Auth Service** - Core service, needed by all others
5. **User Service** - Depends on Auth
6. **Message Service** - Depends on Auth, User, Media
7. **Group Service** - Depends on Auth, User, Message
8. **WebSocket Service** - Requires all services to be ready

---

## Phase-by-Phase Implementation

---

## **PHASE 0: Preparation (Week 1-2)**

### Goals
- Set up infrastructure
- Create shared libraries
- Establish development workflow
- Create service templates

### Tasks

#### 1. Infrastructure Setup

**Create Docker Compose for local development:**

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # PostgreSQL Databases
  auth-db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: auth_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - auth-db-data:/var/lib/postgresql/data

  user-db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: user_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5433:5432"
    volumes:
      - user-db-data:/var/lib/postgresql/data

  message-db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: message_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5434:5432"
    volumes:
      - message-db-data:/var/lib/postgresql/data

  group-db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: group_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5435:5432"
    volumes:
      - group-db-data:/var/lib/postgresql/data

  media-db:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: media_db
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5436:5432"
    volumes:
      - media-db-data:/var/lib/postgresql/data

  # Redis
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data

  # RabbitMQ
  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "5672:5672"   # AMQP port
      - "15672:15672" # Management UI
    environment:
      RABBITMQ_DEFAULT_USER: admin
      RABBITMQ_DEFAULT_PASS: admin
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio-data:/data

volumes:
  auth-db-data:
  user-db-data:
  message-db-data:
  group-db-data:
  media-db-data:
  redis-data:
  rabbitmq-data:
  minio-data:
```

**Start infrastructure:**
```bash
docker-compose -f docker-compose.dev.yml up -d
```

#### 2. Create Project Structure

```bash
# Create microservices directory
mkdir -p microservices

# Create individual service directories
cd microservices
mkdir -p auth-service user-service message-service group-service \
         media-service relay-service notification-service websocket-service

# Create shared libraries
mkdir -p shared/common shared/database shared/messaging shared/monitoring
```

**New directory structure:**
```
project-root/
├── backend/              # Original monolith (keep running)
├── microservices/        # New microservices
│   ├── shared/          # Shared libraries
│   │   ├── common/      # Common utilities
│   │   ├── database/    # Database utilities
│   │   ├── messaging/   # Event bus utilities
│   │   └── monitoring/  # Observability utilities
│   ├── auth-service/
│   ├── user-service/
│   ├── message-service/
│   ├── group-service/
│   ├── media-service/
│   ├── relay-service/
│   ├── notification-service/
│   └── websocket-service/
├── api-gateway/         # API Gateway configuration
├── docker-compose.dev.yml
└── docker-compose.prod.yml
```

#### 3. Create Shared Libraries

**Create `shared/common/base_service.py`:**

```python
# microservices/shared/common/base_service.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import sys

class BaseService:
    """Base class for all microservices"""
    
    def __init__(self, 
                 service_name: str, 
                 version: str = "1.0.0",
                 description: str = ""):
        
        self.service_name = service_name
        self.version = version
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format=f'%(asctime)s - {service_name} - %(levelname)s - %(message)s',
            handlers=[
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(service_name)
        
        # Create FastAPI app
        @asynccontextmanager
        async def lifespan(app: FastAPI):
            # Startup
            self.logger.info(f"🚀 {service_name} starting...")
            await self.on_startup()
            yield
            # Shutdown
            self.logger.info(f"🛑 {service_name} shutting down...")
            await self.on_shutdown()
        
        self.app = FastAPI(
            title=service_name,
            version=version,
            description=description,
            lifespan=lifespan
        )
        
        # Add CORS
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )
        
        # Add health check
        @self.app.get("/health")
        async def health_check():
            return {
                "status": "healthy",
                "service": service_name,
                "version": version
            }
        
        # Add exception handler
        @self.app.exception_handler(Exception)
        async def exception_handler(request, exc):
            self.logger.error(f"Unhandled exception: {exc}", exc_info=True)
            return JSONResponse(
                status_code=500,
                content={"detail": "Internal server error"}
            )
    
    async def on_startup(self):
        """Override in child classes"""
        pass
    
    async def on_shutdown(self):
        """Override in child classes"""
        pass
```

**Create `shared/database/base_repository.py`:**

```python
# microservices/shared/database/base_repository.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from contextlib import contextmanager
import logging

logger = logging.getLogger(__name__)

Base = declarative_base()

class DatabaseManager:
    """Database connection manager for microservices"""
    
    def __init__(self, database_url: str, pool_size: int = 20, max_overflow: int = 40):
        self.engine = create_engine(
            database_url,
            pool_size=pool_size,
            max_overflow=max_overflow,
            pool_pre_ping=True,
            pool_recycle=3600,
            echo=False
        )
        
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )
        
        logger.info(f"Database connected: {database_url}")
    
    def create_tables(self):
        """Create all tables"""
        Base.metadata.create_all(bind=self.engine)
        logger.info("Database tables created")
    
    @contextmanager
    def get_session(self):
        """Get database session with automatic cleanup"""
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            session.close()
    
    def get_db(self):
        """FastAPI dependency for database session"""
        db = self.SessionLocal()
        try:
            yield db
        except Exception as e:
            db.rollback()
            raise
        finally:
            db.close()
```

**Create `shared/messaging/event_bus.py`:**

```python
# microservices/shared/messaging/event_bus.py
import pika
import json
import logging
from typing import Callable, Dict
from datetime import datetime

logger = logging.getLogger(__name__)

class EventBus:
    """RabbitMQ event bus for inter-service communication"""
    
    def __init__(self, rabbitmq_url: str = "amqp://admin:admin@localhost:5672/"):
        self.rabbitmq_url = rabbitmq_url
        self.connection = None
        self.channel = None
        self.exchange_name = "messaging_events"
        self.handlers: Dict[str, Callable] = {}
        
    def connect(self):
        """Establish connection to RabbitMQ"""
        try:
            self.connection = pika.BlockingConnection(
                pika.URLParameters(self.rabbitmq_url)
            )
            self.channel = self.connection.channel()
            
            # Declare exchange
            self.channel.exchange_declare(
                exchange=self.exchange_name,
                exchange_type='topic',
                durable=True
            )
            
            logger.info(f"✅ Connected to RabbitMQ: {self.rabbitmq_url}")
        except Exception as e:
            logger.error(f"❌ Failed to connect to RabbitMQ: {e}")
            raise
    
    def publish(self, event_type: str, data: dict):
        """Publish event to event bus"""
        if not self.channel:
            self.connect()
        
        message = {
            "event_type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        self.channel.basic_publish(
            exchange=self.exchange_name,
            routing_key=event_type,
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
        
        logger.info(f"📤 Published event: {event_type}")
    
    def subscribe(self, event_pattern: str, handler: Callable, queue_name: str):
        """Subscribe to events matching pattern"""
        if not self.channel:
            self.connect()
        
        # Declare queue
        self.channel.queue_declare(queue=queue_name, durable=True)
        
        # Bind queue to exchange with pattern
        self.channel.queue_bind(
            exchange=self.exchange_name,
            queue=queue_name,
            routing_key=event_pattern
        )
        
        # Store handler
        self.handlers[event_pattern] = handler
        
        logger.info(f"📥 Subscribed to events: {event_pattern}")
    
    def start_consuming(self, queue_name: str):
        """Start consuming messages"""
        if not self.channel:
            self.connect()
        
        def callback(ch, method, properties, body):
            try:
                message = json.loads(body)
                event_type = message.get("event_type")
                
                # Find matching handler
                for pattern, handler in self.handlers.items():
                    if self._match_pattern(event_type, pattern):
                        handler(message["data"])
                
                ch.basic_ack(delivery_tag=method.delivery_tag)
            except Exception as e:
                logger.error(f"Error processing message: {e}")
                ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
        
        self.channel.basic_consume(
            queue=queue_name,
            on_message_callback=callback
        )
        
        logger.info(f"🎧 Started consuming from queue: {queue_name}")
        self.channel.start_consuming()
    
    def _match_pattern(self, event_type: str, pattern: str) -> bool:
        """Simple pattern matching (supports * wildcard)"""
        if pattern == "#" or pattern == "*":
            return True
        return event_type == pattern
    
    def close(self):
        """Close connection"""
        if self.connection:
            self.connection.close()
            logger.info("Connection closed")
```

#### 4. Create Service Template

**Create service template generator script:**

```python
# microservices/create_service.py
import os
import sys

def create_service(service_name: str, port: int):
    """Create a new microservice from template"""
    
    service_dir = f"{service_name}-service"
    
    # Create directory structure
    os.makedirs(f"{service_dir}/app", exist_ok=True)
    os.makedirs(f"{service_dir}/app/api", exist_ok=True)
    os.makedirs(f"{service_dir}/app/models", exist_ok=True)
    os.makedirs(f"{service_dir}/app/schemas", exist_ok=True)
    os.makedirs(f"{service_dir}/app/services", exist_ok=True)
    os.makedirs(f"{service_dir}/tests", exist_ok=True)
    
    # Create main.py
    main_content = f'''"""
{service_name.title()} Service
Port: {port}
"""
from shared.common.base_service import BaseService
from shared.database.base_repository import DatabaseManager
from shared.messaging.event_bus import EventBus
from app.api.routes import router
import os

class {service_name.title()}Service(BaseService):
    def __init__(self):
        super().__init__(
            service_name="{service_name.title()} Service",
            version="1.0.0",
            description="{service_name.title()} microservice"
        )
        
        # Database
        self.db = DatabaseManager(
            database_url=os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/{service_name}_db")
        )
        
        # Event bus
        self.event_bus = EventBus(
            rabbitmq_url=os.getenv("RABBITMQ_URL", "amqp://admin:admin@localhost:5672/")
        )
        
        # Include routes
        self.app.include_router(router, prefix="/api/v1")
    
    async def on_startup(self):
        """Initialize on startup"""
        self.db.create_tables()
        self.event_bus.connect()
    
    async def on_shutdown(self):
        """Cleanup on shutdown"""
        self.event_bus.close()

# Create service instance
service = {service_name.title()}Service()
app = service.app

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port={port})
'''
    
    with open(f"{service_dir}/app/main.py", "w") as f:
        f.write(main_content)
    
    # Create routes.py
    routes_content = '''from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def root():
    return {"message": "Service is running"}
'''
    
    with open(f"{service_dir}/app/api/routes.py", "w") as f:
        f.write(routes_content)
    
    # Create requirements.txt
    requirements_content = '''fastapi==0.115.5
uvicorn==0.32.1
sqlalchemy==2.0.36
psycopg2-binary==2.9.10
pydantic==2.10.3
pydantic-settings==2.7.0
pika==1.3.2
redis==5.2.1
PyJWT==2.10.1
python-dotenv==1.0.1
'''
    
    with open(f"{service_dir}/requirements.txt", "w") as f:
        f.write(requirements_content)
    
    # Create Dockerfile
    dockerfile_content = f'''FROM python:3.9-slim

WORKDIR /app

# Copy shared libraries
COPY shared/ /app/shared/

# Copy service code
COPY {service_dir}/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY {service_dir}/app /app/app

# Expose port
EXPOSE {port}

# Run service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "{port}"]
'''
    
    with open(f"{service_dir}/Dockerfile", "w") as f:
        f.write(dockerfile_content)
    
    # Create .env template
    env_content = f'''DATABASE_URL=postgresql://postgres:postgres@{service_name}-db:5432/{service_name}_db
RABBITMQ_URL=amqp://admin:admin@rabbitmq:5672/
REDIS_URL=redis://redis:6379/0
JWT_SECRET_KEY=your-secret-key-here
PORT={port}
'''
    
    with open(f"{service_dir}/.env.example", "w") as f:
        f.write(env_content)
    
    print(f"✅ Created {service_name} service on port {port}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python create_service.py <service_name> <port>")
        sys.exit(1)
    
    create_service(sys.argv[1], int(sys.argv[2]))
```

**Usage:**
```bash
cd microservices
python create_service.py relay 8006
python create_service.py auth 8001
# etc...
```

---

## **PHASE 1: Relay Service Migration (Week 3-4)**

### Why Start with Relay Service?

- ✅ Least dependencies on other services
- ✅ Already uses in-memory storage (Redis)
- ✅ No complex database migrations
- ✅ Independent functionality
- ✅ Good learning opportunity

### Implementation Steps

#### Step 1: Create Relay Service

```bash
cd microservices
python create_service.py relay 8006
```

#### Step 2: Copy Relay Logic

**File: `microservices/relay-service/app/models/relay_message.py`**

```python
# Copy from backend/app/models/relay_message.py
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional
import uuid

@dataclass
class RelayMessage:
    id: str
    sender_id: str
    recipient_id: str
    encrypted_content: str
    encrypted_session_key: str
    created_at: datetime
    expires_at: datetime
    delivered: bool = False
    
    def is_expired(self) -> bool:
        return datetime.utcnow() > self.expires_at
```

**File: `microservices/relay-service/app/services/relay_service.py`**

```python
# Copy logic from backend/app/services/relay_service.py
# (Already well-isolated, just copy the entire file)
```

**File: `microservices/relay-service/app/api/routes.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from app.services.relay_service import relay_service
from app.schemas.relay import RelayMessageCreate, RelayMessageResponse
from typing import List

router = APIRouter()

@router.post("/queue", response_model=RelayMessageResponse)
async def queue_message(message: RelayMessageCreate):
    """Queue a message for offline delivery"""
    relay_msg = relay_service.store_message(
        sender_id=str(message.sender_id),
        recipient_id=str(message.recipient_id),
        encrypted_content=message.encrypted_content,
        encrypted_session_key=message.encrypted_session_key
    )
    
    return RelayMessageResponse(**relay_msg.__dict__)

@router.get("/pending/{user_id}", response_model=List[RelayMessageResponse])
async def get_pending_messages(user_id: str):
    """Get pending messages for a user"""
    messages = relay_service.get_pending_messages(user_id)
    return [RelayMessageResponse(**msg.__dict__) for msg in messages]

@router.delete("/{message_id}")
async def acknowledge_message(message_id: str):
    """Acknowledge message delivery"""
    success = relay_service.acknowledge_message(message_id)
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    return {"status": "acknowledged"}

@router.post("/user/{user_id}/online")
async def mark_user_online(user_id: str):
    """Mark user as online"""
    relay_service.mark_user_online(user_id)
    return {"status": "online"}

@router.post("/user/{user_id}/offline")
async def mark_user_offline(user_id: str):
    """Mark user as offline"""
    relay_service.mark_user_offline(user_id)
    return {"status": "offline"}
```

#### Step 3: Add to Docker Compose

```yaml
# Add to docker-compose.dev.yml
services:
  relay-service:
    build:
      context: ./microservices
      dockerfile: relay-service/Dockerfile
    ports:
      - "8006:8006"
    environment:
      REDIS_URL: redis://redis:6379/0
      RABBITMQ_URL: amqp://admin:admin@rabbitmq:5672/
    depends_on:
      - redis
      - rabbitmq
```

#### Step 4: Test Relay Service

```bash
# Start the service
docker-compose -f docker-compose.dev.yml up relay-service

# Test health endpoint
curl http://localhost:8006/health

# Test queue endpoint
curl -X POST http://localhost:8006/api/v1/queue \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "123",
    "recipient_id": "456",
    "encrypted_content": "test",
    "encrypted_session_key": "key"
  }'

# Test retrieval
curl http://localhost:8006/api/v1/pending/456
```

#### Step 5: Update API Gateway Routing

We'll add API gateway in next phase, but for now, update frontend to directly call relay service:

**File: `src/config/api.ts`** (temporary change)

```typescript
export const API_ENDPOINTS = {
  // ... existing endpoints ...
  RELAY: {
    QUEUE: 'http://localhost:8006/api/v1/queue',
    PENDING: (userId: string) => `http://localhost:8006/api/v1/pending/${userId}`,
    ACK: (messageId: string) => `http://localhost:8006/api/v1/${messageId}`,
  }
};
```

#### Step 6: Monitoring & Validation

- ✅ Service starts successfully
- ✅ Health check passes
- ✅ Can queue messages
- ✅ Can retrieve pending messages
- ✅ Redis connection works
- ✅ Message expiry works

---

## **PHASE 2: API Gateway Setup (Week 5)**

### Goal
Create single entry point for all services with routing, authentication, and rate limiting.

### Option 1: Kong (Recommended)

**Install Kong:**

```yaml
# Add to docker-compose.dev.yml
services:
  kong-database:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: kong
      POSTGRES_USER: kong
      POSTGRES_PASSWORD: kong
    volumes:
      - kong-db-data:/var/lib/postgresql/data

  kong-migrations:
    image: kong:latest
    command: kong migrations bootstrap
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: kong
    depends_on:
      - kong-database

  kong:
    image: kong:latest
    environment:
      KONG_DATABASE: postgres
      KONG_PG_HOST: kong-database
      KONG_PG_USER: kong
      KONG_PG_PASSWORD: kong
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
      KONG_PROXY_ERROR_LOG: /dev/stderr
      KONG_ADMIN_ERROR_LOG: /dev/stderr
      KONG_ADMIN_LISTEN: 0.0.0.0:8001
    ports:
      - "8000:8000"  # Proxy
      - "8443:8443"  # Proxy SSL
      - "8001:8001"  # Admin API
    depends_on:
      - kong-database
      - kong-migrations
```

**Configure Kong routes:**

```bash
# Create relay service
curl -i -X POST http://localhost:8001/services/ \
  --data name=relay-service \
  --data url='http://relay-service:8006'

# Add route
curl -i -X POST http://localhost:8001/services/relay-service/routes \
  --data 'paths[]=/api/v1/relay' \
  --data name=relay-route

# Test through gateway
curl http://localhost:8000/api/v1/relay/health
```

### Option 2: Traefik (Alternative)

```yaml
# docker-compose.dev.yml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
      - "8080:8080"  # Dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
  
  relay-service:
    # ... existing config ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.relay.rule=PathPrefix(`/api/v1/relay`)"
      - "traefik.http.services.relay.loadbalancer.server.port=8006"
```

---

## **PHASE 3: Media Service Migration (Week 6-7)**

### Implementation

#### Step 1: Set up MinIO (S3-compatible storage)

```yaml
# Already added in Phase 0
minio:
  image: minio/minio
  # ...
```

#### Step 2: Create Media Service

```bash
python create_service.py media 8005
```

#### Step 3: Implement Storage Logic

**File: `microservices/media-service/app/services/storage_service.py`**

```python
from minio import Minio
from minio.error import S3Error
import os
from datetime import timedelta

class StorageService:
    def __init__(self):
        self.client = Minio(
            "minio:9000",
            access_key=os.getenv("MINIO_ACCESS_KEY", "minioadmin"),
            secret_key=os.getenv("MINIO_SECRET_KEY", "minioadmin"),
            secure=False
        )
        
        # Create bucket if not exists
        bucket_name = "media-files"
        if not self.client.bucket_exists(bucket_name):
            self.client.make_bucket(bucket_name)
        
        self.bucket_name = bucket_name
    
    def upload_file(self, file_path: str, object_name: str, content_type: str):
        """Upload file to MinIO"""
        try:
            self.client.fput_object(
                self.bucket_name,
                object_name,
                file_path,
                content_type=content_type
            )
            return True
        except S3Error as e:
            print(f"Error uploading file: {e}")
            return False
    
    def get_presigned_url(self, object_name: str, expires_in_seconds: int = 3600):
        """Get presigned URL for download"""
        try:
            url = self.client.presigned_get_object(
                self.bucket_name,
                object_name,
                expires=timedelta(seconds=expires_in_seconds)
            )
            return url
        except S3Error as e:
            print(f"Error getting presigned URL: {e}")
            return None
    
    def delete_file(self, object_name: str):
        """Delete file from MinIO"""
        try:
            self.client.remove_object(self.bucket_name, object_name)
            return True
        except S3Error as e:
            print(f"Error deleting file: {e}")
            return False
```

#### Step 4: Add Routes

**File: `microservices/media-service/app/api/routes.py`**

```python
from fastapi import APIRouter, UploadFile, File, HTTPException
from app.services.storage_service import StorageService
import uuid
import os

router = APIRouter()
storage_service = StorageService()

@router.post("/upload")
async def upload_media(file: UploadFile = File(...)):
    """Upload media file"""
    # Generate unique filename
    file_ext = os.path.splitext(file.filename)[1]
    object_name = f"{uuid.uuid4()}{file_ext}"
    
    # Save temporarily
    temp_path = f"/tmp/{object_name}"
    with open(temp_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Upload to MinIO
    success = storage_service.upload_file(
        temp_path,
        object_name,
        file.content_type
    )
    
    # Cleanup
    os.remove(temp_path)
    
    if not success:
        raise HTTPException(status_code=500, detail="Upload failed")
    
    return {
        "file_id": object_name,
        "file_name": file.filename,
        "file_size": len(content),
        "content_type": file.content_type
    }

@router.get("/{file_id}")
async def get_media(file_id: str):
    """Get presigned URL for media file"""
    url = storage_service.get_presigned_url(file_id)
    if not url:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {"url": url}

@router.delete("/{file_id}")
async def delete_media(file_id: str):
    """Delete media file"""
    success = storage_service.delete_file(file_id)
    if not success:
        raise HTTPException(status_code=404, detail="File not found")
    
    return {"status": "deleted"}
```

#### Step 5: Update Kong/Traefik

```bash
# Add media service to Kong
curl -i -X POST http://localhost:8001/services/ \
  --data name=media-service \
  --data url='http://media-service:8005'

curl -i -X POST http://localhost:8001/services/media-service/routes \
  --data 'paths[]=/api/v1/media' \
  --data name=media-route
```

---

## **PHASE 4: Auth Service Migration (Week 8-9)**

### Critical Service - Requires Careful Migration

#### Step 1: Database Migration

**Copy users table to auth_db:**

```sql
-- Connect to new auth_db
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    public_keys JSONB NOT NULL,
    full_name VARCHAR(255),
    avatar_url VARCHAR(500),
    bio VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP,
    role VARCHAR(20) DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- Copy data from monolith database
INSERT INTO users SELECT * FROM monolith_db.users;
```

#### Step 2: Create Auth Service

```bash
python create_service.py auth 8001
```

#### Step 3: Implement Auth Logic

**File: `microservices/auth-service/app/models/user.py`**

```python
# Copy from backend/app/models/user.py
from sqlalchemy import Column, String, Boolean, DateTime, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from datetime import datetime, timezone
import uuid
from shared.database.base_repository import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    username = Column(String(100), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    public_keys = Column(JSON, nullable=False)
    full_name = Column(String(255))
    avatar_url = Column(String(500))
    bio = Column(String(500))
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    last_seen = Column(DateTime)
    role = Column(String(20), default='user')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        Index('idx_users_email', 'email'),
        Index('idx_users_username', 'username'),
    )
```

**File: `microservices/auth-service/app/services/auth_service.py`**

```python
# Copy from backend/app/services/auth_service.py
import bcrypt
import jwt
from datetime import datetime, timedelta
from app.models.user import User
from sqlalchemy.orm import Session
import os

class AuthService:
    def __init__(self):
        self.secret_key = os.getenv("JWT_SECRET_KEY")
        self.algorithm = "HS256"
        self.access_token_expire_minutes = 1440
    
    def create_user(self, db: Session, email: str, username: str, password: str, full_name: str):
        """Create new user"""
        # Hash password
        password_hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt())
        
        # Create user
        user = User(
            email=email,
            username=username,
            password_hash=password_hash.decode(),
            full_name=full_name,
            public_keys=[]
        )
        
        db.add(user)
        db.commit()
        db.refresh(user)
        
        return user
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password"""
        return bcrypt.checkpw(plain_password.encode(), hashed_password.encode())
    
    def create_access_token(self, user_id: str) -> str:
        """Create JWT access token"""
        payload = {
            "sub": str(user_id),
            "exp": datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        }
        return jwt.encode(payload, self.secret_key, algorithm=self.algorithm)
    
    def verify_token(self, token: str) -> str:
        """Verify JWT token and return user_id"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload.get("sub")
        except jwt.PyJWTError:
            return None
    
    def authenticate(self, db: Session, email: str, password: str):
        """Authenticate user"""
        user = db.query(User).filter(User.email == email).first()
        
        if not user or not self.verify_password(password, user.password_hash):
            return None
        
        token = self.create_access_token(user.id)
        return {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name
            }
        }
```

**File: `microservices/auth-service/app/api/routes.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.services.auth_service import AuthService
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from shared.database.base_repository import DatabaseManager

router = APIRouter()
auth_service = AuthService()

# Will be injected from main.py
def get_db():
    pass

@router.post("/register", response_model=TokenResponse)
async def register(request: RegisterRequest, db: Session = Depends(get_db)):
    """Register new user"""
    try:
        user = auth_service.create_user(
            db=db,
            email=request.email,
            username=request.username,
            password=request.password,
            full_name=request.full_name
        )
        
        token = auth_service.create_access_token(user.id)
        
        return TokenResponse(
            access_token=token,
            token_type="bearer",
            user={
                "id": str(user.id),
                "email": user.email,
                "username": user.username
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )

@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest, db: Session = Depends(get_db)):
    """Login user"""
    result = auth_service.authenticate(db, request.email, request.password)
    
    if not result:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    return TokenResponse(**result)

@router.get("/me")
async def get_current_user(token: str, db: Session = Depends(get_db)):
    """Get current user info"""
    user_id = auth_service.verify_token(token)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    # Get user from database
    from app.models.user import User
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return {
        "id": str(user.id),
        "email": user.email,
        "username": user.username,
        "full_name": user.full_name
    }

@router.post("/verify-token")
async def verify_token(token: str):
    """Verify JWT token (used by other services)"""
    user_id = auth_service.verify_token(token)
    
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    return {"user_id": user_id, "valid": True}
```

#### Step 4: Gradual Traffic Migration

**Strategy:** Dual-write, gradual read migration

1. **Week 8:** Deploy auth service, but keep monolith handling all traffic
2. **Week 9:** Route 10% of traffic to new auth service
3. Monitor for 2-3 days
4. Increase to 50%, then 100%
5. Deprecate monolith auth endpoints

**Kong Canary Deployment:**

```bash
# Add weight to routes
curl -X PATCH http://localhost:8001/services/auth-service \
  --data weight=10  # 10% traffic

curl -X PATCH http://localhost:8001/services/monolith \
  --data weight=90  # 90% traffic
```

---

## **PHASE 5-8: Remaining Services**

Following same pattern:

- **Phase 5:** User Service (Week 10-11)
- **Phase 6:** Message Service (Week 12-13)
- **Phase 7:** Group Service (Week 14-15)
- **Phase 8:** WebSocket Service (Week 16)

*(Detailed implementation similar to Auth Service)*

---

## Infrastructure Setup

### Production Deployment

**Kubernetes Deployment Example:**

```yaml
# k8s/auth-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      containers:
      - name: auth-service
        image: your-registry/auth-service:latest
        ports:
        - containerPort: 8001
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: auth-db-secret
              key: url
        - name: JWT_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: jwt-secret
              key: secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 8001
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: auth-service
spec:
  selector:
    app: auth-service
  ports:
    - protocol: TCP
      port: 80
      targetPort: 8001
  type: ClusterIP
```

### Monitoring Setup

**Prometheus + Grafana:**

```yaml
# docker-compose.monitoring.yml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus

  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prometheus-data:
  grafana-data:
```

**prometheus.yml:**

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'auth-service'
    static_configs:
      - targets: ['auth-service:8001']
  
  - job_name: 'message-service'
    static_configs:
      - targets: ['message-service:8003']
  
  # Add all services...
```

---

## Testing Strategy

### 1. Unit Tests

```python
# microservices/auth-service/tests/test_auth_service.py
import pytest
from app.services.auth_service import AuthService

def test_create_user():
    auth_service = AuthService()
    # Test user creation
    pass

def test_verify_password():
    auth_service = AuthService()
    # Test password verification
    pass

def test_create_jwt_token():
    auth_service = AuthService()
    # Test JWT generation
    pass
```

### 2. Integration Tests

```python
# microservices/tests/integration/test_auth_flow.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_register_and_login():
    """Test complete registration and login flow"""
    async with AsyncClient(base_url="http://localhost:8001") as client:
        # Register
        response = await client.post("/api/v1/register", json={
            "email": "test@example.com",
            "username": "testuser",
            "password": "Test@123",
            "full_name": "Test User"
        })
        assert response.status_code == 200
        
        # Login
        response = await client.post("/api/v1/login", json={
            "email": "test@example.com",
            "password": "Test@123"
        })
        assert response.status_code == 200
        assert "access_token" in response.json()
```

### 3. End-to-End Tests

```python
# tests/e2e/test_messaging_flow.py
import pytest
from httpx import AsyncClient

@pytest.mark.asyncio
async def test_send_message_flow():
    """Test complete messaging workflow across services"""
    gateway_url = "http://localhost:8000"
    
    async with AsyncClient(base_url=gateway_url) as client:
        # 1. Register two users
        user1 = await client.post("/api/v1/auth/register", json={...})
        user2 = await client.post("/api/v1/auth/register", json={...})
        
        # 2. Login user1
        login = await client.post("/api/v1/auth/login", json={...})
        token = login.json()["access_token"]
        
        # 3. Send message
        headers = {"Authorization": f"Bearer {token}"}
        message = await client.post(
            "/api/v1/messages/send",
            headers=headers,
            json={...}
        )
        
        # 4. Verify received
        messages = await client.get(
            f"/api/v1/messages/conversation/{user2_id}",
            headers=headers
        )
        assert len(messages.json()) > 0
```

---

## Rollback Plan

### Service-Level Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/auth-service

# Or rollback to specific revision
kubectl rollout undo deployment/auth-service --to-revision=2
```

### Database Rollback

```sql
-- Backup before migration
pg_dump -h localhost -U postgres auth_db > auth_db_backup.sql

-- Restore if needed
psql -h localhost -U postgres auth_db < auth_db_backup.sql
```

### Traffic Rollback (Kong)

```bash
# Route 100% traffic back to monolith
curl -X PATCH http://localhost:8001/services/monolith \
  --data weight=100

curl -X PATCH http://localhost:8001/services/auth-service \
  --data weight=0
```

---

## Success Metrics

### Performance Metrics
- Response time < 200ms (p95)
- Error rate < 0.1%
- Throughput > 1000 req/s per service
- Database query time < 50ms

### Availability Metrics
- Uptime > 99.9%
- Zero-downtime deployments
- Automatic failover < 5s

### Business Metrics
- User experience unchanged
- Feature parity with monolith
- Development velocity increased

---

## Timeline Summary

```
Week 1-2:   Phase 0 - Preparation
Week 3-4:   Phase 1 - Relay Service
Week 5:     Phase 2 - API Gateway
Week 6-7:   Phase 3 - Media Service
Week 8-9:   Phase 4 - Auth Service
Week 10-11: Phase 5 - User Service
Week 12-13: Phase 6 - Message Service
Week 14-15: Phase 7 - Group Service
Week 16:    Phase 8 - WebSocket Service
Week 17-18: Testing, Optimization, Monolith Retirement
```

---

## Conclusion

This migration plan provides:

✅ **Incremental approach** - One service at a time  
✅ **Zero downtime** - Strangler fig pattern  
✅ **Rollback safety** - Can revert at any phase  
✅ **Production-ready** - Docker, Kubernetes, monitoring  
✅ **Team-friendly** - Clear phases and ownership  

**Next Steps:**
1. Review this plan with your team
2. Set up development environment (Phase 0)
3. Start with Relay Service (Phase 1)
4. Monitor and iterate

---

**Questions? Need clarification on any phase? Ask away! 🚀**
