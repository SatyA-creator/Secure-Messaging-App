import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { Contact, Message, Conversation, MessageStatus } from '@/types/messaging';
import { useAuth } from './AuthContext';
import WebSocketService from '@/lib/websocket';
import { ENV } from '@/config/env';
import { MediaService } from '@/lib/mediaService';
import { localStore } from '@/lib/localStore';
import { offlineQueue } from '@/lib/offlineQueue';
import { relayClient } from '@/lib/relayClient';
import { cryptoService } from '@/lib/cryptoService';

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
      console.log(`Fetched ${contactsData.length} contacts from API`);

      // Transform API contacts to Contact type
      const apiContacts: Contact[] = contactsData.map((c: any) => ({
        id: c.contact_id,
        username: c.contact_username || 'Unknown',
        email: c.contact_email || '',
        fullName: c.contact_full_name || c.contact_username || 'Unknown User',
        publicKey: c.contact_public_key || '',
        isOnline: c.is_online || false,
        lastSeen: c.contact_last_seen ? new Date(c.contact_last_seen) : null,
        unreadCount: 0,
      }));
      
      setContacts(apiContacts);

      // Initialize conversations for each contact, preserving existing messages
      setConversations(prev => {
        const updated: Record<string, Conversation> = {};
        apiContacts.forEach(contact => {
          updated[contact.id] = {
            contactId: contact.id,
            messages: prev[contact.id]?.messages || [],
            isLoading: false,
            hasMore: false,
          };
        });
        return updated;
      });
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
      
      console.log('Connecting WebSocket for user:', user.id);
      
      // ✅ Connect using the user ID and JWT token
      wsRef.current.connect(user.id, token)
        .then(() => {
          setIsConnected(true);
          console.log('✅ Connected to WebSocket with authentication');
          
          // Process offline queue on reconnect using relay service with real encryption
          offlineQueue.processQueue(async (message) => {
            try {
              // Find recipient's public key from contacts
              const recipient = contacts.find(c => c.id === message.to);
              let encryptedContent: string;
              let sessionKey: string;

              if (recipient?.publicKey && !recipient.publicKey.startsWith('api-') && recipient.publicKey !== 'api-key') {
                // Encrypt with real ECDH + AES-256-GCM
                encryptedContent = await cryptoService.encryptMessage(message.content, recipient.publicKey);
                sessionKey = 'ecdh-pfs';
              } else {
                // Fallback: recipient has no real public key yet
                encryptedContent = message.content;
                sessionKey = 'pending-key-exchange';
              }

              await relayClient.sendMessage(
                message.to,
                encryptedContent,
                sessionKey,
                {
                  cryptoVersion: 'v1',
                  encryptionAlgorithm: 'ECDH-AES256-GCM',
                  kdfAlgorithm: 'HKDF-SHA256',
                }
              );
              return true;
            } catch (error) {
              console.error('Failed to sync message:', error);
              return false;
            }
          });
        })
        .catch((error) => {
          console.error('❌ Failed to connect to WebSocket:', error);
          setIsConnected(false);
        });

      // Set up event listeners for incoming messages
      const handleNewMessage = async (data: any) => {
        // SECURITY: Only log message ID and sender, never content
        const senderId = data.sender_id || data.senderId;
        const messageId = data.message_id || data.messageId || crypto.randomUUID();
        const serverTimestamp = data.timestamp ? new Date(data.timestamp) : new Date();
        console.log(`Received message ${messageId} from ${senderId}`);

        if (senderId) {
          const encryptedContent = data.encrypted_content || '';

          // Decrypt the message content
          let decryptedContent: string;
          try {
            if (cryptoService.isEncryptedEnvelope(encryptedContent)) {
              // Real ECDH + AES-256-GCM encrypted message
              console.log(`🔓 Attempting to decrypt message ${messageId}`);
              decryptedContent = await cryptoService.decryptMessage(encryptedContent);
              console.log(`✅ Successfully decrypted message ${messageId}`);
            } else if (typeof encryptedContent === 'string' && encryptedContent.startsWith('encrypted:')) {
              // Legacy format: strip prefix (backward compat for old messages)
              decryptedContent = encryptedContent.substring(10);
            } else {
              decryptedContent = encryptedContent;
            }
          } catch (decryptError: any) {
            console.error(`❌ Failed to decrypt message ${messageId}:`, {
              error: decryptError.message,
              errorName: decryptError.name,
              sender: senderId
            });
            
            // Check if it's a key mismatch
            if (decryptError.name === 'OperationError' || decryptError.message?.includes('operation failed')) {
              console.error('💡 KEY MISMATCH: The sender encrypted this message with a public key that does not match your current private key.');
              console.error('💡 This happens when you log in from different devices or browsers.');
              console.error('💡 Solution: Ask the sender to refresh their contacts list and resend the message.');
            }
            
            decryptedContent = '[Unable to decrypt message]';
          }

          try {
            await localStore.saveMessage({
              id: messageId,
              conversationId: senderId,
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
          } catch (error) {
            console.error(`Failed to save received message ${messageId}:`, error);
          }

          // Add message to conversation - avoid duplicates
          setConversations(prev => {
            const existingConversation = prev[senderId] || {
              contactId: senderId,
              messages: [],
              isLoading: false,
              hasMore: false
            };

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
                  createdAt: serverTimestamp,
                  isEncrypted: true,
                  hasMedia: data.has_media || false,
                  mediaAttachments: data.media_attachments || [],
                  mediaUrls: data.media_attachments?.map((m: any) => m.file_url) || [],
                }].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
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

      // Listen for contact_added events
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
            publicKey: data.public_key || '',
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
          // Update message status to 'sent' and sync server timestamp
          setConversations(prev => {
            const updated = { ...prev };
            Object.keys(updated).forEach(contactId => {
              const messageIndex = updated[contactId].messages.findIndex(m => m.id === messageId);
              if (messageIndex >= 0) {
                updated[contactId] = {
                  ...updated[contactId],
                  messages: updated[contactId].messages.map(m =>
                    m.id === messageId ? {
                      ...m,
                      status: 'sent' as MessageStatus,
                      createdAt: serverTimestamp,
                      hasMedia: data.has_media || m.hasMedia,
                      mediaAttachments: data.media_attachments || m.mediaAttachments || [],
                      mediaUrls: data.media_attachments?.map((media: any) => media.file_url) || m.mediaUrls || [],
                    } : m
                  ).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
                };
              }
            });
            return updated;
          });
        }
      };

      // Listen for message_delivered confirmation
      const handleMessageDelivered = (data: any) => {
        
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
          // ✅ FIX: Use the server's timestamp for accurate last seen time
          const lastSeenTime = data.timestamp ? new Date(data.timestamp) : new Date();
          console.log(`❌ User ${userId} went offline at ${lastSeenTime.toISOString()}`);
          setContacts(prev =>
            prev.map(c => c.id === userId ? { ...c, isOnline: false, lastSeen: lastSeenTime } : c)
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

      // Listen for message read confirmations
      const handleMessageRead = (data: any) => {
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

    if (!contactId) return;

    // Load messages from local IndexedDB
    try {
      const localMessages = await localStore.getConversation(contactId);
      console.log(`Loaded ${localMessages.length} messages from IndexedDB`);

      // ✅ FIX: Also fetch server message history and merge so messages survive browser storage clears
      try {
        const token = localStorage.getItem('authToken');
        const response = await fetch(
          `${ENV.API_URL}/messages/conversation/${contactId}?current_user_id=${user?.id}`,
          { headers: { 'Authorization': `Bearer ${token}` } }
        );
        if (response.ok) {
          const serverMessages: any[] = await response.json();
          const localIds = new Set(localMessages.map(m => m.id));
          const newFromServer = serverMessages.filter(m => !localIds.has(String(m.id)));
          if (newFromServer.length > 0) {
            console.log(`Recovering ${newFromServer.length} messages from server history`);
            for (const sm of newFromServer) {
              await localStore.saveMessage({
                id: String(sm.id),
                conversationId: contactId,
                from: String(sm.sender_id),
                to: String(sm.recipient_id),
                timestamp: sm.created_at,
                content: sm.encrypted_content,
                synced: true,
                hasMedia: sm.has_media || false,
                mediaAttachments: sm.media_attachments || [],
                mediaUrls: sm.media_attachments?.map((m: any) => m.file_url) || [],
              });
            }
            // Reload from IndexedDB after merging server messages
            const merged = await localStore.getConversation(contactId);
            console.log(`Total after merge: ${merged.length} messages`);
            localMessages.length = 0;
            merged.forEach(m => localMessages.push(m));
          }
        }
      } catch (serverErr) {
        console.warn('Could not load server message history (using local only):', serverErr);
      }

      // Decrypt any messages that are still stored as encrypted envelopes
      const transformedMessages: Message[] = await Promise.all(localMessages.map(async (msg) => {
        let displayContent = msg.content;

        // If content is still an encrypted envelope, try to decrypt it
        if (cryptoService.isEncryptedEnvelope(msg.content)) {
          try {
            displayContent = await cryptoService.decryptMessage(msg.content);
            // Save decrypted content back to IndexedDB for future loads
            await localStore.saveMessage({ ...msg, content: displayContent });
          } catch {
            displayContent = '[Unable to decrypt message]';
          }
        }

        return {
          id: msg.id,
          senderId: msg.from,
          recipientId: msg.to,
          encryptedContent: '[encrypted]',
          decryptedContent: displayContent,
          status: msg.synced ? 'sent' : 'sending',
          createdAt: new Date(msg.timestamp),
          isEncrypted: true,
          hasMedia: msg.hasMedia || false,
          mediaAttachments: msg.mediaAttachments || [],
          mediaUrls: msg.mediaUrls || [],
        } as Message;
      }));

      transformedMessages.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

      setConversations(prev => ({
        ...prev,
        [contactId]: {
          contactId,
          messages: transformedMessages,
          isLoading: false,
          hasMore: false,
        },
      }));
    } catch (error) {
      console.error('Failed to load conversation:', error);

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

  // Send messages with real ECDH + AES-256-GCM encryption
  const sendMessage = useCallback(async (recipientId: string, content: string, files?: File[]) => {
    if (!user) {
      console.error('Cannot send message: User not authenticated');
      return;
    }

    // SECURITY: Never log message content
    console.log('Sending encrypted message to:', recipientId);

    const messageId = crypto.randomUUID();
    const tempTimestamp = new Date();

    // Find recipient's public key for encryption
    let recipient = contacts.find(c => c.id === recipientId);
    
    // 🔐 CRITICAL FIX: Fetch fresh public key from server before encrypting
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`${ENV.API_URL}/users/${recipientId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        const userData = await response.json();
        const freshPublicKey = userData.public_key;
        
        if (freshPublicKey && freshPublicKey !== recipient?.publicKey) {
          console.log('🔄 Updated recipient public key with fresh value from server');
          
          // Update the contact in state with fresh public key
          setContacts(prev => prev.map(c => 
            c.id === recipientId ? { ...c, publicKey: freshPublicKey } : c
          ));
          
          // Use the fresh public key
          recipient = { ...recipient, publicKey: freshPublicKey } as Contact;
        }
      } else {
        console.warn('Could not fetch fresh public key, using cached value');
      }
    } catch (error) {
      console.warn('Error fetching fresh public key:', error);
    }
    
    const recipientPublicKey = recipient?.publicKey;
    const hasRealKey = recipientPublicKey && !recipientPublicKey.startsWith('api-') && recipientPublicKey !== 'api-key' && recipientPublicKey !== '';

    // Encrypt the message content
    let encryptedContent: string;
    let sessionKey: string;
    try {
      if (hasRealKey) {
        // Real ECDH + AES-256-GCM encryption with PFS
        console.log('🔐 Encrypting message with recipient public key');
        encryptedContent = await cryptoService.encryptMessage(content, recipientPublicKey);
        sessionKey = 'ecdh-pfs';
        console.log('✅ Message encrypted successfully');
      } else {
        // Recipient hasn't uploaded a real public key yet - warn but still send
        console.warn('⚠️ Recipient has no ECDH public key, message will not be end-to-end encrypted');
        encryptedContent = content;
        sessionKey = 'pending-key-exchange';
      }
    } catch (encryptError) {
      console.error('❌ Encryption failed:', encryptError);
      throw new Error('Failed to encrypt message');
    }

    const newMessage: Message = {
      id: messageId,
      senderId: user.id,
      recipientId,
      encryptedContent: '[encrypted]',
      decryptedContent: content,
      status: 'sending' as MessageStatus,
      createdAt: tempTimestamp,
      isEncrypted: hasRealKey || false,
      hasMedia: (files && files.length > 0) || false,
      mediaAttachments: [],
      mediaUrls: [],
    };

    // Save plaintext to local storage (local device only, encrypted at rest by OS)
    try {
      await localStore.saveMessage({
        id: messageId,
        conversationId: recipientId,
        from: user.id,
        to: recipientId,
        timestamp: tempTimestamp.toISOString(),
        content: content,
        signature: undefined,
        synced: false,
        hasMedia: (files && files.length > 0) || false,
        mediaAttachments: [],
        mediaUrls: [],
      });
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

    // If offline, queue for later
    if (!wsRef.current?.isConnected()) {
      console.warn('WebSocket offline - message queued for retry');
      return;
    }

    try {
      // Upload files first if any
      let mediaAttachments: any[] = [];
      let mediaUrls: string[] = [];

      if (files && files.length > 0) {
        console.log(`Uploading ${files.length} file(s)...`);
        const uploadResults = await MediaService.uploadMultiple(files, messageId);
        mediaAttachments = uploadResults;
        mediaUrls = uploadResults.map(r => r.file_url);

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

      // Send encrypted message via relay service
      const relayResponse = await relayClient.sendMessage(
        recipientId,
        encryptedContent,
        sessionKey,
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

      console.log(`Message ${messageId} sent via relay: ${relayResponse.status}`);

      // Mark as synced in local storage
      await localStore.markAsSynced(messageId);

    } catch (error) {
      console.error('Failed to send message:', error);

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
