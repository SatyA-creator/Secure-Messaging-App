# Microservices Quick Start Guide

## Get Started in 30 Minutes

This guide will help you set up your first microservice (Relay Service) and understand the migration process.

---

## Prerequisites

Before you begin, ensure you have:

- ✅ Docker Desktop installed and running
- ✅ Docker Compose installed
- ✅ Python 3.9+ installed
- ✅ Git installed
- ✅ 8GB RAM minimum
- ✅ 20GB disk space

---

## Step 1: Start Infrastructure (5 minutes)

### 1.1 Navigate to project root

```bash
cd "f:/Intersnhip project/messsaging-app"
```

### 1.2 Create infrastructure file

Create `docker-compose.infrastructure.yml`:

```bash
# Use the file I created in the main plan
# It includes: PostgreSQL databases, Redis, RabbitMQ, MinIO
```

### 1.3 Start services

```bash
docker-compose -f docker-compose.infrastructure.yml up -d
```

### 1.4 Verify services are running

```bash
docker-compose -f docker-compose.infrastructure.yml ps
```

You should see:
- ✅ redis (port 6379)
- ✅ rabbitmq (ports 5672, 15672)
- ✅ minio (ports 9000, 9001)
- ✅ Multiple PostgreSQL instances

### 1.5 Access management interfaces

- **RabbitMQ Management:** http://localhost:15672 (admin/admin)
- **MinIO Console:** http://localhost:9001 (minioadmin/minioadmin)

---

## Step 2: Create Shared Libraries (10 minutes)

### 2.1 Create directory structure

```bash
mkdir -p microservices/shared/{common,database,messaging,monitoring}
```

### 2.2 Create base service class

**File: `microservices/shared/common/base_service.py`**

```python
# Copy from the detailed plan above
# This provides common functionality for all microservices
```

### 2.3 Create database utilities

**File: `microservices/shared/database/base_repository.py`**

```python
# Copy from the detailed plan above
```

### 2.4 Create event bus

**File: `microservices/shared/messaging/event_bus.py`**

```python
# Copy from the detailed plan above
```

### 2.5 Create __init__.py files

```bash
touch microservices/shared/__init__.py
touch microservices/shared/common/__init__.py
touch microservices/shared/database/__init__.py
touch microservices/shared/messaging/__init__.py
```

---

## Step 3: Create Your First Microservice - Relay Service (10 minutes)

### 3.1 Create service directory

```bash
mkdir -p microservices/relay-service/{app,tests}
mkdir -p microservices/relay-service/app/{api,models,schemas,services}
```

### 3.2 Create requirements.txt

**File: `microservices/relay-service/requirements.txt`**

```txt
fastapi==0.115.5
uvicorn[standard]==0.32.1
pydantic==2.10.3
pydantic-settings==2.7.0
redis==5.2.1
pika==1.3.2
python-dotenv==1.0.1
```

### 3.3 Copy relay service logic

**Copy these files from your backend:**

```bash
# Copy relay message model
cp "backend/app/models/relay_message.py" "microservices/relay-service/app/models/"

# Copy relay service
cp "backend/app/services/relay_service.py" "microservices/relay-service/app/services/"
```

### 3.4 Create main.py

**File: `microservices/relay-service/app/main.py`**

```python
import sys
import os

# Add parent directory to path for shared imports
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../..')))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import redis
from app.api import routes
from app.services.relay_service import RelayService

app = FastAPI(
    title="Relay Service",
    version="1.0.0",
    description="Ephemeral message relay microservice"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Redis
redis_client = redis.Redis(
    host=os.getenv("REDIS_HOST", "localhost"),
    port=int(os.getenv("REDIS_PORT", "6379")),
    decode_responses=True
)

# Initialize relay service
relay_service = RelayService()
relay_service.start()

# Include routes
app.include_router(routes.router, prefix="/api/v1")

# Health check
@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "relay-service",
        "version": "1.0.0"
    }

# Startup event
@app.on_event("startup")
async def startup():
    print("🚀 Relay Service starting...")
    relay_service.start()

# Shutdown event
@app.on_event("shutdown")
async def shutdown():
    print("🛑 Relay Service shutting down...")
    relay_service.stop()
```

### 3.5 Create API routes

**File: `microservices/relay-service/app/api/routes.py`**

```python
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.services.relay_service import relay_service
import uuid

router = APIRouter()

class QueueMessageRequest(BaseModel):
    sender_id: str
    recipient_id: str
    encrypted_content: str
    encrypted_session_key: str

class RelayMessageResponse(BaseModel):
    id: str
    sender_id: str
    recipient_id: str
    encrypted_content: str
    encrypted_session_key: str
    created_at: str
    expires_at: str

@router.post("/queue", response_model=RelayMessageResponse)
async def queue_message(request: QueueMessageRequest):
    """Queue a message for offline delivery"""
    message = relay_service.store_message(
        sender_id=request.sender_id,
        recipient_id=request.recipient_id,
        encrypted_content=request.encrypted_content,
        encrypted_session_key=request.encrypted_session_key
    )
    
    return RelayMessageResponse(
        id=message.id,
        sender_id=message.sender_id,
        recipient_id=message.recipient_id,
        encrypted_content=message.encrypted_content,
        encrypted_session_key=message.encrypted_session_key,
        created_at=message.created_at.isoformat(),
        expires_at=message.expires_at.isoformat()
    )

@router.get("/pending/{user_id}", response_model=List[RelayMessageResponse])
async def get_pending_messages(user_id: str):
    """Get all pending messages for a user"""
    messages = relay_service.get_pending_messages(user_id)
    
    return [
        RelayMessageResponse(
            id=msg.id,
            sender_id=msg.sender_id,
            recipient_id=msg.recipient_id,
            encrypted_content=msg.encrypted_content,
            encrypted_session_key=msg.encrypted_session_key,
            created_at=msg.created_at.isoformat(),
            expires_at=msg.expires_at.isoformat()
        )
        for msg in messages
    ]

@router.delete("/{message_id}")
async def acknowledge_message(message_id: str):
    """Acknowledge and delete a delivered message"""
    success = relay_service.acknowledge_message(message_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Message not found")
    
    return {"status": "acknowledged", "message_id": message_id}

@router.post("/user/{user_id}/online")
async def mark_user_online(user_id: str):
    """Mark user as online"""
    relay_service.mark_user_online(user_id)
    return {"status": "online", "user_id": user_id}

@router.post("/user/{user_id}/offline")
async def mark_user_offline(user_id: str):
    """Mark user as offline"""
    relay_service.mark_user_offline(user_id)
    return {"status": "offline", "user_id": user_id}

@router.get("/stats")
async def get_stats():
    """Get relay service statistics"""
    return {
        "total_messages": len(relay_service._messages),
        "online_users": len(relay_service._online_users),
        "recipients_with_messages": len(relay_service._recipient_index)
    }
```

### 3.6 Create .env file

**File: `microservices/relay-service/.env`**

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Service Configuration
PORT=8006
```

---

## Step 4: Run Relay Service (2 minutes)

### 4.1 Install dependencies

```bash
cd microservices/relay-service
pip install -r requirements.txt
```

### 4.2 Run the service

```bash
# From the relay-service directory
python -m uvicorn app.main:app --reload --port 8006
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8006
INFO:     🚀 Relay Service starting...
```

---

## Step 5: Test Your Microservice (3 minutes)

### 5.1 Health Check

```bash
curl http://localhost:8006/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "relay-service",
  "version": "1.0.0"
}
```

### 5.2 Queue a Message

```bash
curl -X POST http://localhost:8006/api/v1/queue \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "user-123",
    "recipient_id": "user-456",
    "encrypted_content": "SGVsbG8gV29ybGQh",
    "encrypted_session_key": "a2V5MTIz"
  }'
```

Expected response:
```json
{
  "id": "msg-abc123",
  "sender_id": "user-123",
  "recipient_id": "user-456",
  "encrypted_content": "SGVsbG8gV29ybGQh",
  "encrypted_session_key": "a2V5MTIz",
  "created_at": "2026-02-10T10:30:00",
  "expires_at": "2026-02-17T10:30:00"
}
```

### 5.3 Get Pending Messages

```bash
curl http://localhost:8006/api/v1/pending/user-456
```

Expected response:
```json
[
  {
    "id": "msg-abc123",
    "sender_id": "user-123",
    ...
  }
]
```

### 5.4 Get Statistics

```bash
curl http://localhost:8006/api/v1/stats
```

Expected response:
```json
{
  "total_messages": 1,
  "online_users": 0,
  "recipients_with_messages": 1
}
```

---

## Step 6: Dockerize the Service (Optional)

### 6.1 Create Dockerfile

**File: `microservices/relay-service/Dockerfile`**

```dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared libraries
COPY shared/ /app/shared/

# Copy service code
COPY relay-service/app /app/app

# Expose port
EXPOSE 8006

# Run service
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8006"]
```

### 6.2 Build Docker image

```bash
cd microservices
docker build -t relay-service:latest -f relay-service/Dockerfile .
```

### 6.3 Run in Docker

```bash
docker run -d \
  --name relay-service \
  -p 8006:8006 \
  -e REDIS_HOST=host.docker.internal \
  -e REDIS_PORT=6379 \
  relay-service:latest
```

---

## Step 7: Integration with Frontend (Optional)

### 7.1 Update API configuration

**File: `src/config/api.ts`**

Add relay endpoints:

```typescript
export const API_ENDPOINTS = {
  // ... existing endpoints ...
  
  RELAY: {
    QUEUE: 'http://localhost:8006/api/v1/queue',
    PENDING: (userId: string) => `http://localhost:8006/api/v1/pending/${userId}`,
    ACK: (messageId: string) => `http://localhost:8006/api/v1/${messageId}`,
    MARK_ONLINE: (userId: string) => `http://localhost:8006/api/v1/user/${userId}/online`,
    MARK_OFFLINE: (userId: string) => `http://localhost:8006/api/v1/user/${userId}/offline`,
  }
};
```

### 7.2 Test from frontend

Update your relay client to use the new endpoints.

---

## Next Steps

### ✅ You've successfully created your first microservice!

**What you've learned:**
- Setting up infrastructure with Docker
- Creating shared libraries
- Building a microservice from monolith code
- Testing microservice endpoints
- Dockerizing services

### 🎯 Next Actions:

1. **Set up API Gateway** (Phase 2)
   - Install Kong or Traefik
   - Route traffic through gateway
   - Add authentication middleware

2. **Extract Media Service** (Phase 3)
   - Similar process to Relay Service
   - Uses MinIO for storage
   - File upload/download functionality

3. **Extract Auth Service** (Phase 4)
   - Critical service - requires careful migration
   - Database migration required
   - Gradual traffic shifting

---

## Troubleshooting

### Service won't start

**Problem:** ModuleNotFoundError: No module named 'shared'

**Solution:** Make sure you're running from the right directory and shared libraries are in place.

```bash
# Add to PYTHONPATH
export PYTHONPATH="${PYTHONPATH}:$(pwd)/microservices"
```

### Can't connect to Redis

**Problem:** Connection refused to localhost:6379

**Solution:** Ensure Redis container is running:

```bash
docker-compose -f docker-compose.infrastructure.yml ps
docker-compose -f docker-compose.infrastructure.yml logs redis
```

### Port already in use

**Problem:** Port 8006 is already in use

**Solution:** Either stop the conflicting service or use a different port:

```bash
# Use different port
python -m uvicorn app.main:app --reload --port 8007
```

---

## Resources

- **Full Migration Plan:** See `MICROSERVICES_MIGRATION_PLAN.md`
- **Architecture Analysis:** See `docs/MICROSERVICES_ANALYSIS.md`
- **Docker Documentation:** https://docs.docker.com/
- **FastAPI Documentation:** https://fastapi.tiangolo.com/
- **Kong API Gateway:** https://docs.konghq.com/

---

## Questions?

If you encounter issues or need clarification:

1. Check the troubleshooting section above
2. Review the full migration plan
3. Check Docker logs: `docker-compose logs <service>`
4. Verify environment variables

**Happy Coding! 🚀**
