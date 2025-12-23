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
  refreshContacts: () => Promise<void>;
  isConnected: boolean;
  sendTypingIndicator: (recipientId: string, isTyping: boolean) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [conversations, setConversations] = useState<Record<string, Conversation>>({});
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocketService | null>(null);

  // Fetch contacts from API
  const fetchContactsFromAPI = useCallback(async () => {
    console.log('fetchContactsFromAPI called, user:', user?.id, user?.email);
    
    if (!user) {
      console.warn('Cannot fetch contacts: user is null');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      console.log('Fetching contacts with URL:', `${ENV.API_URL}/contacts/?user_id=${user.id}`);
      
      const response = await fetch(`${ENV.API_URL}/contacts/?user_id=${user.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log('Contacts API response status:', response.status);

      if (!response.ok) {
        console.error('Failed to fetch contacts:', response.status);
        const errorText = await response.text();
        console.error('Error response:', errorText);
        setContacts([]);
        setConversations({});
        return;
      }

      const contactsData = await response.json();
      console.log('Fetched contacts from API:', contactsData);
      console.log('Number of contacts:', contactsData.length);

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

      console.log('Transformed contacts:', apiContacts);
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
      console.log('Contacts state updated successfully');

    } catch (error) {
      console.error('Error fetching contacts:', error);
      setContacts([]);
      setConversations({});
    }
  }, [user]);

  // Refresh contacts (exposed to components)
  const refreshContacts = useCallback(async () => {
    console.log('Refreshing contacts...');
    await fetchContactsFromAPI();
  }, [fetchContactsFromAPI]);

  // ✅ CRITICAL FIX #1: Initialize WebSocket with JWT token
  useEffect(() => {
    if (user) {
      wsRef.current = WebSocketService.getInstance();
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        console.error('❌ No auth token found');
        return;
      }
      
      // ✅ Connect using the user ID and JWT token
      wsRef.current.connect(user.id, token)
        .then(() => {
          setIsConnected(true);
          console.log('✅ Connected to WebSocket with authentication');
        })
        .catch((error) => {
          console.error('❌ Failed to connect to WebSocket:', error);
          setIsConnected(false);
        });

      // ✅ CRITICAL FIX #2: Set up event listeners for incoming messages
      const handleNewMessage = (data: any) => {
        console.log('📨 New message received:', data);
        
        const senderId = data.sender_id || data.senderId;
        const messageId = data.message_id || data.messageId || crypto.randomUUID();
        
        if (senderId) {
          // Add message to conversation
          setConversations(prev => {
            const existingConversation = prev[senderId] || { 
              contactId: senderId, 
              messages: [], 
              isLoading: false, 
              hasMore: false 
            };
            
            return {
              ...prev,
              [senderId]: {
                ...existingConversation,
                messages: [...existingConversation.messages, {
                  id: messageId,
                  senderId: senderId,
                  recipientId: user.id,
                  encryptedContent: data.encrypted_content,
                  decryptedContent: data.encrypted_content, // Will decrypt on display
                  status: 'delivered' as MessageStatus,
                  createdAt: new Date(data.timestamp || Date.now()),
                  isEncrypted: true,
                }],
              },
            };
          });
          
          // Update unread count
          setContacts(prev =>
            prev.map(c => c.id === senderId ? { ...c, unreadCount: (c.unreadCount || 0) + 1 } : c)
          );
          
          // ✅ Send delivery confirmation
          if (wsRef.current?.isConnected()) {
            wsRef.current.send('delivery_confirmation', {
              message_id: messageId,
              sender_id: senderId
            });
          }
        }
      };

      // ✅ CRITICAL FIX #3: Listen for contact_added events
      const handleContactAdded = (data: any) => {
        console.log('👥 New contact added:', data);
        
        const contactId = data.contact_id || data.user_id;
        if (contactId) {
          const newContact: Contact = {
            id: contactId,
            username: data.username || 'Unknown',
            email: data.email || '',
            fullName: data.full_name || data.username || 'Unknown User',
            publicKey: data.public_key || 'api-key',
            isOnline: data.is_online || false,
            lastSeen: new Date(),
            unreadCount: 0,
          };
          
          setContacts(prev => {
            // Avoid duplicates
            if (!prev.find(c => c.id === newContact.id)) {
              return [...prev, newContact];
            }
            return prev;
          });
          
          // Initialize conversation
          setConversations(prev => ({
            ...prev,
            [contactId]: {
              contactId: contactId,
              messages: [],
              isLoading: false,
              hasMore: false,
            },
          }));
        }
      };

      // ✅ Listen for message_sent confirmation
      const handleMessageSent = (data: any) => {
        console.log('✅ Message sent confirmation:', data);
        
        const messageId = data.message_id;
        if (messageId) {
          // Update message status to 'sent'
          setConversations(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(contactId => {
              updated[contactId] = {
                ...updated[contactId],
                messages: updated[contactId].messages.map(m =>
                  m.id === messageId ? { ...m, status: 'sent' as MessageStatus } : m
                ),
              };
            });
            return updated;
          });
        }
      };

      // ✅ Listen for message_delivered confirmation
      const handleMessageDelivered = (data: any) => {
        console.log('✅ Message delivered confirmation:', data);
        
        const messageId = data.message_id;
        if (messageId) {
          // Update message status to 'delivered'
          setConversations(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(contactId => {
              updated[contactId] = {
                ...updated[contactId],
                messages: updated[contactId].messages.map(m =>
                  m.id === messageId ? { ...m, status: 'delivered' as MessageStatus } : m
                ),
              };
            });
            return updated;
          });
        }
      };

      // ✅ Listen for user online/offline status
      const handleUserOnline = (data: any) => {
        const userId = data.user_id;
        if (userId) {
          console.log(`✅ User ${userId} came online`);
          setContacts(prev =>
            prev.map(c => c.id === userId ? { ...c, isOnline: true, lastSeen: new Date() } : c)
          );
        }
      };

      const handleUserOffline = (data: any) => {
        const userId = data.user_id;
        if (userId) {
          console.log(`❌ User ${userId} went offline`);
          setContacts(prev =>
            prev.map(c => c.id === userId ? { ...c, isOnline: false, lastSeen: new Date() } : c)
          );
        }
      };

      // ✅ Listen for typing indicators
      const handleTyping = (data: any) => {
        const senderId = data.sender_id || data.user_id;
        const isTyping = data.is_typing || false;
        if (senderId) {
          console.log(`⌨️ User ${senderId} is ${isTyping ? 'typing' : 'stopped typing'}`);
          setContacts(prev =>
            prev.map(c => c.id === senderId ? { ...c, isTyping } : c)
          );
          
          // Auto-clear typing indicator after 3 seconds
          if (isTyping) {
            setTimeout(() => {
              setContacts(prev =>
                prev.map(c => c.id === senderId ? { ...c, isTyping: false } : c)
              );
            }, 3000);
          }
        }
      };

      // ✅ Listen for message read confirmations
      const handleMessageRead = (data: any) => {
        console.log('✅ Message read confirmation:', data);
        const messageId = data.message_id;
        if (messageId) {
          setConversations(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(contactId => {
              updated[contactId] = {
                ...updated[contactId],
                messages: updated[contactId].messages.map(m =>
                  m.id === messageId ? { ...m, status: 'read' as MessageStatus } : m
                ),
              };
            });
            return updated;
          });
        }
      };

      // Register all event handlers
      wsRef.current.on('new_message', handleNewMessage);
      wsRef.current.on('contact_added', handleContactAdded);
      wsRef.current.on('message_sent', handleMessageSent);
      wsRef.current.on('message_delivered', handleMessageDelivered);
      wsRef.current.on('message_read', handleMessageRead);
      wsRef.current.on('user_online', handleUserOnline);
      wsRef.current.on('user_offline', handleUserOffline);
      wsRef.current.on('typing', handleTyping);

      return () => {
        if (wsRef.current) {
          wsRef.current.off('new_message', handleNewMessage);
          wsRef.current.off('contact_added', handleContactAdded);
          wsRef.current.off('message_sent', handleMessageSent);
          wsRef.current.off('message_delivered', handleMessageDelivered);
          wsRef.current.off('message_read', handleMessageRead);
          wsRef.current.off('user_online', handleUserOnline);
          wsRef.current.off('user_offline', handleUserOffline);
          wsRef.current.off('typing', handleTyping);
          wsRef.current.disconnect();
        }
      };
    }
  }, [user]);

  // Fetch contacts on mount
  useEffect(() => {
    if (user) {
      fetchContactsFromAPI();
    }
  }, [user, fetchContactsFromAPI]);

  const selectContact = useCallback(async (contactId: string) => {
    setSelectedContactId(contactId);
    
    // Fetch conversation history from backend
    if (user) {
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(
          `${ENV.API_URL}/messages/conversation/${contactId}?current_user_id=${user.id}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          const messages = await response.json();
          console.log(`\ud83d\udcdd Loaded ${messages.length} messages for contact ${contactId}`);
          
          // Transform API messages to Message type
          const transformedMessages: Message[] = messages.map((msg: any) => ({
            id: msg.id,
            senderId: msg.sender_id,
            recipientId: msg.recipient_id,
            encryptedContent: msg.encrypted_content,
            decryptedContent: msg.encrypted_content,
            status: msg.is_read === 2 ? 'read' : msg.sender_id === user.id ? 'sent' : 'delivered',
            createdAt: new Date(msg.created_at),
            isEncrypted: true,
          }));
          
          setConversations(prev => ({
            ...prev,
            [contactId]: {
              contactId,
              messages: transformedMessages,
              isLoading: false,
              hasMore: false,
            },
          }));
        }
      } catch (error) {
        console.error('Failed to load conversation:', error);
      }
    }
  }, [user]);

  // ✅ CRITICAL FIX #4: Actually send messages via WebSocket
  const sendMessage = useCallback(async (recipientId: string, content: string) => {
    if (!user) {
      console.error('❌ Cannot send message: User not authenticated');
      return;
    }
    
    if (!wsRef.current?.isConnected()) {
      console.error('❌ Cannot send message: WebSocket not connected');
      throw new Error('WebSocket not connected. Please refresh the page.');
    }

    // Check if recipient is online to set initial status
    const recipient = contacts.find(c => c.id === recipientId);
    const isRecipientOnline = recipient?.isOnline || false;

    const messageId = crypto.randomUUID();
    const newMessage: Message = {
      id: messageId,
      senderId: user.id,
      recipientId,
      encryptedContent: `encrypted:${content}`,
      decryptedContent: content,
      status: isRecipientOnline ? 'sending' : 'sent',
      createdAt: new Date(),
      isEncrypted: true,
    };

    // Add message optimistically to UI
    setConversations(prev => ({
      ...prev,
      [recipientId]: {
        ...prev[recipientId],
        messages: [...(prev[recipientId]?.messages || []), newMessage],
      },
    }));

    try {
      // ✅ ACTUALLY SEND MESSAGE VIA WEBSOCKET
      wsRef.current.send('message', {
        recipient_id: recipientId,
        encrypted_content: newMessage.encryptedContent,
        encrypted_session_key: 'session-key-placeholder', // Replace with actual encryption logic
        message_id: messageId
      });
      
      console.log(`📤 Message sent to ${recipientId}: "${content.substring(0, 50)}..."`);
      
      // Message status will be updated by WebSocket event handlers
      // (message_sent and message_delivered events)

    } catch (error) {
      console.error('❌ Failed to send message:', error);
      
      // Update status to failed
      setConversations(prev => ({
        ...prev,
        [recipientId]: {
          ...prev[recipientId],
          messages: prev[recipientId].messages.map(m =>
            m.id === messageId ? { ...m, status: 'failed' as MessageStatus } : m
          ),
        },
      }));
      
      throw error;
    }
  }, [user]);

  const markAsRead = useCallback((contactId: string) => {
    setContacts(prev =>
      prev.map(c => (c.id === contactId ? { ...c, unreadCount: 0 } : c))
    );
  }, []);

  // ✅ CRITICAL FIX #5: Refresh contacts after adding
  // ✅ Send typing indicator
  const sendTypingIndicator = useCallback((recipientId: string, isTyping: boolean) => {
    if (wsRef.current?.isConnected()) {
      wsRef.current.send('typing', {
        recipient_id: recipientId,
        is_typing: isTyping
      });
    }
  }, []);

  const addContact = useCallback(async (email: string, displayName?: string) => {
    if (!user) throw new Error('User not authenticated');
    
    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('Not authenticated');
      
      // ✅ Send invitation via API
      const response = await fetch(`${ENV.API_URL}/invitations/send`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          inviter_email: user.email,
          invitee_email: email 
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send invitation');
      }

      const result = await response.json();
      console.log('✅ Invitation sent:', result);
      
      // ✅ CRITICAL: Refresh contacts after invitation sent
      setTimeout(() => {
        console.log('🔄 Refreshing contacts list...');
        refreshContacts();
      }, 500);
      
      // ✅ Notify via WebSocket if contact is online
      if (wsRef.current?.isConnected() && result.contact_id) {
        wsRef.current.send('contact_added', {
          contact_id: result.contact_id,
          inviter_id: user.id,
          invitee_email: email
        });
      }

      return result;

    } catch (error) {
      console.error('❌ Failed to send invitation:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to send invitation');
    }
  }, [user, refreshContacts]);

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
        refreshContacts,
        isConnected,
        sendTypingIndicator,
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
