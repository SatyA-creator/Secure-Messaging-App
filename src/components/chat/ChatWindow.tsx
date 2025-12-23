import React, { useRef, useEffect } from 'react';
import { useChat } from '@/context/ChatContext';
import { useAuth } from '@/context/AuthContext';
import { MessageBubble } from './MessageBubble';
import { MessageInput } from './MessageInput';
import { Lock, Shield, MoreVertical, Phone, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

export function ChatWindow() {
  const { user } = useAuth();
  const { contacts, conversations, selectedContactId, sendMessage, sendTypingIndicator } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<any>(null);

  const selectedContact = contacts.find(c => c.id === selectedContactId);
  const conversation = selectedContactId ? conversations[selectedContactId] : null;

  // Import WebSocketService
  useEffect(() => {
    import('@/lib/websocket').then(module => {
      wsRef.current = module.default.getInstance();
    });
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation?.messages]);

  // Send read confirmations for unread messages
  useEffect(() => {
    if (selectedContactId && conversation?.messages && user && wsRef.current) {
      const unreadMessages = conversation.messages.filter(
        msg => msg.senderId === selectedContactId && msg.status !== 'read'
      );
      
      unreadMessages.forEach(msg => {
        if (wsRef.current?.isConnected()) {
          wsRef.current.send('read_confirmation', {
            message_id: msg.id,
            sender_id: msg.senderId
          });
        }
      });
    }
  }, [selectedContactId, conversation?.messages, user]);

  const handleSendMessage = async (content: string) => {
    if (selectedContactId) {
      await sendMessage(selectedContactId, content);
    }
  };

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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <span className="font-medium text-primary">
                {selectedContact.fullName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span
              className={cn(
                "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card",
                selectedContact.isOnline ? "bg-green-500" : "bg-muted-foreground/50"
              )}
            />
          </div>
          <div>
            <h3 className="font-medium">{selectedContact.fullName}</h3>
            <p className="text-xs text-muted-foreground">
              {selectedContact.isTyping ? (
                <span className="text-primary font-medium">typing...</span>
              ) : selectedContact.isOnline ? (
                'Online'
              ) : (
                `Last seen ${formatDistanceToNow(selectedContact.lastSeen, { addSuffix: true })}`
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Phone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Video className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Encryption notice */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-xs text-primary">
            <Lock className="w-3.5 h-3.5" />
            Messages are end-to-end encrypted
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
