# QuantChat - Complete System Diagrams

**Project:** Secure Messaging Application with Post-Quantum Cryptography  
**Version:** 1.0  
**Date:** January 29, 2026

---

## Table of Contents
1. [Entity Relationship Diagram (ERD)](#1-entity-relationship-diagram-erd)
2. [Data Flow Diagram (DFD)](#2-data-flow-diagram-dfd)
3. [User Flow Diagram](#3-user-flow-diagram)
4. [Post-Quantum Cryptography Architecture](#4-post-quantum-cryptography-architecture)
5. [System Architecture](#5-system-architecture)
6. [WebSocket Communication Flow](#6-websocket-communication-flow)

---

## 1. Entity Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--o{ MESSAGES : sends
    USERS ||--o{ MESSAGES : receives
    USERS ||--o{ CONTACTS : has
    USERS ||--o{ GROUP_MEMBERS : belongs_to
    USERS ||--o{ INVITATIONS : sends
    USERS ||--o{ INVITATIONS : receives
    GROUPS ||--o{ GROUP_MEMBERS : contains
    GROUPS ||--o{ GROUP_MESSAGES : has
    MESSAGES ||--o{ MEDIA_ATTACHMENTS : contains
    GROUP_MESSAGES ||--o{ MEDIA_ATTACHMENTS : contains

    USERS {
        uuid id PK
        string email UK
        string username UK
        string password_hash
        string full_name
        string public_key
        string private_key_encrypted
        boolean is_active
        datetime last_seen
        datetime created_at
        datetime updated_at
    }

    CONTACTS {
        uuid id PK
        uuid user_id FK
        uuid contact_user_id FK
        string status
        datetime created_at
    }

    MESSAGES {
        uuid id PK
        uuid sender_id FK
        uuid recipient_id FK
        text encrypted_content
        string encrypted_session_key
        boolean is_read
        boolean has_media
        datetime created_at
        datetime read_at
    }

    GROUPS {
        uuid id PK
        string name
        text description
        uuid created_by FK
        string group_type
        datetime created_at
        datetime updated_at
    }

    GROUP_MEMBERS {
        uuid id PK
        uuid group_id FK
        uuid user_id FK
        string role
        datetime joined_at
    }

    GROUP_MESSAGES {
        uuid id PK
        uuid group_id FK
        uuid sender_id FK
        text encrypted_content
        string encrypted_session_key
        boolean has_media
        datetime created_at
    }

    MEDIA_ATTACHMENTS {
        uuid id PK
        uuid message_id FK
        uuid group_message_id FK
        string file_name
        string file_type
        integer file_size
        string file_url
        string thumbnail_url
        datetime created_at
    }

    INVITATIONS {
        uuid id PK
        uuid inviter_id FK
        string invitee_email
        string token
        string status
        datetime created_at
        datetime expires_at
        datetime accepted_at
    }
```

---

## 2. Data Flow Diagram (DFD)

### Level 0 - Context Diagram

```mermaid
graph TB
    User[👤 User]
    System[QuantChat<br/>Secure Messaging System]
    Database[(PostgreSQL<br/>Database)]
    RelayService[Relay Service<br/>Message Queue]
    EmailService[Email Service<br/>Resend]

    User -->|Login/Register| System
    User -->|Send Messages| System
    User -->|Upload Media| System
    System -->|Receive Messages| User
    System -->|Notifications| User
    
    System <-->|Store/Retrieve Data| Database
    System <-->|Queue Messages| RelayService
    System -->|Send Invitations| EmailService
    
    style System fill:#4A90E2,color:#fff
    style Database fill:#50C878,color:#fff
    style RelayService fill:#FF6B6B,color:#fff
    style EmailService fill:#FFD93D,color:#000
```

### Level 1 - Main Processes

```mermaid
graph TB
    subgraph "Client Layer"
        UI[React Frontend<br/>TypeScript]
        LocalDB[(IndexedDB<br/>Local Storage)]
        WSClient[WebSocket Client]
    end

    subgraph "Backend Layer"
        Auth[Authentication<br/>Service]
        MessageAPI[Message API<br/>FastAPI]
        ContactAPI[Contact API]
        MediaAPI[Media API]
        WSServer[WebSocket Server]
        RelayClient[Relay Client]
    end

    subgraph "Data Layer"
        PostgreSQL[(PostgreSQL<br/>Database)]
        RelayQueue[(Relay Service<br/>Message Queue)]
        FileStorage[File Storage<br/>Backend/Uploads]
    end

    subgraph "External Services"
        Email[Email Service<br/>Resend]
    end

    UI -->|Login/Register| Auth
    UI -->|Send Message| MessageAPI
    UI -->|Add Contact| ContactAPI
    UI -->|Upload File| MediaAPI
    UI <-->|Real-time| WSClient
    UI <-->|Offline Storage| LocalDB

    WSClient <-->|WebSocket| WSServer
    
    Auth -->|Verify| PostgreSQL
    MessageAPI -->|Store| PostgreSQL
    MessageAPI -->|Queue| RelayClient
    ContactAPI -->|Store| PostgreSQL
    MediaAPI -->|Save| FileStorage
    MediaAPI -->|Metadata| PostgreSQL
    
    RelayClient <-->|Push/Pull| RelayQueue
    WSServer <-->|Fetch Pending| RelayQueue
    
    ContactAPI -->|Send Invite| Email

    style UI fill:#4A90E2,color:#fff
    style Auth fill:#9B59B6,color:#fff
    style MessageAPI fill:#3498DB,color:#fff
    style WSServer fill:#E74C3C,color:#fff
    style PostgreSQL fill:#27AE60,color:#fff
    style RelayQueue fill:#F39C12,color:#fff
```

### Level 2 - Message Flow Detail

```mermaid
sequenceDiagram
    participant U1 as User 1 (Sender)
    participant FE1 as Frontend 1
    participant LDB1 as IndexedDB 1
    participant WS as WebSocket Server
    participant API as Message API
    participant DB as PostgreSQL
    participant Relay as Relay Service
    participant FE2 as Frontend 2
    participant LDB2 as IndexedDB 2
    participant U2 as User 2 (Recipient)

    U1->>FE1: Type & Send Message
    FE1->>FE1: Generate Message ID
    FE1->>LDB1: Save (synced=false)
    FE1->>FE1: Encrypt Content
    FE1->>WS: Send via WebSocket
    
    WS->>API: Forward Message
    API->>DB: Store Message
    API->>Relay: Queue for Recipient
    API-->>WS: Confirm Sent
    
    WS-->>FE1: message_sent event
    FE1->>LDB1: Update (synced=true)
    FE1->>U1: Show "Sent" ✓
    
    alt Recipient Online
        WS->>FE2: new_message event
        FE2->>LDB2: Save Message
        FE2->>U2: Display Message
        FE2->>WS: delivery_confirmation
        WS->>FE1: message_delivered
        FE1->>U1: Show "Delivered" ✓✓
    else Recipient Offline
        Relay->>Relay: Store in Queue
        Note over Relay: Wait for recipient
        FE2->>WS: Connect (later)
        WS->>Relay: Fetch Pending
        Relay-->>WS: Return Messages
        WS->>FE2: Deliver Messages
        FE2->>LDB2: Save Messages
        FE2->>U2: Display Messages
    end
```

---

## 3. User Flow Diagram

### Complete User Journey

```mermaid
graph TB
    Start([User Opens App])
    
    Start --> CheckAuth{Authenticated?}
    
    CheckAuth -->|No| Landing[Landing Page]
    Landing --> AuthChoice{Choose Action}
    AuthChoice -->|Login| LoginForm[Login Form]
    AuthChoice -->|Register| RegisterForm[Register Form]
    
    LoginForm --> SubmitLogin[Submit Credentials]
    RegisterForm --> SubmitRegister[Submit Registration]
    
    SubmitLogin --> ValidateLogin{Valid?}
    ValidateLogin -->|No| LoginError[Show Error]
    LoginError --> LoginForm
    ValidateLogin -->|Yes| StoreToken[Store JWT Token]
    
    SubmitRegister --> ValidateReg{Valid?}
    ValidateReg -->|No| RegError[Show Error]
    RegError --> RegisterForm
    ValidateReg -->|Yes| CreateUser[Create User Account]
    CreateUser --> StoreToken
    
    CheckAuth -->|Yes| StoreToken
    StoreToken --> InitWS[Initialize WebSocket]
    InitWS --> FetchContacts[Fetch Contacts]
    FetchContacts --> LoadLocal[Load Local Messages]
    LoadLocal --> ChatDashboard[Chat Dashboard]
    
    ChatDashboard --> UserAction{User Action}
    
    UserAction -->|Select Contact| LoadConv[Load Conversation]
    LoadConv --> ShowMessages[Display Messages]
    ShowMessages --> MessageAction{Action}
    
    MessageAction -->|Type Message| ComposeMsg[Compose Message]
    ComposeMsg --> AttachMedia{Add Media?}
    AttachMedia -->|Yes| UploadFile[Upload Files]
    AttachMedia -->|No| SendMsg[Send Message]
    UploadFile --> SendMsg
    
    SendMsg --> SaveLocal[Save to IndexedDB]
    SaveLocal --> CheckOnline{Online?}
    CheckOnline -->|Yes| SendWS[Send via WebSocket]
    CheckOnline -->|No| QueueOffline[Queue for Retry]
    
    SendWS --> ServerProcess[Server Processing]
    ServerProcess --> RelayQueue[Add to Relay Queue]
    RelayQueue --> NotifyRecipient{Recipient Online?}
    
    NotifyRecipient -->|Yes| DeliverNow[Deliver Immediately]
    NotifyRecipient -->|No| StoreRelay[Store in Relay]
    
    DeliverNow --> UpdateStatus1[Update: Delivered ✓✓]
    StoreRelay --> WaitRecipient[Wait for Recipient]
    WaitRecipient --> RecipientOnline[Recipient Connects]
    RecipientOnline --> DeliverNow
    
    UpdateStatus1 --> RecipientRead{Read?}
    RecipientRead -->|Yes| UpdateStatus2[Update: Read ✓✓]
    RecipientRead -->|No| ShowMessages
    UpdateStatus2 --> ShowMessages
    
    MessageAction -->|Export Chat| ExportFlow[Export to Markdown]
    ExportFlow --> ShowMessages
    
    MessageAction -->|Back| ChatDashboard
    
    UserAction -->|Add Contact| InviteForm[Enter Email]
    InviteForm --> SendInvite[Send Invitation]
    SendInvite --> EmailSent[Email Sent]
    EmailSent --> ChatDashboard
    
    UserAction -->|Create Group| GroupForm[Group Details]
    GroupForm --> SelectMembers[Select Members]
    SelectMembers --> CreateGroup[Create Group]
    CreateGroup --> ChatDashboard
    
    UserAction -->|Logout| ClearData[Clear Local Data]
    ClearData --> DisconnectWS[Disconnect WebSocket]
    DisconnectWS --> Landing
    
    QueueOffline --> RetryLoop[Retry on Reconnect]
    RetryLoop --> SendWS

    style Start fill:#4A90E2,color:#fff
    style ChatDashboard fill:#27AE60,color:#fff
    style SendMsg fill:#E74C3C,color:#fff
    style DeliverNow fill:#F39C12,color:#fff
    style UpdateStatus2 fill:#9B59B6,color:#fff
```

---

## 4. Post-Quantum Cryptography Architecture

### PQC Layer Integration

```mermaid
graph TB
    subgraph "Client Side - User A"
        A_UI[User Interface]
        A_Crypto[Crypto Layer<br/>PQC Ready]
        A_KeyStore[Key Store<br/>CRYSTALS-Kyber]
        A_WS[WebSocket Client]
    end

    subgraph "Cryptographic Operations"
        KeyGen[Key Generation<br/>CRYSTALS-Kyber-1024]
        KeyExchange[Key Exchange<br/>ECDH + Kyber]
        Encrypt[Encryption<br/>AES-256-GCM]
        Sign[Signature<br/>CRYSTALS-Dilithium]
    end

    subgraph "Server Layer"
        RelayServer[Relay Server<br/>Message Queue]
        KeyServer[Key Distribution<br/>Server]
        DB[(Encrypted<br/>Storage)]
    end

    subgraph "Client Side - User B"
        B_WS[WebSocket Client]
        B_Crypto[Crypto Layer<br/>PQC Ready]
        B_KeyStore[Key Store<br/>CRYSTALS-Kyber]
        B_UI[User Interface]
    end

    A_UI -->|1. Compose Message| A_Crypto
    A_Crypto -->|2. Request Keys| A_KeyStore
    A_KeyStore -->|3. Generate/Retrieve| KeyGen
    
    KeyGen -->|4. Public Key| KeyExchange
    A_Crypto -->|5. Initiate Exchange| KeyExchange
    KeyExchange -->|6. Shared Secret| Encrypt
    
    A_Crypto -->|7. Plaintext| Encrypt
    Encrypt -->|8. Ciphertext| Sign
    Sign -->|9. Signed Message| A_WS
    
    A_WS -->|10. Encrypted Payload| RelayServer
    RelayServer -->|11. Store| DB
    RelayServer -->|12. Forward| B_WS
    
    B_WS -->|13. Receive| B_Crypto
    B_Crypto -->|14. Verify Signature| Sign
    Sign -->|15. Valid| Encrypt
    B_Crypto -->|16. Decrypt| Encrypt
    Encrypt -->|17. Plaintext| B_UI
    
    KeyServer -.->|Public Key Distribution| A_KeyStore
    KeyServer -.->|Public Key Distribution| B_KeyStore

    style KeyGen fill:#9B59B6,color:#fff
    style KeyExchange fill:#E74C3C,color:#fff
    style Encrypt fill:#27AE60,color:#fff
    style Sign fill:#F39C12,color:#fff
    style RelayServer fill:#3498DB,color:#fff
```

### PQC Algorithm Stack

```mermaid
graph LR
    subgraph "Current Implementation (Phase 1)"
        ECDH[ECDH<br/>Key Exchange]
        AES[AES-256-GCM<br/>Encryption]
        HMAC[HMAC-SHA256<br/>Authentication]
    end

    subgraph "PQC Ready (Phase 2)"
        Kyber[CRYSTALS-Kyber-1024<br/>KEM]
        Dilithium[CRYSTALS-Dilithium<br/>Signatures]
        Hybrid[Hybrid Mode<br/>ECDH + Kyber]
    end

    subgraph "Future Quantum-Safe (Phase 3)"
        FullPQC[Full PQC Stack<br/>NIST Standards]
        QKD[Quantum Key<br/>Distribution]
    end

    ECDH -->|Upgrade Path| Hybrid
    Hybrid -->|Transition| Kyber
    Kyber -->|Future| FullPQC
    
    AES -.->|Remains| FullPQC
    HMAC -->|Replace| Dilithium
    Dilithium -->|Integrate| FullPQC
    
    FullPQC -.->|Optional| QKD

    style Kyber fill:#9B59B6,color:#fff
    style Dilithium fill:#E74C3C,color:#fff
    style Hybrid fill:#F39C12,color:#fff
    style FullPQC fill:#27AE60,color:#fff
```

### Cryptographic Message Flow

```mermaid
sequenceDiagram
    participant A as Alice (Sender)
    participant A_Crypto as Alice Crypto Layer
    participant Server as Relay Server
    participant B_Crypto as Bob Crypto Layer
    participant B as Bob (Recipient)

    Note over A,B: Phase 1: Key Exchange (Hybrid ECDH + Kyber)
    
    A->>A_Crypto: Generate Kyber Keypair
    A_Crypto->>A_Crypto: Generate ECDH Keypair
    A_Crypto->>Server: Publish Public Keys
    
    B->>B_Crypto: Generate Kyber Keypair
    B_Crypto->>B_Crypto: Generate ECDH Keypair
    B_Crypto->>Server: Publish Public Keys
    
    Server-->>A_Crypto: Bob's Public Keys
    Server-->>B_Crypto: Alice's Public Keys
    
    Note over A,B: Phase 2: Session Key Derivation
    
    A_Crypto->>A_Crypto: ECDH(Alice_priv, Bob_pub)
    A_Crypto->>A_Crypto: Kyber.Encapsulate(Bob_pub)
    A_Crypto->>A_Crypto: Combine: HKDF(ECDH || Kyber)
    A_Crypto->>A_Crypto: Derive Session Key
    
    Note over A,B: Phase 3: Message Encryption
    
    A->>A_Crypto: Plaintext Message
    A_Crypto->>A_Crypto: AES-256-GCM Encrypt
    A_Crypto->>A_Crypto: Dilithium Sign
    A_Crypto->>Server: {Ciphertext, Signature, Kyber_CT}
    
    Note over A,B: Phase 4: Message Delivery
    
    Server->>Server: Store Encrypted
    Server->>B_Crypto: Forward Message
    
    Note over A,B: Phase 5: Decryption
    
    B_Crypto->>B_Crypto: Verify Dilithium Signature
    B_Crypto->>B_Crypto: Kyber.Decapsulate(Kyber_CT)
    B_Crypto->>B_Crypto: ECDH(Bob_priv, Alice_pub)
    B_Crypto->>B_Crypto: Derive Session Key
    B_Crypto->>B_Crypto: AES-256-GCM Decrypt
    B_Crypto->>B: Plaintext Message
    
    rect rgb(200, 220, 250)
        Note over A,B: All keys rotated every 24 hours
    end
```

---

## 5. System Architecture

### High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend - React + TypeScript"
        UI[User Interface<br/>shadcn/ui + Tailwind]
        AuthCtx[Auth Context<br/>JWT Management]
        ChatCtx[Chat Context<br/>State Management]
        WSLib[WebSocket Library<br/>Real-time Comm]
        LocalDB[(IndexedDB<br/>Dexie.js)]
        CryptoLib[Crypto Library<br/>PQC Ready]
    end

    subgraph "Backend - FastAPI + Python"
        AuthAPI[Auth API<br/>JWT + Bcrypt]
        MessageAPI[Message API<br/>CRUD Operations]
        ContactAPI[Contact API]
        MediaAPI[Media API<br/>File Upload]
        GroupAPI[Group API]
        WSHandler[WebSocket Handler<br/>Connection Manager]
        RelayClient[Relay Client<br/>Message Queue]
    end

    subgraph "Data Storage"
        PostgreSQL[(PostgreSQL<br/>Supabase)]
        FileStore[File Storage<br/>Backend/Uploads]
        Redis[(Redis Cache<br/>Sessions)]
    end

    subgraph "External Services"
        RelayService[Relay Service<br/>Message Queue]
        EmailService[Email Service<br/>Resend]
    end

    UI --> AuthCtx
    UI --> ChatCtx
    ChatCtx --> WSLib
    ChatCtx --> LocalDB
    ChatCtx --> CryptoLib
    
    WSLib <-->|WSS| WSHandler
    AuthCtx -->|HTTPS| AuthAPI
    ChatCtx -->|HTTPS| MessageAPI
    ChatCtx -->|HTTPS| ContactAPI
    ChatCtx -->|HTTPS| MediaAPI
    
    AuthAPI --> PostgreSQL
    MessageAPI --> PostgreSQL
    ContactAPI --> PostgreSQL
    MediaAPI --> PostgreSQL
    MediaAPI --> FileStore
    GroupAPI --> PostgreSQL
    
    WSHandler --> RelayClient
    RelayClient <--> RelayService
    MessageAPI --> RelayClient
    
    ContactAPI --> EmailService
    AuthAPI --> Redis

    style UI fill:#4A90E2,color:#fff
    style WSHandler fill:#E74C3C,color:#fff
    style PostgreSQL fill:#27AE60,color:#fff
    style RelayService fill:#F39C12,color:#fff
    style CryptoLib fill:#9B59B6,color:#fff
```

### Technology Stack

```mermaid
graph LR
    subgraph "Frontend Stack"
        React[React 18.3.1]
        TS[TypeScript 5.8.3]
        Vite[Vite 5.4.19]
        Tailwind[Tailwind CSS 3.4.17]
        Shadcn[shadcn/ui]
        ReactQuery[TanStack Query 5.83.0]
        Dexie[Dexie.js<br/>IndexedDB]
    end

    subgraph "Backend Stack"
        FastAPI[FastAPI 0.115.5]
        Python[Python 3.9+]
        SQLAlchemy[SQLAlchemy 2.0.36]
        Alembic[Alembic 1.14.0]
        PyJWT[PyJWT 2.10.1]
        Bcrypt[Bcrypt 4.2.1]
        Uvicorn[Uvicorn 0.32.1]
    end

    subgraph "Database & Storage"
        Postgres[PostgreSQL<br/>Supabase]
        RedisDB[Redis 5.2.1]
        FileSystem[File System<br/>Local Storage]
    end

    subgraph "Infrastructure"
        Vercel[Vercel<br/>Frontend Host]
        Render[Render<br/>Backend Host]
        Docker[Docker<br/>Containerization]
    end

    React --> TS
    TS --> Vite
    React --> Tailwind
    React --> Shadcn
    React --> ReactQuery
    React --> Dexie
    
    FastAPI --> Python
    FastAPI --> SQLAlchemy
    SQLAlchemy --> Alembic
    FastAPI --> PyJWT
    FastAPI --> Bcrypt
    FastAPI --> Uvicorn
    
    SQLAlchemy --> Postgres
    FastAPI --> RedisDB
    
    Vite --> Vercel
    FastAPI --> Render
    FastAPI --> Docker

    style React fill:#61DAFB,color:#000
    style FastAPI fill:#009688,color:#fff
    style Postgres fill:#336791,color:#fff
    style Vercel fill:#000,color:#fff
```

---

## 6. WebSocket Communication Flow

### Real-Time Message Exchange

```mermaid
sequenceDiagram
    participant C1 as Client 1<br/>(Sender)
    participant WS1 as WebSocket<br/>Connection 1
    participant Server as WebSocket<br/>Server
    participant DB as Database
    participant Relay as Relay<br/>Service
    participant WS2 as WebSocket<br/>Connection 2
    participant C2 as Client 2<br/>(Recipient)

    Note over C1,C2: Connection Establishment
    
    C1->>WS1: Connect(user_id, jwt_token)
    WS1->>Server: Authenticate
    Server->>Server: Verify JWT
    Server-->>WS1: Connection Accepted
    WS1-->>C1: Connected ✓
    
    C2->>WS2: Connect(user_id, jwt_token)
    WS2->>Server: Authenticate
    Server->>Server: Verify JWT
    Server-->>WS2: Connection Accepted
    WS2-->>C2: Connected ✓
    
    Note over C1,C2: Fetch Pending Messages
    
    Server->>Relay: Get Pending(user_id)
    Relay-->>Server: Pending Messages[]
    Server->>WS1: Deliver Pending
    Server->>WS2: Deliver Pending
    
    Note over C1,C2: Real-Time Messaging
    
    C1->>WS1: Send Message
    WS1->>Server: {type: "message", data}
    Server->>DB: Store Message
    Server->>Relay: Queue Message
    
    alt Recipient Online
        Server->>WS2: new_message event
        WS2->>C2: Display Message
        C2->>WS2: delivery_confirmation
        WS2->>Server: Delivered
        Server->>WS1: message_delivered
        WS1->>C1: Update Status ✓✓
    else Recipient Offline
        Server->>Relay: Store for Later
        Note over Relay: Message queued
    end
    
    Note over C1,C2: Typing Indicators
    
    C1->>WS1: typing: true
    WS1->>Server: {type: "typing"}
    Server->>WS2: typing event
    WS2->>C2: Show "typing..."
    
    Note over C1,C2: Read Receipts
    
    C2->>WS2: Mark as Read
    WS2->>Server: {type: "read"}
    Server->>DB: Update is_read
    Server->>WS1: message_read
    WS1->>C1: Update Status ✓✓ (blue)
    
    Note over C1,C2: Disconnection Handling
    
    C2->>WS2: Disconnect
    WS2->>Server: Connection Closed
    Server->>WS1: user_offline
    WS1->>C1: Show Offline Status
```

### WebSocket Event Types

```mermaid
graph TB
    subgraph "Client → Server Events"
        E1[message<br/>Send new message]
        E2[typing<br/>Typing indicator]
        E3[read<br/>Mark as read]
        E4[delivery_confirmation<br/>Message delivered]
        E5[contact_added<br/>New contact]
    end

    subgraph "Server → Client Events"
        E6[new_message<br/>Incoming message]
        E7[message_sent<br/>Confirmation]
        E8[message_delivered<br/>Delivery status]
        E9[message_read<br/>Read status]
        E10[typing<br/>Contact typing]
        E11[user_online<br/>Contact online]
        E12[user_offline<br/>Contact offline]
        E13[contact_added<br/>New contact added]
    end

    subgraph "WebSocket Server"
        Handler[Event Handler<br/>Connection Manager]
    end

    E1 --> Handler
    E2 --> Handler
    E3 --> Handler
    E4 --> Handler
    E5 --> Handler
    
    Handler --> E6
    Handler --> E7
    Handler --> E8
    Handler --> E9
    Handler --> E10
    Handler --> E11
    Handler --> E12
    Handler --> E13

    style Handler fill:#E74C3C,color:#fff
    style E1 fill:#3498DB,color:#fff
    style E6 fill:#27AE60,color:#fff
```

---

## How to Use These Diagrams

### For Mermaid Live Editor (Recommended)
1. Visit: https://mermaid.live/
2. Copy any diagram code block
3. Paste into the editor
4. Export as PNG/SVG/PDF

### For VS Code
1. Install "Markdown Preview Mermaid Support" extension
2. Open this file in VS Code
3. Press `Ctrl+Shift+V` to preview
4. Right-click diagrams to export

### For Documentation
1. Use Mermaid CLI: `npm install -g @mermaid-js/mermaid-cli`
2. Convert to images: `mmdc -i DIAGRAMS.md -o output.pdf`

### For Client Presentation
1. Export each diagram as PNG (high resolution)
2. Create PowerPoint/PDF with diagrams
3. Add explanatory notes for each diagram

---

## Diagram Descriptions for Client

### 1. ER Diagram
Shows the complete database structure with 8 main tables: Users, Contacts, Messages, Groups, Group Members, Group Messages, Media Attachments, and Invitations. All relationships and foreign keys are clearly defined.

### 2. Data Flow Diagram
Illustrates how data moves through the system from user input to storage and delivery. Shows three levels: Context (high-level), Main Processes (detailed), and Message Flow (sequence).

### 3. User Flow Diagram
Complete user journey from opening the app to sending messages, including authentication, contact management, message delivery, and offline handling.

### 4. PQC Architecture
Demonstrates the post-quantum cryptography layer with CRYSTALS-Kyber for key exchange and CRYSTALS-Dilithium for signatures. Shows hybrid mode combining classical and quantum-resistant algorithms.

### 5. System Architecture
High-level view of frontend (React), backend (FastAPI), databases (PostgreSQL, Redis), and external services (Relay, Email).

### 6. WebSocket Communication
Real-time bidirectional communication flow showing connection establishment, message exchange, typing indicators, read receipts, and offline handling.

---

**End of Diagrams Document**
