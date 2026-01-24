import React from 'react';
import { Message } from '@/types/messaging';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Check, CheckCheck, Clock, Lock, AlertCircle, Eye, FileText, Download } from 'lucide-react';
import { ENV } from '@/config/env';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
}

export function MessageBubble({ message, isOwn }: MessageBubbleProps) {
  const hasMedia = (message.mediaAttachments && message.mediaAttachments.length > 0) || 
                   (message.mediaUrls && message.mediaUrls.length > 0);
  const hasText = message.decryptedContent && message.decryptedContent.trim() !== '' && message.decryptedContent !== 'encrypted:';

  return (
    <div
      className={cn(
        "flex animate-message px-2 md:px-0",
        isOwn ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] md:max-w-[75%] rounded-2xl px-3 md:px-4 py-2 md:py-2.5 relative group",
          isOwn
            ? "message-sent rounded-br-md"
            : "message-received rounded-bl-md"
        )}
      >
        {/* Media attachments */}
        {hasMedia && (
          <div className="space-y-2 mb-2">
            {/* From mediaAttachments array */}
            {message.mediaAttachments?.map((media, index) => {
              const fullUrl = media.file_url.startsWith('http') ? media.file_url : `${ENV.API_URL}${media.file_url}`;
              
              if (media.category === 'image') {
                return (
                  <img
                    key={media.id}
                    src={fullUrl}
                    alt={media.file_name}
                    className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(fullUrl, '_blank')}
                  />
                );
              } else {
                return (
                  <a
                    key={media.id}
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded bg-background/50 hover:bg-background/70 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm truncate flex-1">{media.file_name}</span>
                    <Download className="w-4 h-4" />
                  </a>
                );
              }
            })}
            
            {/* From mediaUrls array (fallback) */}
            {message.mediaUrls?.map((mediaUrl, index) => {
              const fullUrl = mediaUrl.startsWith('http') ? mediaUrl : `${ENV.API_URL}${mediaUrl}`;
              const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl);
              
              if (isImage) {
                return (
                  <img
                    key={index}
                    src={fullUrl}
                    alt="Attachment"
                    className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => window.open(fullUrl, '_blank')}
                  />
                );
              } else {
                const fileName = mediaUrl.split('/').pop() || 'file';
                return (
                  <a
                    key={index}
                    href={fullUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded bg-background/50 hover:bg-background/70 transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    <span className="text-sm truncate flex-1">{fileName}</span>
                    <Download className="w-4 h-4" />
                  </a>
                );
              }
            })}
          </div>
        )}
        
        {/* Text content */}
        {hasText && (
          <p className="text-sm leading-relaxed break-words">
            {message.decryptedContent?.replace(/^encrypted:/, '') || '[Encrypted message]'}
          </p>
        )}
        
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
      return <Eye className="w-3.5 h-3.5 text-blue-500" title="Read" />;
    case 'failed':
      return <AlertCircle className="w-3.5 h-3.5 text-destructive" />;
    default:
      return null;
  }
}
