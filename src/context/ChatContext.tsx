import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Contact, Message, Conversation, MessageStatus } from '@/types/messaging';
import { useAuth } from './AuthContext';
import WebSocketService from '@/lib/websocket';
import { ENV } from '@/config/env';
import { MediaService } from '@/lib/mediaService';
import { localStore } from '@/lib/localStore';
import { offlineQueue } from '@/lib/offlineQueue';
import { relayClient } from '@/lib/relayClient';

interface ChatContextType {
  contacts: Contact[];
  conversations: Record<string, Conversation>;
  selectedContactId: string | null;
  selectedGroupId: string | null;
  selectContact: (contactId: string) => void;
  selectGroup: (groupId: string) => void;
  sendMessage: (recipientId: string, content: string, files?: File[]) => Promise<void>;
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
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocketService | null>(null);

  const selectGroup = useCallback((groupId: string) => {
    console.log('ChatContext: Selecting group:', groupId);
    setSelectedGroupId(groupId);
    setSelectedContactId(null);
  }, []);

  // Fetch contacts from API
  const fetchContactsFromAPI = useCallback(async () => {
    console.log('fetchContactsFromAPI called, user:', user?.id, user?.email);
    
    if (!user) {
      console.warn('Cannot fetch contacts: user is null');
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      console.log('Fetching contacts with URL:', `${ENV.API_URL}/contacts?user_id=${user.id}`);
      
      const response = await fetch(`${ENV.API_URL}/contacts?user_id=${user.id}`, {
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
        console.error('Request URL was:', `${ENV.API_URL}/contacts?user_id=${user.id}`);
        console.error('Auth token present:', !!localStorage.getItem('authToken'));
        setContacts([]);
        setConversations({});
        return;
      }

      const contactsData = await response.json();
      console.log('Fetched contacts from API:', contactsData);
      console.log('Number of contacts:', contactsData.length);
      
      // Log each contact's details
      contactsData.forEach((c: any, index: number) => {
        console.log(`Contact ${index + 1}:`, {
          id: c.id,
          contact_id: c.contact_id,
          contact_user_id: c.contact_user_id,
          contact_username: c.contact_username,
          contact_email: c.contact_email,
        });
      });

      // Transform API contacts to Contact type
      const apiContacts: Contact[] = contactsData.map((c: any) => ({
        id: c.contact_id,
        username: c.contact_username || 'Unknown',
        email: c.contact_email || '',
        fullName: c.contact_full_name || c.contact_username || 'Unknown User',
        publicKey: c.contact_public_key || 'api-key',
        isOnline: c.is_online || false,
        lastSeen: c.contact_last_seen ? new Date(c.contact_last_seen) : new Date(),
        unreadCount: 0,
      }));
      
      console.log('Transformed contacts:');
      apiContacts.forEach((contact, index) => {
        console.log(`  Contact ${index + 1}: ID=${contact.id}, username=${contact.username}, email=${contact.email}`);
      });
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
      
      console.log('🔐 Connecting WebSocket with user:', user.id);
      console.log('   User email:', user.email);
      console.log('   Token length:', token.length);
      
      // ✅ Connect using the user ID and JWT token
      wsRef.current.connect(user.id, token)
        .then(() => {
          setIsConnected(true);
          console.log('✅ Connected to WebSocket with authentication');
          
          // 🆕 Process offline queue on reconnect using relay service
          offlineQueue.processQueue(async (message) => {
            try {
              // Use relay service for offline message sync
              await relayClient.sendMessage(
                message.to,
                `encrypted:${message.content}`,
                'session-key-placeholder',
                {
                  cryptoVersion: 'v1',
                  encryptionAlgorithm: 'ECDH-AES256-GCM',
                  kdfAlgorithm: 'HKDF-SHA256',
                }
              );
              return true; // Success
            } catch (error) {
              console.error('Failed to sync message:', error);
              return false; // Failure
            }
          });
        })
        .catch((error) => {
          console.error('❌ Failed to connect to WebSocket:', error);
          setIsConnected(false);
        });

      // ✅ CRITICAL FIX #2: Set up event listeners for incoming messages
      const handleNewMessage = async (data: any) => {
        console.log('📨 New message received:', data);
        
        const senderId = data.sender_id || data.senderId;
        const messageId = data.message_id || data.messageId || crypto.randomUUID();
        const serverTimestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        
        if (senderId) {
          // ✅ SAVE TO LOCAL STORAGE FIRST
          const encryptedContent = data.encrypted_content || '';
          const decryptedContent = typeof encryptedContent === 'string' && encryptedContent.startsWith('encrypted:')
            ? encryptedContent.substring(10)
            : encryptedContent;
          
          try {
            // ⚠️ SECURITY: Logging message IDs only, never content
            console.log(`💾 Saving received message ${messageId} to local storage`);
            
            await localStore.saveMessage({
              id: messageId,
              conversationId: senderId, // Conversation is identified by the other person (sender)
              from: senderId,
              to: user.id,
              timestamp: serverTimestamp.toISOString(),
              content: decryptedContent,
              signature: undefined,
              synced: true,
              hasMedia: data.has_media || false,
              mediaAttachments: data.media_attachments || [],
              mediaUrls: data.media_attachments?.map((m: any) => m.file_url) || [],
            });
            console.log(`✅ Successfully saved received message ${messageId} to IndexedDB`);
          } catch (error) {
            console.error('❌ Failed to save received message to local storage:', error);
            console.error('   Error details:', error instanceof Error ? error.message : String(error));
          }
          
          // Add message to conversation - avoid duplicates
          setConversations(prev => {
            const existingConversation = prev[senderId] || { 
              contactId: senderId, 
              messages: [], 
              isLoading: false, 
              hasMore: false 
            };
            
            // Check if message already exists
            const messageExists = existingConversation.messages.some(m => m.id === messageId);
            if (messageExists) {
              return prev;
            }
            
            return {
              ...prev,
              [senderId]: {
                ...existingConversation,
                messages: [...existingConversation.messages, {
                  id: messageId,
                  senderId: senderId,
                  recipientId: user.id,
                  encryptedContent: encryptedContent,
                  decryptedContent: decryptedContent,
                  status: 'delivered' as MessageStatus,
                  createdAt: serverTimestamp,  // Use server timestamp for consistency
                  isEncrypted: true,
                  hasMedia: data.has_media || false,
                  mediaAttachments: data.media_attachments || [],
                  mediaUrls: data.media_attachments?.map((m: any) => m.file_url) || [],
                }].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()), // Sort by timestamp
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
        console.log('👥 New contact added:', {
          contact_id: data.contact_id || data.user_id,
          username: data.username,
          email: data.email
        });
        
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
      const handleMessageSent = async (data: any) => {
        // ⚠️ SECURITY: Sanitized log - hiding message content
        console.log('✅ Message sent confirmation:', {
          message_id: data.message_id,
          status: data.status,
          timestamp: data.timestamp,
          has_media: data.has_media
          // content hidden for security
        });
        const messageId = data.message_id;
        const serverTimestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        
        if (messageId) {
          // Find which contact this message belongs to
          let targetContactId: string | null = null;
          
          setConversations(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(contactId => {
              const messageIndex = updated[contactId].messages.findIndex(m => m.id === messageId);
              if (messageIndex >= 0) {
                targetContactId = contactId;
              }
            });
            return updated;
          });
          
          // Refetch conversation to get media attachments
          if (targetContactId && user?.id) {
            console.log('🔄 Refetching conversation to get media attachments');
            try {
              const response = await fetch(
                `${ENV.API_URL}/messages/conversation/${targetContactId}?current_user_id=${user.id}`,
                {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                  },
                }
              );
              
              if (response.ok) {
                const messages: any[] = await response.json();
                console.log(`📥 Refetched ${messages.length} messages with media`);
                
                setConversations(prev => ({
                  ...prev,
                  [targetContactId]: {
                    ...prev[targetContactId],
                    messages: messages.map((msg: any) => ({
                      id: msg.id,
                      senderId: msg.sender_id,
                      recipientId: msg.recipient_id,
                      encryptedContent: msg.encrypted_content,
                      decryptedContent: msg.encrypted_content?.replace('encrypted:', '') || '',
                      createdAt: new Date(msg.created_at),
                      isRead: msg.is_read,
                      isEncrypted: msg.encrypted_content?.startsWith('encrypted:') || false,
                      status: 'sent' as MessageStatus,
                      mediaAttachments: msg.media_attachments || [],
                      mediaUrls: msg.media_attachments?.map((m: any) => m.file_url) || [],
                    })),
                    isLoading: false,
                  },
                }));
              }
            } catch (error) {
              console.error('❌ Failed to refetch conversation:', error);
            }
          }
          
          // Update message status to 'sent' and use server timestamp + media
          setConversations(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(contactId => {
              const messageIndex = updated[contactId].messages.findIndex(m => m.id === messageId);
              if (messageIndex >= 0) {
                updated[contactId] = {
                  ...updated[contactId],
                  messages: updated[contactId].messages.map((m, idx) =>
                    m.id === messageId ? { 
                      ...m, 
                      status: 'sent' as MessageStatus,
                      createdAt: serverTimestamp,  // Use server timestamp for consistency
                      hasMedia: data.has_media || m.hasMedia,
                      mediaAttachments: data.media_attachments || m.mediaAttachments || [],
                      mediaUrls: data.media_attachments?.map((media: any) => media.file_url) || m.mediaUrls || [],
                    } : m
                  ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()), // Sort after update
                };
              }
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
                  m.id === messageId ? { 
                    ...m, 
                    status: 'read' as MessageStatus  // Update to 'read' status, don't change timestamp
                  } : m
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

  // Define selectContact before it's used in useEffect
  const selectContact = useCallback(async (contactId: string) => {
    setSelectedContactId(contactId);
    setSelectedGroupId(null);
    
    // 🆕 PRIVACY-FIRST: Load messages ONLY from local IndexedDB (no server database)
    console.log(`📂 Loading conversation from local storage`);
    
    try {
      const localMessages = await localStore.getConversation(contactId);
      console.log(`💾 Loaded ${localMessages.length} messages`);
      
      const transformedMessages: Message[] = localMessages.map(msg => ({
        id: msg.id,
        senderId: msg.from,
        recipientId: msg.to,
        encryptedContent: msg.content.startsWith('encrypted:') ? msg.content : `encrypted:${msg.content}`,
        decryptedContent: msg.content.startsWith('encrypted:') ? msg.content.substring(10) : msg.content,
        status: msg.synced ? 'sent' : 'sending',
        createdAt: new Date(msg.timestamp),
        isEncrypted: true,
        hasMedia: msg.hasMedia || false,
        mediaAttachments: msg.mediaAttachments || [],
        mediaUrls: msg.mediaUrls || [],
      })).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      setConversations(prev => ({
        ...prev,
        [contactId]: {
          contactId,
          messages: transformedMessages,
          isLoading: false,
          hasMore: false,
        },
      }));
      
      console.log(`✅ Conversation loaded: ${transformedMessages.length} messages displayed`);
    } catch (error) {
      console.error('❌ Failed to load from local storage:', error);
      console.error('   Error details:', error instanceof Error ? error.message : String(error));
      
      // Initialize empty conversation on error
      setConversations(prev => ({
        ...prev,
        [contactId]: {
          contactId,
          messages: [],
          isLoading: false,
          hasMore: false,
        },
      }));
    }
  }, [user]);

  // Fetch contacts on mount
  useEffect(() => {
    if (user) {
      fetchContactsFromAPI();
    }
  }, [user, fetchContactsFromAPI]);

  // Auto-select contact from invitation acceptance
  useEffect(() => {
    const autoSelectContactId = sessionStorage.getItem('autoSelectContact');
    if (autoSelectContactId && contacts.length > 0 && contacts.some(c => c.id === autoSelectContactId)) {
      console.log('Auto-selecting contact from invitation:', autoSelectContactId);
      sessionStorage.removeItem('autoSelectContact');
      selectContact(autoSelectContactId);
    }
  }, [contacts, selectContact]);

  // ✅ CRITICAL FIX #4: Actually send messages via WebSocket
  const sendMessage = useCallback(async (recipientId: string, content: string, files?: File[]) => {
    if (!user) {
      console.error('❌ Cannot send message: User not authenticated');
      return;
    }
    
    // ⚠️ SECURITY: Never log message content
    console.log('📤 Sending message to:', recipientId);

    const messageId = crypto.randomUUID();
    const tempTimestamp = new Date();
    const newMessage: Message = {
      id: messageId,
      senderId: user.id,
      recipientId,
      encryptedContent: `encrypted:${content}`,
      decryptedContent: content,
      status: 'sending' as MessageStatus,
      createdAt: tempTimestamp,
      isEncrypted: true,
      hasMedia: (files && files.length > 0) || false,
      mediaAttachments: [],
      mediaUrls: [],
    };

    // 🆕 SAVE TO LOCAL STORAGE FIRST (always succeeds, even offline)
    try {
      await localStore.saveMessage({
        id: messageId,
        conversationId: recipientId,
        from: user.id,
        to: recipientId,
        timestamp: tempTimestamp.toISOString(),
        content: content,
        signature: undefined,
        synced: false, // Not synced to server yet
        hasMedia: (files && files.length > 0) || false,
        mediaAttachments: [],
        mediaUrls: [],
      });
      console.log('💾 Message saved to local storage');
    } catch (error) {
      console.error('Failed to save to local storage:', error);
    }

    // Add message optimistically to UI
    setConversations(prev => ({
      ...prev,
      [recipientId]: {
        ...prev[recipientId],
        messages: [...(prev[recipientId]?.messages || []), newMessage],
      },
    }));

    // 🆕 If offline, queue for later
    if (!wsRef.current?.isConnected()) {
      console.warn('⚠️ WebSocket offline - message queued for retry');
      return; // offlineQueue will retry later
    }

    try {
      // Upload files first if any
      let mediaIds: string[] = [];
      let mediaAttachments: any[] = [];
      let mediaUrls: string[] = [];
      
      if (files && files.length > 0) {
        console.log(`📎 Uploading ${files.length} file(s)...`);
        const uploadResults = await MediaService.uploadMultiple(files, messageId);
        mediaIds = uploadResults.map(r => r.id);
        mediaAttachments = uploadResults;
        mediaUrls = uploadResults.map(r => r.file_url);
        console.log(`✅ Uploaded ${mediaIds.length} file(s)`);
        console.log(`   Media URLs:`, mediaUrls);
        
        // Update local storage with media information
        await localStore.saveMessage({
          id: messageId,
          conversationId: recipientId,
          from: user.id,
          to: recipientId,
          timestamp: tempTimestamp.toISOString(),
          content: content,
          signature: undefined,
          synced: false,
          hasMedia: true,
          mediaAttachments: mediaAttachments,
          mediaUrls: mediaUrls,
        });
        console.log('💾 Updated message in local storage with media info');
        
        // Update UI with media information
        setConversations(prev => ({
          ...prev,
          [recipientId]: {
            ...prev[recipientId],
            messages: prev[recipientId].messages.map(m =>
              m.id === messageId ? { 
                ...m, 
                hasMedia: true,
                mediaAttachments: mediaAttachments,
                mediaUrls: mediaUrls 
              } : m
            ),
          },
        }));
      }

      // ✅ SEND MESSAGE VIA RELAY SERVICE (Phase 3)
      console.log('📨 Sending message via relay service...');
      const relayResponse = await relayClient.sendMessage(
        recipientId,
        newMessage.encryptedContent,
        'session-key-placeholder', // Will be real ECDH key in Phase 2
        {
          cryptoVersion: 'v1',
          encryptionAlgorithm: 'ECDH-AES256-GCM',
          kdfAlgorithm: 'HKDF-SHA256',
        },
        {
          hasMedia: mediaAttachments.length > 0,
          mediaAttachments: mediaAttachments
        }
      );
      
      console.log(`📤 Message sent via relay: ${relayResponse.status} (expires: ${relayResponse.expires_at})`);
      console.log(`   Message ID: ${messageId}`);
      console.log(`   Recipient: ${recipientId}`);
      
      // 🆕 Mark as synced in local storage
      await localStore.markAsSynced(messageId);

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
  }, [user, contacts]);

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
        selectedGroupId,
        selectContact,
        selectGroup,
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
