# Microservices Comparison Matrix

This document compares the monolithic architecture with the proposed microservices architecture for the Messaging App.

---

## Architecture Comparison

| Aspect | Monolithic (Current) | Microservices (Proposed) |
|--------|---------------------|--------------------------|
| **Deployment** | Single FastAPI app | 8 independent services |
| **Database** | 1 PostgreSQL database | 5 separate databases + Redis + MinIO |
| **Code Organization** | All code in `backend/app/` | Separate repos/folders per service |
| **Scaling** | Scale entire application | Scale services independently |
| **Development** | One team, shared codebase | Multiple teams, isolated codebases |
| **Technology Stack** | Python/FastAPI only | Polyglot (Python, Node.js, Go possible) |
| **Testing** | Integrated test suite | Service-level + integration tests |
| **Deployment Time** | 5-10 minutes | 2-3 minutes per service |
| **Failure Impact** | Entire app down | Isolated service failures |
| **Monitoring** | Single log stream | Distributed tracing required |

---

## Service Breakdown

| Service | Current Location | New Location | Database | Port | Dependencies |
|---------|-----------------|--------------|----------|------|--------------|
| **Auth** | `backend/app/api/auth.py` | `auth-service/` | `auth_db` (PostgreSQL) | 8001 | - |
| **User** | `backend/app/api/users.py` + `contacts.py` | `user-service/` | `user_db` (PostgreSQL) | 8002 | Auth Service |
| **Message** | `backend/app/api/messages.py` | `message-service/` | `message_db` (PostgreSQL) | 8003 | Auth, User, Media |
| **Group** | `backend/app/api/groups.py` | `group-service/` | `group_db` (PostgreSQL) | 8004 | Auth, User, Message |
| **Media** | `backend/app/api/media.py` | `media-service/` | `media_db` + MinIO | 8005 | Auth |
| **Relay** | `backend/app/api/relay.py` + `services/relay_service.py` | `relay-service/` | Redis | 8006 | Message Queue |
| **Notification** | `backend/app/services/email_queue.py` | `notification-service/` | Redis | 8007 | Message Queue |
| **WebSocket** | `backend/app/websocket_manager.py` | `websocket-service/` | Redis | 8008 | All services |

---

## API Endpoints Migration

### Auth Service (Port 8001)

| Endpoint | Current | New Microservice |
|----------|---------|------------------|
| `POST /api/v1/auth/register` | ✅ Monolith | ➡️ Auth Service |
| `POST /api/v1/auth/login` | ✅ Monolith | ➡️ Auth Service |
| `GET /api/v1/auth/me` | ✅ Monolith | ➡️ Auth Service |
| `POST /api/v1/auth/refresh` | ✅ Monolith | ➡️ Auth Service |
| `POST /api/v1/auth/logout` | ✅ Monolith | ➡️ Auth Service |

### User Service (Port 8002)

| Endpoint | Current | New Microservice |
|----------|---------|------------------|
| `GET /api/v1/users/search` | ✅ Monolith | ➡️ User Service |
| `GET /api/v1/users/{id}` | ✅ Monolith | ➡️ User Service |
| `PUT /api/v1/users/{id}` | ✅ Monolith | ➡️ User Service |
| `GET /api/v1/contacts` | ✅ Monolith | ➡️ User Service |
| `POST /api/v1/contacts` | ✅ Monolith | ➡️ User Service |
| `POST /api/v1/invitations/send` | ✅ Monolith | ➡️ User Service |
| `GET /api/v1/invitations/verify/{token}` | ✅ Monolith | ➡️ User Service |

### Message Service (Port 8003)

| Endpoint | Current | New Microservice |
|----------|---------|------------------|
| `POST /api/v1/messages/send` | ✅ Monolith | ➡️ Message Service |
| `GET /api/v1/messages/conversation/{userId}` | ✅ Monolith | ➡️ Message Service |
| `PUT /api/v1/messages/{id}/read` | ✅ Monolith | ➡️ Message Service |
| `DELETE /api/v1/messages/{id}` | ✅ Monolith | ➡️ Message Service |

### Group Service (Port 8004)

| Endpoint | Current | New Microservice |
|----------|---------|------------------|
| `POST /api/v1/groups` | ✅ Monolith | ➡️ Group Service |
| `GET /api/v1/groups` | ✅ Monolith | ➡️ Group Service |
| `GET /api/v1/groups/{id}` | ✅ Monolith | ➡️ Group Service |
| `POST /api/v1/groups/{id}/members` | ✅ Monolith | ➡️ Group Service |
| `POST /api/v1/groups/{id}/messages` | ✅ Monolith | ➡️ Group Service |
| `DELETE /api/v1/groups/{id}` | ✅ Monolith | ➡️ Group Service |

### Media Service (Port 8005)

| Endpoint | Current | New Microservice |
|----------|---------|------------------|
| `POST /api/v1/media/upload` | ✅ Monolith | ➡️ Media Service |
| `GET /api/v1/media/{id}` | ✅ Monolith | ➡️ Media Service |
| `DELETE /api/v1/media/{id}` | ✅ Monolith | ➡️ Media Service |

### Relay Service (Port 8006)

| Endpoint | Current | New Microservice |
|----------|---------|------------------|
| `POST /api/v1/relay/queue` | ✅ Monolith | ➡️ Relay Service |
| `GET /api/v1/relay/pending/{userId}` | ✅ Monolith | ➡️ Relay Service |
| `DELETE /api/v1/relay/{messageId}` | ✅ Monolith | ➡️ Relay Service |

---

## Database Schema Migration

### Current (Monolithic Database)

```sql
-- Single database: messenger_app
Tables:
- users (13 columns, 2 indexes)
- messages (13 columns, 3 indexes)
- groups (8 columns, 1 index)
- group_members (5 columns, 2 indexes)
- group_messages (10 columns, 3 indexes)
- contacts (5 columns, 2 indexes)
- invitations (7 columns, 2 indexes)
- media_attachments (10 columns, 2 indexes)
- relay_messages (in-memory/Redis)
- deleted_users (5 columns)
```

### Proposed (Microservices Databases)

**auth_db:**
```sql
- users (authentication data only)
  - id, email, username, password_hash, public_keys
  - is_active, is_verified, role
  - created_at, updated_at
```

**user_db:**
```sql
- user_profiles (profile data)
  - user_id, full_name, avatar_url, bio, last_seen
- contacts
  - id, user_id, contact_user_id, status, created_at
- invitations
  - id, inviter_id, invitee_email, token, status, expires_at
```

**message_db:**
```sql
- messages
  - id, sender_id, recipient_id
  - encrypted_content, encrypted_session_key
  - crypto_version, encryption_algorithm
  - is_read, created_at
```

**group_db:**
```sql
- groups
  - id, name, description, creator_id, created_at
- group_members
  - id, group_id, user_id, role, joined_at
- group_messages
  - id, group_id, sender_id, encrypted_content
```

**media_db:**
```sql
- media_attachments (metadata only)
  - id, message_id, file_name, file_type
  - file_size, file_url (MinIO path)
  - thumbnail_url, created_at
```

**Redis:**
```
- relay_messages (ephemeral, TTL-based)
- websocket_connections
- session_cache
- rate_limit_counters
```

---

## Infrastructure Requirements

### Current (Monolith)

| Component | Instance | Cost (Monthly) |
|-----------|----------|----------------|
| **Application Server** | 1 × 2GB RAM | $12 |
| **PostgreSQL** | 1 instance | $15 |
| **Redis** | 1 instance | $5 |
| **Total** | 3 instances | **$32** |

### Proposed (Microservices)

| Component | Instances | Cost (Monthly) |
|-----------|-----------|----------------|
| **Auth Service** | 2 × 512MB | $8 |
| **User Service** | 2 × 512MB | $8 |
| **Message Service** | 3 × 1GB | $18 |
| **Group Service** | 2 × 512MB | $8 |
| **Media Service** | 2 × 1GB | $12 |
| **Relay Service** | 2 × 512MB | $8 |
| **Notification Service** | 1 × 512MB | $4 |
| **WebSocket Service** | 3 × 512MB | $12 |
| **API Gateway** | 1 × 1GB | $6 |
| **PostgreSQL** | 5 databases | $50 |
| **Redis** | 1 instance | $10 |
| **RabbitMQ** | 1 instance | $10 |
| **MinIO** | 1 instance | $10 |
| **Monitoring** | Prometheus + Grafana | $8 |
| **Total** | ~25 instances | **$172** |

**Note:** Costs are estimates. Kubernetes can optimize resource usage significantly.

---

## Performance Comparison

### Response Time

| Operation | Monolith | Microservices | Notes |
|-----------|----------|---------------|-------|
| **Login** | 120ms | 150ms | Extra network hop through gateway |
| **Send Message** | 80ms | 100ms | Message + Relay services |
| **Load Messages** | 60ms | 70ms | Database query similar |
| **File Upload** | 200ms | 180ms | Dedicated media service optimized |
| **Group Message** | 100ms | 130ms | Auth + Group + Message services |

### Scalability

| Metric | Monolith | Microservices |
|--------|----------|---------------|
| **RPS (Login)** | 500 | 2000+ (Auth service scaled) |
| **RPS (Messages)** | 1000 | 5000+ (Message service scaled) |
| **Concurrent WebSocket** | 5,000 | 50,000+ (WebSocket service scaled) |
| **File Upload Throughput** | 50 MB/s | 500 MB/s (Media service scaled) |

---

## Development Workflow Comparison

### Monolith

```bash
# Development
1. Clone single repo
2. Install dependencies (one requirements.txt)
3. Run: uvicorn main:app --reload
4. All changes require app restart
5. Single test suite

# Deployment
1. Build entire application
2. Deploy to single server
3. Restart affects all users
```

### Microservices

```bash
# Development
1. Clone/setup 8+ repositories
2. Install dependencies for each service
3. Start infrastructure (Docker Compose)
4. Run services individually
5. Multiple test suites

# Deployment
1. Build changed service(s) only
2. Deploy independently
3. Zero downtime (rolling updates)
4. Canary deployments possible
```

---

## Failure Scenarios

### Scenario 1: Database Failure

| Architecture | Impact | Recovery Time |
|--------------|--------|---------------|
| **Monolith** | Entire application down | Until DB is restored |
| **Microservices** | Only affected service down | Others continue working |

### Scenario 2: Memory Leak in Media Service

| Architecture | Impact | Recovery Time |
|--------------|--------|---------------|
| **Monolith** | Entire app crashes | Full restart required |
| **Microservices** | Only media uploads affected | Restart media service only |

### Scenario 3: High Load on Messaging

| Architecture | Impact | Recovery Time |
|--------------|--------|---------------|
| **Monolith** | All features slow down | Must scale entire app |
| **Microservices** | Other services unaffected | Scale message service only |

---

## When to Choose Each Architecture

### Choose Monolith When:

- ✅ Team size < 5 developers
- ✅ MVP or proof of concept
- ✅ Simple domain with few bounded contexts
- ✅ Limited infrastructure budget
- ✅ Need fast iterations
- ✅ No specialized scaling requirements

### Choose Microservices When:

- ✅ Team size > 5 developers
- ✅ Mature product with clear domain boundaries
- ✅ Need independent scaling
- ✅ Different services have different requirements
- ✅ Have DevOps expertise
- ✅ Need fault isolation
- ✅ Want technology diversity

---

## Hybrid Approach (Recommended for Now)

### Modular Monolith

Keep single deployment but organize as microservices:

```
backend/app/
├── domains/              # Like microservices
│   ├── auth/
│   │   ├── api.py
│   │   ├── service.py
│   │   └── models.py
│   ├── messaging/
│   ├── groups/
│   └── media/
├── shared/
│   ├── database.py
│   └── events.py
└── main.py
```

**Benefits:**
- ✅ Easy to extract to microservices later
- ✅ Clear boundaries
- ✅ Simple deployment
- ✅ No network overhead

**Migration Path:**
1. Start with modular monolith
2. Extract high-value services (Relay, Media)
3. Add API gateway
4. Gradually extract remaining services
5. Full microservices when needed

---

## Decision Framework

Use this checklist to decide if you're ready for microservices:

### Infrastructure
- [ ] Have monitoring/logging solution (Prometheus, Grafana)
- [ ] Have container orchestration (Kubernetes)
- [ ] Have CI/CD pipeline for each service
- [ ] Have service mesh or API gateway ready

### Team
- [ ] Team size > 5 developers
- [ ] Have DevOps expertise
- [ ] Can dedicate team per service
- [ ] Have on-call rotation

### Technical
- [ ] Clear bounded contexts identified
- [ ] Services can be truly independent
- [ ] Have inter-service communication strategy
- [ ] Database migration plan ready

### Business
- [ ] Budget for increased infrastructure
- [ ] Can accept temporary complexity
- [ ] Have 3-6 months for migration
- [ ] Clear ROI from independent scaling

**If you checked < 8 boxes:** Stay with modular monolith  
**If you checked 8-12 boxes:** Start gradual migration  
**If you checked 12+ boxes:** Go full microservices

---

## Conclusion

| Aspect | Winner |
|--------|--------|
| **Simplicity** | 🏆 Monolith |
| **Development Speed (MVP)** | 🏆 Monolith |
| **Scalability** | 🏆 Microservices |
| **Fault Isolation** | 🏆 Microservices |
| **Team Independence** | 🏆 Microservices |
| **Technology Flexibility** | 🏆 Microservices |
| **Cost (Small Scale)** | 🏆 Monolith |
| **Cost (Large Scale)** | 🏆 Microservices |
| **Maintenance** | 🏆 Depends on size |

**For your current stage:** 
- Start with **Modular Monolith**
- Extract **Relay Service** as proof of concept
- Gradually migrate to **Microservices** as team grows

---

**Questions? Ready to start? See:**
- `MICROSERVICES_MIGRATION_PLAN.md` for detailed implementation
- `MICROSERVICES_QUICK_START.md` for getting started in 30 minutes
