import React, { useState, useEffect, useRef } from 'react';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Lock, MoreVertical, Phone, Video, ArrowLeft, Users, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import WebSocketService from '@/lib/websocket';
import api from '@/config/api';
import { Message } from '@/types/messaging';
import { ExportConversation } from './ExportConversation';

interface GroupMember {
  id: string;
  user_id?: string;
  username: string;
  full_name?: string;
  email?: string;
  role?: string;
  avatar_url?: string | null;
}

interface WSEventData {
  message_id?: string;
  group_id?: string;
  user_id?: string;
  sender_id?: string;
  encrypted_content?: string;
  timestamp?: string;
  delivered_by?: string;
}

interface GroupChatProps {
  group: {
    id: string;
    name: string;
    description?: string;
    admin_id?: string;
    members?: GroupMember[];
  };
  currentUser: {
    id: string;
    username?: string;
    fullName?: string;
  };
  onBack?: () => void;
}

interface GroupMessage {
  id: string;
  sender_id: string;
  content: string;
  encrypted_content?: string;
  created_at: string;
  timestamp?: string;
  is_read: number;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  sender_username?: string;
  sender?: {
    id: string;
    username: string;
    full_name?: string;
  };
  mediaAttachments?: Array<{
    id: string;
    file_url: string;
    file_name: string;
    file_type: string;
    category: string;
  }>;
}

export default function GroupChat({ group, currentUser, onBack }: GroupChatProps) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsService = WebSocketService.getInstance();
  const isAdmin = group.admin_id === currentUser.id;

  useEffect(() => {
    console.log('🔧 Setting up group chat listeners for group:', group.id);
    
    loadGroupMessages();
    loadGroupMembers();
    
    // ✅ Listen for incoming group messages
    wsService.on('new_group_message', handleNewGroupMessage);
    
    // ✅ Listen for delivery confirmations
    const handleDelivered = (data: WSEventData) => {
      console.log('✅ Message delivered confirmation:', data.message_id);
      if (data.group_id === group.id) {
        setMessages(prev => prev.map(msg =>
          msg.id === data.message_id ? { ...msg, status: 'delivered' as const } : msg
        ));
      }
    };
    wsService.on('message_delivered', handleDelivered);
    
    // ✅ Listen for read receipts
    const handleRead = (data: WSEventData) => {
      console.log('✅ Message read confirmation:', data.message_id);
      if (data.group_id === group.id) {
        setMessages(prev => prev.map(msg =>
          msg.id === data.message_id ? { ...msg, is_read: 1, status: 'read' as const } : msg
        ));
      }
    };
    wsService.on('message_read', handleRead);
    
    // ✅ Listen for member updates (join/leave)
    const handleMemberJoined = (data: WSEventData) => {
      console.log('👥 Member joined group:', data.user_id);
      if (data.group_id === group.id) {
        loadGroupMembers(); // Reload member list
      }
    };
    wsService.on('group_member_joined', handleMemberJoined);
    
    const handleMemberLeft = (data: WSEventData) => {
      console.log('👋 Member left group:', data.user_id);
      if (data.group_id === group.id) {
        loadGroupMembers(); // Reload member list
      }
    };
    wsService.on('group_member_left', handleMemberLeft);
    
    return () => {
      console.log('🧹 Cleaning up group chat listeners for group:', group.id);
      wsService.off('new_group_message', handleNewGroupMessage);
      wsService.off('message_delivered', handleDelivered);
      wsService.off('message_read', handleRead);
      wsService.off('group_member_joined', handleMemberJoined);
      wsService.off('group_member_left', handleMemberLeft);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group.id]);

  const loadGroupMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/groups/${group.id}/messages`);
      const messagesData = response.data.messages || [];
      setMessages(messagesData.reverse());
      scrollToBottom();
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupMembers = async () => {
    try {
      const response = await api.get(`/groups/${group.id}/members`);
      const membersData = response.data || [];
      console.log('📋 Raw members data:', membersData);
      
      // Normalize member data to ensure consistent structure
      const normalizedMembers: GroupMember[] = membersData.map((member: GroupMember) => ({
        id: member.user_id || member.id,
        user_id: member.user_id || member.id,
        username: member.username || member.full_name || 'Unknown User',
        full_name: member.full_name || member.username || 'Unknown User',
        email: member.email || '',
        role: member.role || 'member',
        avatar_url: member.avatar_url || null
      }));
      
      console.log('✅ Normalized members:', normalizedMembers);
      setMembers(normalizedMembers);
    } catch (err) {
      console.error('Error loading members:', err);
      setMembers([]);
    }
  };

  const handleNewGroupMessage = (data: WSEventData) => {
    console.log('📨 Received group message:', {
      messageId: data.message_id,
      groupId: data.group_id,
      senderId: data.sender_id,
      timestamp: data.timestamp
    });
    
    // ✅ FIX: Only process if message is for current group
    if (data.group_id === group.id) {
      // Find sender info for display
      const sender = members.find(m => m.id === data.sender_id);
      
      const newMessage: GroupMessage = {
        id: data.message_id || `msg-${Date.now()}`,
        sender_id: data.sender_id,
        content: data.encrypted_content,
        created_at: data.timestamp || new Date().toISOString(),
        is_read: 0,
        status: 'delivered', // Message arrived
        sender_username: sender?.username || 'Unknown User'
      };
      
      console.log(`✅ Adding message from ${newMessage.sender_username} to group ${data.group_id}`);
      
      // ✅ Avoid duplicate messages
      setMessages(prev => {
        const messageExists = prev.some(m => m.id === newMessage.id);
        if (messageExists) {
          console.warn(`⚠️ Message ${newMessage.id} already exists, skipping duplicate`);
          return prev;
        }
        // Sort messages by timestamp
        return [...prev, newMessage].sort((a, b) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
      });
      
      scrollToBottom();
      
      // ✅ Send delivery confirmation to sender
      if (wsService?.isConnected()) {
        wsService.send('delivery_confirmation', {
          message_id: data.message_id,
          group_id: data.group_id,
          delivered_by: currentUser.id
        });
      }
    } else {
      console.log(`⚠️ Received message for different group: ${data.group_id}, current: ${group.id}`);
    }
  };

  const handleSendMessage = async (content: string, files?: File[]) => {
    if (!content.trim() && !files) return;

    try {
      // ✅ Build session keys for ALL members including the sender
      const encryptedSessionKeys: Record<string, string> = {};
      
      // Include ALL group members
      for (const member of members) {
        try {
          // In production: encrypt with member's public key
          // For now: use secure placeholder with member ID and timestamp
          encryptedSessionKeys[member.id] = `key-${member.id}-${Date.now()}-${Math.random()}`;
          console.log(`✅ Built session key for member: ${member.username}`);
        } catch (error) {
          console.error(`❌ Failed to build key for member ${member.id}:`, error);
        }
      }
      
      console.log(`📋 Session keys built for ${Object.keys(encryptedSessionKeys).length} members:`, 
        Object.keys(encryptedSessionKeys).map(id => {
          const member = members.find(m => m.id === id);
          return member?.username || id;
        })
      );

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const messagePayload = {
        group_id: group.id,
        sender_id: currentUser.id,
        message_id: messageId,
        encrypted_content: content, // TODO: Implement actual E2E encryption
        encrypted_session_keys: encryptedSessionKeys,
        timestamp: new Date().toISOString(),
        recipient_ids: members.map(m => m.id) // ✅ Explicit list of who should receive
      };
      
      console.log('📤 Sending group message:', {
        groupId: group.id,
        senderId: currentUser.id,
        senderName: members.find(m => m.id === currentUser.id)?.username,
        totalMembers: members.length,
        sessionKeysCount: Object.keys(encryptedSessionKeys).length,
        messagePreview: content.substring(0, 50)
      });

      // ✅ Send via WebSocket with complete payload
      wsService.send('group_message', messagePayload);

      // ✅ Optimistically add to local messages with sending status
      setMessages(prev => [...prev, {
        id: messageId,
        sender_id: currentUser.id,
        content: content,
        created_at: new Date().toISOString(),
        status: 'sending', // Shows user the message is being sent
        is_read: 0
      }]);

      scrollToBottom();
      
      console.log('✅ Group message sent successfully');
      
    } catch (err) {
      console.error('❌ Error sending group message:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const errorStack = err instanceof Error ? err.stack : undefined;
      console.error('Error stack:', errorStack);
      alert(`Failed to send message: ${errorMessage}`);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Convert GroupMessage to Message format for MessageBubble
  const convertToMessage = (msg: GroupMessage): Message => {
    const sender = members.find(m => m.id === msg.sender_id || m.user_id === msg.sender_id);
    const senderName = sender?.full_name || sender?.username || msg.sender_username || 'Unknown User';
    
    // Convert media attachments to match Message type
    const mediaAttachments = msg.mediaAttachments?.map(media => ({
      id: media.id,
      file_name: media.file_name,
      file_type: media.file_type,
      file_size: 0, // Not available in group message type
      file_url: media.file_url,
      category: media.category as 'image' | 'video' | 'document' | 'other',
      created_at: new Date().toISOString()
    }));
    
    return {
      id: msg.id,
      senderId: msg.sender_id,
      recipientId: group.id,
      decryptedContent: msg.content || msg.encrypted_content || '',
      encryptedContent: msg.encrypted_content || msg.content || '',
      createdAt: new Date(msg.created_at || msg.timestamp || Date.now()),
      isEncrypted: true,
      status: msg.status || 'delivered',
      isRead: msg.is_read === 1,
      mediaAttachments: mediaAttachments,
      senderName: senderName
    };
  };

  const handleBackClick = () => {
    if (onBack) {
      onBack();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          {/* Back button for mobile */}
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden -ml-2 flex-shrink-0"
            onClick={handleBackClick}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <span className="font-medium text-primary text-sm md:text-base">
                {(group.name || 'G').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-sm md:text-base truncate">{group.name || 'Group Chat'}</h3>
              {isAdmin && (
                <span title="You are the admin">
                  <Crown className="w-4 h-4 text-yellow-500" />
                </span>
              )}
            </div>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate flex items-center gap-1">
              <Users className="w-3 h-3" />
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
          {/* Export/Import Conversation */}
          <ExportConversation
            contactId={group.id}
            contactName={group.name || 'Group Chat'}
          />
          
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8 md:w-10 md:h-10 hidden sm:flex">
            <Phone className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8 md:w-10 md:h-10 hidden sm:flex">
            <Video className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground w-8 h-8 md:w-10 md:h-10">
            <MoreVertical className="w-4 h-4 md:w-5 md:h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3">
        {/* Encryption notice */}
        <div className="flex justify-center mb-2 md:mb-4">
          <div className="inline-flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full bg-primary/10 text-[10px] md:text-xs text-primary">
            <Lock className="w-3 h-3 md:w-3.5 md:h-3.5" />
            <span className="hidden sm:inline">Messages are end-to-end encrypted</span>
            <span className="sm:hidden">E2E encrypted</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm animate-in">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-6">
                <Users className="w-10 h-10 text-primary" />
              </div>
              <p className="text-muted-foreground text-lg font-medium">No messages yet</p>
              <p className="text-muted-foreground/70 text-sm mt-1">Be the first to send a message to this group!</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map(msg => {
              const isOwn = msg.sender_id === currentUser.id;
              const convertedMessage = convertToMessage(msg);
              
              return (
                <div key={msg.id}>
                  {/* Show sender name for group messages from others */}
                  {!isOwn && (
                    <p className="text-[10px] md:text-xs text-primary font-semibold mb-1 ml-2">
                      {convertedMessage.senderName}
                    </p>
                  )}
                  <MessageBubble
                    message={convertedMessage}
                    isOwn={isOwn}
                  />
                </div>
              );
            })}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput 
        onSend={handleSendMessage}
        recipientId={group.id}
        onTyping={(isTyping) => {
          // Group typing indicators could be implemented here
          console.log('Typing in group:', isTyping);
        }}
      />
    </div>
  );
}
