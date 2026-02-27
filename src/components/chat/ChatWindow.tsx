import React, { useRef, useEffect, useState } from 'react';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Lock, Shield, MoreVertical, Phone, Video, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import GroupChat from './GroupChat';
import api from '@/config/api';
import { ExportConversation } from './ExportConversation';

interface ChatWindowProps {
  onBack?: () => void;
}

export function ChatWindow({ onBack }: ChatWindowProps) {
  const { user } = useAuth();
  const { contacts, conversations, selectedContactId, selectedGroupId, sendMessage, sendTypingIndicator, selectContact } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);
  const [selectedGroup, setSelectedGroup] = useState<any>(null);

  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const conversation = selectedContactId ? conversations[selectedContactId] : null;

  // ✅ Add debug helper for media downloads
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).debugMediaDownload = (messageId?: string) => {
        console.log('🔍 Media Download Debugger');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        
        if (messageId) {
          const msg = conversation?.messages.find(m => m.id === messageId);
          if (msg && msg.mediaAttachments) {
            console.log('📨 Message:', messageId);
            console.log('📎 Attachments:', msg.mediaAttachments);
            msg.mediaAttachments.forEach((media, idx) => {
              console.log(`  [${idx}] ${media.file_name}`);
              console.log(`      URL: ${media.file_url}`);
              console.log(`      Type: ${media.file_type}`);
              console.log(`      Category: ${media.category}`);
            });
          } else {
            console.log('❌ Message not found or has no media');
          }
        } else {
          console.log('📊 All messages with media:');
          conversation?.messages.forEach((msg, idx) => {
            if (msg.mediaAttachments && msg.mediaAttachments.length > 0) {
              console.log(`  Message ${idx + 1} (${msg.id}):`);
              msg.mediaAttachments.forEach(media => {
                console.log(`    - ${media.file_name} (${media.file_url})`);
              });
            }
          });
        }
        
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('💡 Usage: window.debugMediaDownload("message-id")');
      };
      console.log('💡 Debug helper available: window.debugMediaDownload()');
    }
  }, [conversation]);

  // Load group details when a group is selected
  useEffect(() => {
    if (selectedGroupId) {
      console.log('Loading group details for:', selectedGroupId);
      loadGroupDetails(selectedGroupId);
    } else {
      setSelectedGroup(null);
    }
  }, [selectedGroupId]);

  const loadGroupDetails = async (groupId: string) => {
    try {
      console.log('Fetching group details for:', groupId);
      // Fetch both group info and members
      const [groupResponse, membersResponse] = await Promise.all([
        api.get(`/groups/${groupId}`),
        api.get(`/groups/${groupId}/members`)
      ]);
      
      console.log('Group details:', groupResponse.data);
      console.log('Group members:', membersResponse.data);
      
      setSelectedGroup({
        id: groupId,
        name: groupResponse.data.name || 'Group Chat',
        description: groupResponse.data.description,
        admin_id: groupResponse.data.admin_id,
        members: membersResponse.data
      });
    } catch (err) {
      console.error('Error loading group details:', err);
    }
  };

  // Import WebSocketService
  useEffect(() => {
    import('@/lib/websocket').then(module => {
      wsRef.current = module.default.getInstance();
    });
  }, []);

  const handleBackClick = () => {
    // Clear selection to go back to contact list on mobile
    selectContact('');
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  const handleSendMessage = async (content: string, files?: File[]) => {
    if (selectedContactId) {
      await sendMessage(selectedContactId, content, files);
    }
  };

  // Render GroupChat if a group is selected
  if (selectedGroupId) {
    if (!selectedGroup) {
      return (
        <div className="flex-1 flex items-center justify-center bg-background">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
            <p className="text-muted-foreground">Loading group...</p>
          </div>
        </div>
      );
    }
    return <GroupChat group={selectedGroup} currentUser={user} onBack={handleBackClick} />;
  }

  if (!selectedContact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center max-w-sm animate-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-6">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2">QuantChat</h2>
          <p className="text-muted-foreground mb-4">
            Select a conversation to start messaging securely
          </p>
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/70">
            <Lock className="w-3.5 h-3.5" />
            <span>End-to-end encrypted</span>
          </div>
        </div>
      </div>
    );
  }

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
                {selectedContact.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span
              className={cn(
                "absolute bottom-0 right-0 w-2.5 h-2.5 md:w-3 md:h-3 rounded-full border-2 border-card",
                selectedContact.isOnline ? "bg-green-500" : "bg-muted-foreground/50"
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm md:text-base truncate">{selectedContact.fullName}</h3>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {selectedContact.isTyping ? (
                <span className="text-primary font-medium">typing...</span>
              ) : selectedContact.isOnline ? (
                <span className="text-green-500 font-medium">Online</span>
              ) : (
                'Offline'
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
          {/* Export/Import Conversation */}
          <ExportConversation
            contactId={selectedContactId}
            contactName={selectedContact.fullName}
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

        {conversation?.messages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            isOwn={message.senderId === user?.id}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput 
        onSend={handleSendMessage}
        recipientId={selectedContactId || undefined}
        onTyping={(isTyping) => {
          if (selectedContactId) {
            sendTypingIndicator(selectedContactId, isTyping);
          }
        }}
      />
    </div>
  );
}
