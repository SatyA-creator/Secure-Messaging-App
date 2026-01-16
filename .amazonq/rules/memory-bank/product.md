# Product Overview

## Project Purpose
A secure, real-time messaging application with end-to-end encryption capabilities. The platform enables users to communicate privately through direct messages and group chats with enterprise-grade security features.

## Value Proposition
- **End-to-End Encryption**: All messages are encrypted using session keys, ensuring privacy and security
- **Real-Time Communication**: WebSocket-based instant messaging with typing indicators and delivery confirmations
- **Multi-User Support**: Direct messaging and group chat functionality with role-based access
- **Contact Management**: Invitation-based contact system with email verification
- **Cross-Platform**: Web-based application accessible from any modern browser

## Key Features

### Authentication & Security
- JWT-based authentication with access and refresh tokens
- Bcrypt password hashing with configurable salt rounds
- Email verification for new accounts
- Rate limiting and account lockout protection
- Secure session management

### Messaging Capabilities
- **Direct Messaging**: One-on-one encrypted conversations
- **Group Chats**: Multi-user group conversations with admin controls
- **Message Persistence**: All messages stored in PostgreSQL database
- **Real-Time Delivery**: WebSocket connections for instant message delivery
- **Typing Indicators**: Live typing status updates
- **Delivery Confirmations**: Message sent/delivered status tracking
- **Media Sharing**: Share images, documents (PDF, DOC, ZIP), and videos up to 50MB
- **File Preview**: Inline preview for images and videos, download for documents

### Contact Management
- Email-based invitation system
- Contact acceptance workflow
- Online/offline status tracking
- User profile information (username, email, full name)

### User Experience
- Modern, responsive UI built with React and Tailwind CSS
- shadcn-ui component library for consistent design
- Real-time updates without page refresh
- Toast notifications for user feedback
- Mobile-responsive design

## Target Users
- Individuals seeking secure private communication
- Small teams requiring encrypted group messaging
- Organizations prioritizing data privacy and security
- Users who value end-to-end encryption in messaging platforms

## Use Cases
- **Private Conversations**: Secure one-on-one messaging for sensitive discussions
- **Team Collaboration**: Group chats for project teams and workgroups
- **Secure Business Communication**: Enterprise messaging with encryption
- **Personal Messaging**: Privacy-focused alternative to mainstream messaging apps
- **Cross-Organization Communication**: Secure messaging between different organizations
