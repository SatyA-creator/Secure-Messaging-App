export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  publicKey: string;
  isOnline: boolean;
  lastSeen: Date;
  role?: 'admin' | 'user';
}

export interface Contact extends User {
  unreadCount: number;
  lastMessage?: Message;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId: string;
  encryptedContent: string;
  decryptedContent?: string;
  status: MessageStatus;
  createdAt: Date;
  isEncrypted: boolean;
}

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface Conversation {
  contactId: string;
  messages: Message[];
  isLoading: boolean;
  hasMore: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  privateKey?: string;
}
