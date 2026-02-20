export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  publicKey: string;
  isOnline: boolean;
  role?: 'admin' | 'user';
}

export interface Contact extends User {
  unreadCount: number;
  lastMessage?: Message;
  isTyping?: boolean;
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
  hasMedia?: boolean;
  mediaAttachments?: MediaAttachment[];
  mediaUrls?: string[];  // Array of media file URLs
}

export interface MediaAttachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  category: 'image' | 'video' | 'document' | 'other';
  thumbnail_url?: string;
  created_at: string;
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
