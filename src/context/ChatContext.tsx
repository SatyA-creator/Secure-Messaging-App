import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Contact, Message, Conversation, MessageStatus } from '@/types/messaging';
import { useAuth } from './AuthContext';
import WebSocketService from '@/lib/websocket';
import { ENV } from '@/config/env';

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
      // Fetch real contacts from backend API
      const fetchContacts = async () => {
        try {
          const token = localStorage.getItem('authToken');
          const response = await fetch(`${ENV.API_URL}/contacts/${user.id}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (!response.ok) {
            console.error('Failed to fetch contacts:', response.status);
            // Fallback to empty contacts if API fails
            setContacts([]);
            setConversations({});
            return;
          }

          const contactsData = await response.json();
          console.log('Fetched contacts from API:', contactsData);

          // Transform API contacts to Contact type
          const apiContacts: Contact[] = contactsData.map((c: any) => ({
            id: c.contact_user_id || c.contact_id || c.id,
            username: c.username || c.contact_username || 'Unknown',
            email: c.email || c.contact_email || '',
            fullName: c.full_name || c.contact_full_name || c.username || 'Unknown User',
            publicKey: c.public_key || 'api-key',
            isOnline: c.is_online || false,
            lastSeen: c.last_seen ? new Date(c.last_seen) : new Date(),
            unreadCount: 0,
          }));

          setContacts(apiContacts);

          // Initialize empty conversations for each contact
          const convos: Record<string, Conversation> = {};
          apiContacts.forEach(contact => {
            convos[contact.id] = {
              contactId: contact.id,
              messages: [],
              isLoading: false,
              hasMore: false,
            };
          });
          setConversations(convos);

        } catch (error) {
          console.error('Error fetching contacts:', error);
          // Fallback to empty contacts
          setContacts([]);
          setConversations({});
        }
      };

      fetchContacts();
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
  if (!user) throw new Error('User not authenticated');
  
  try {
    // ✅ Send invitation via API instead of directly adding
    const response = await fetch(`${ENV.API_URL}/invitations/send`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}` 
      },
      body: JSON.stringify({ 
        inviter_email: user.email,  // ✅ Use inviter_email instead of inviter_id
        invitee_email: email 
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to send invitation');
    }

    const result = await response.json();
    console.log('✅ Invitation sent:', result);

    // Don't add to contacts yet - wait for acceptance
    return result;

  } catch (error) {
    console.error('Failed to send invitation:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to send invitation');
  }
}, [user]);


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
