import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Contact, Message, Conversation, MessageStatus } from '@/types/messaging';
import { useAuth } from './AuthContext';
import WebSocketService from '@/lib/websocket';

interface ChatContextType {
  contacts: Contact[];
  conversations: Record<string, Conversation>;
  selectedContactId: string | null;
  selectContact: (contactId: string) => void;
  sendMessage: (recipientId: string, content: string) => Promise<void>;
  markAsRead: (contactId: string) => void;
  addContact: (email: string, displayName?: string) => Promise<void>;
  isConnected: boolean;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Demo contacts
const demoContacts: Contact[] = [
  {
    id: '2',
    username: 'bob',
    email: 'bob@secure.chat',
    fullName: 'Bob Wilson',
    publicKey: 'demo-key-bob',
    isOnline: true,
    lastSeen: new Date(),
    unreadCount: 2,
  },
  {
    id: '3',
    username: 'carol',
    email: 'carol@secure.chat',
    fullName: 'Carol Martinez',
    publicKey: 'demo-key-carol',
    isOnline: false,
    lastSeen: new Date(Date.now() - 3600000),
    unreadCount: 0,
  },
  {
    id: '4',
    username: 'david',
    email: 'david@secure.chat',
    fullName: 'David Kim',
    publicKey: 'demo-key-david',
    isOnline: true,
    lastSeen: new Date(),
    unreadCount: 0,
  },
  {
    id: '5',
    username: 'eva',
    email: 'eva@secure.chat',
    fullName: 'Eva Johnson',
    publicKey: 'demo-key-eva',
    isOnline: false,
    lastSeen: new Date(Date.now() - 7200000),
    unreadCount: 5,
  },
];

const demoMessages: Record<string, Message[]> = {
  '2': [
    {
      id: '1',
      senderId: '2',
      recipientId: '1',
      encryptedContent: 'encrypted:Hey! Did you see the latest security update?',
      decryptedContent: 'Hey! Did you see the latest security update?',
      status: 'read',
      createdAt: new Date(Date.now() - 3600000),
      isEncrypted: true,
    },
    {
      id: '2',
      senderId: '1',
      recipientId: '2',
      encryptedContent: 'encrypted:Yes! The new E2E encryption is amazing.',
      decryptedContent: 'Yes! The new E2E encryption is amazing.',
      status: 'read',
      createdAt: new Date(Date.now() - 3500000),
      isEncrypted: true,
    },
    {
      id: '3',
      senderId: '2',
      recipientId: '1',
      encryptedContent: 'encrypted:AES-256-GCM is such a solid choice for message encryption.',
      decryptedContent: 'AES-256-GCM is such a solid choice for message encryption.',
      status: 'delivered',
      createdAt: new Date(Date.now() - 1800000),
      isEncrypted: true,
    },
    {
      id: '4',
      senderId: '2',
      recipientId: '1',
      encryptedContent: 'encrypted:The server never sees our plaintext messages! 🔒',
      decryptedContent: 'The server never sees our plaintext messages! 🔒',
      status: 'delivered',
      createdAt: new Date(Date.now() - 600000),
      isEncrypted: true,
    },
  ],
  '5': [
    {
      id: '5',
      senderId: '5',
      recipientId: '1',
      encryptedContent: 'encrypted:Check out this new feature!',
      decryptedContent: 'Check out this new feature!',
      status: 'delivered',
      createdAt: new Date(Date.now() - 86400000),
      isEncrypted: true,
    },
  ],
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocketService | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (user) {
      wsRef.current = WebSocketService.getInstance();
      
      // Connect using the user ID
      wsRef.current.connect(user.id)
        .then(() => {
          setIsConnected(true);
          console.log('Connected to WebSocket');
        })
        .catch((error) => {
          console.error('Failed to connect to WebSocket:', error);
          setIsConnected(false);
        });

      // Set up event listeners
      wsRef.current.on('new_message', (data) => {
        // Handle incoming messages
        console.log('New message received:', data);
      });

      wsRef.current.on('contact_added', (data) => {
        // Handle new contacts
        console.log('Contact added:', data);
      });

      return () => {
        if (wsRef.current) {
          wsRef.current.disconnect();
        }
      };
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      // Load demo contacts (excluding current user)
      const filteredContacts = demoContacts.filter(c => c.id !== user.id);
      setContacts(filteredContacts);
      
      // Initialize conversations
      const convos: Record<string, Conversation> = {};
      filteredContacts.forEach(contact => {
        convos[contact.id] = {
          contactId: contact.id,
          messages: demoMessages[contact.id] || [],
          isLoading: false,
          hasMore: false,
        };
      });
      setConversations(convos);
    }
  }, [user]);

  const selectContact = useCallback((contactId: string) => {
    setSelectedContactId(contactId);
  }, []);

  const sendMessage = useCallback(async (recipientId: string, content: string) => {
    if (!user) return;

    const newMessage: Message = {
      id: crypto.randomUUID(),
      senderId: user.id,
      recipientId,
      encryptedContent: `encrypted:${content}`,
      decryptedContent: content,
      status: 'sending',
      createdAt: new Date(),
      isEncrypted: true,
    };

    // Add message optimistically
    setConversations(prev => ({
      ...prev,
      [recipientId]: {
        ...prev[recipientId],
        messages: [...(prev[recipientId]?.messages || []), newMessage],
      },
    }));

    // Simulate sending
    await new Promise(resolve => setTimeout(resolve, 500));

    // Update status to sent
    setConversations(prev => ({
      ...prev,
      [recipientId]: {
        ...prev[recipientId],
        messages: prev[recipientId].messages.map(m =>
          m.id === newMessage.id ? { ...m, status: 'sent' as MessageStatus } : m
        ),
      },
    }));

    // Simulate delivery
    await new Promise(resolve => setTimeout(resolve, 800));

    setConversations(prev => ({
      ...prev,
      [recipientId]: {
        ...prev[recipientId],
        messages: prev[recipientId].messages.map(m =>
          m.id === newMessage.id ? { ...m, status: 'delivered' as MessageStatus } : m
        ),
      },
    }));
  }, [user]);

  const markAsRead = useCallback((contactId: string) => {
    setContacts(prev =>
      prev.map(c => (c.id === contactId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  const addContact = useCallback(async (email: string, displayName?: string) => {
    try {
      // For demo purposes, simulate adding a contact
      const newContact: Contact = {
        id: crypto.randomUUID(),
        username: email.split('@')[0],
        email: email,
        fullName: displayName || email.split('@')[0],
        publicKey: 'demo-key-' + crypto.randomUUID(),
        isOnline: false,
        lastSeen: new Date(),
        unreadCount: 0,
      };

      setContacts(prev => [...prev, newContact]);

      // Initialize empty conversation for new contact
      setConversations(prev => ({
        ...prev,
        [newContact.id]: {
          contactId: newContact.id,
          messages: [],
          isLoading: false,
          hasMore: false,
        },
      }));

      // TODO: Send to backend API
      // const response = await fetch('/api/v1/contacts/add', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, display_name: displayName })
      // });

      if (wsRef.current && wsRef.current.isConnected()) {
        wsRef.current.send('contact_added', { contact: newContact });
      }

    } catch (error) {
      console.error('Failed to add contact:', error);
      throw new Error('Failed to add contact. Please try again.');
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        contacts,
        conversations,
        selectedContactId,
        selectContact,
        sendMessage,
        markAsRead,
        addContact,
        isConnected,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChat must be used within ChatProvider');
  }
  return context;
}
