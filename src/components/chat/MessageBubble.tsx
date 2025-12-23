import React from 'react';
import { Message } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, CheckCheck, Clock, Lock, AlertCircle } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  return (
    <div
      className={cn(
        "flex animate-message",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 relative group",
          isOwn
            ? "message-sent rounded-br-md"
            : "message-received rounded-bl-md"
        )}
      >
        <p className="text-sm leading-relaxed break-words">
          {message.decryptedContent || '[Encrypted message]'}
        </p>
        
        <div className={cn(
          "flex items-center gap-1.5 mt-1",
          isOwn ? "justify-end" : "justify-start"
        )}>
          {message.isEncrypted && (
            <Lock className="w-3 h-3 text-primary/70" />
          )}
          <span className="text-[10px] text-muted-foreground/70">
            {format(message.createdAt, 'HH:mm')}
          </span>
          {isOwn && (
            <MessageStatus status={message.status} />
          )}
        </div>
      </div>
    </div>
  );
}

function MessageStatus({ status }: { status: Message['status'] }) {
  switch (status) {
    case 'sending':
      return <Clock className="w-3.5 h-3.5 text-muted-foreground/70 animate-pulse" />;
    case 'sent':
      return <Check className="w-3.5 h-3.5 text-muted-foreground/70" />;
    case 'delivered':
      return <CheckCheck className="w-3.5 h-3.5 text-muted-foreground/70" />;
    case 'read':
      return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
    case 'failed':
      return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
    default:
      return null;
  }
}
