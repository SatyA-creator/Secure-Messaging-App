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
  const isDecryptionError = message.decryptedContent === '[Unable to decrypt message]';

  // ⚠️ SECURITY: Never log message content to console

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
            {/* Prefer mediaAttachments if available, otherwise fall back to mediaUrls */}
            {message.mediaAttachments && message.mediaAttachments.length > 0 ? (
              message.mediaAttachments.map((media, index) => {
                // Fix: Remove /api/v1 prefix if present to avoid duplication
                const cleanUrl = media.file_url.startsWith('/api/v1') 
                  ? media.file_url.replace('/api/v1', '')
                  : media.file_url;
                const fullUrl = cleanUrl.startsWith('http') 
                  ? cleanUrl 
                  : `${ENV.API_URL}${cleanUrl}`;
                
                const handleDownload = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  try {
                    console.log('🔽 Downloading file:', media.file_name);
                    console.log('📍 URL:', fullUrl);
                    
                    const response = await fetch(fullUrl, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                      },
                    });
                    
                    if (!response.ok) {
                      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                    }
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = media.file_name;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    console.log('✅ Download complete:', media.file_name);
                  } catch (error) {
                    console.error('❌ Download failed:', error);
                    alert(`Failed to download ${media.file_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                };
                
                if (media.category === 'image') {
                  return (
                    <div key={media.id} className="relative group">
                      <img
                        src={fullUrl}
                        alt={media.file_name}
                        className="rounded-lg max-w-full md:max-w-[400px] max-h-[500px] w-auto h-auto cursor-pointer hover:opacity-95 transition-opacity object-contain bg-black/5"
                        onClick={() => window.open(fullUrl, '_blank')}
                        loading="lazy"
                      />
                      {/* Download button overlay (visible on hover) */}
                      <button
                        onClick={handleDownload}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                        title="Download image"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {/* Download button below image (always visible) */}
                      <button
                        onClick={handleDownload}
                        className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-md bg-background/80 hover:bg-background border border-border/50 transition-colors"
                        title={media.file_name}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="truncate">Download</span>
                      </button>
                    </div>
                  );
                } else if (media.file_type.startsWith('video/')) {
                  return (
                    <div key={media.id} className="relative">
                      <video
                        src={fullUrl}
                        controls
                        className="rounded-lg max-w-full md:max-w-[400px] max-h-[500px] w-auto h-auto bg-black/5"
                      />
                      {/* Download button below video */}
                      <button
                        onClick={handleDownload}
                        className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-md bg-background/80 hover:bg-background border border-border/50 transition-colors"
                        title={media.file_name}
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="truncate">Download Video</span>
                      </button>
                    </div>
                  );
                } else {
                  return (
                    <button
                      key={media.id}
                      onClick={handleDownload}
                      className="flex items-center gap-2 p-3 rounded-lg bg-background/50 hover:bg-background/70 transition-colors border border-border/30 w-full text-left"
                    >
                      <FileText className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm truncate flex-1 font-medium">{media.file_name}</span>
                      <Download className="w-4 h-4 flex-shrink-0 text-primary" />
                    </button>
                  );
                }
              })
            ) : (
              /* Fallback to mediaUrls if mediaAttachments is not available */
              message.mediaUrls?.map((mediaUrl, index) => {
                // Fix: Remove /api/v1 prefix if present to avoid duplication
                const cleanUrl = mediaUrl.startsWith('/api/v1')
                  ? mediaUrl.replace('/api/v1', '')
                  : mediaUrl;
                const fullUrl = cleanUrl.startsWith('http') 
                  ? cleanUrl 
                  : `${ENV.API_URL}${cleanUrl}`;
                const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(mediaUrl);
                const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(mediaUrl);
                const fileName = mediaUrl.split('/').pop() || 'file';
                
                const handleDownload = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  try {
                    console.log('🔽 Downloading file:', fileName);
                    console.log('📍 URL:', fullUrl);
                    
                    const response = await fetch(fullUrl, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                      },
                    });
                    
                    if (!response.ok) {
                      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
                    }
                    
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = fileName;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    console.log('✅ Download complete:', fileName);
                  } catch (error) {
                    console.error('❌ Download failed:', error);
                    alert(`Failed to download ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                };
                
                if (isImage) {
                  return (
                    <div key={index} className="relative group">
                      <img
                        src={fullUrl}
                        alt="Attachment"
                        className="rounded-lg max-w-full md:max-w-[400px] max-h-[500px] w-auto h-auto cursor-pointer hover:opacity-95 transition-opacity object-contain bg-black/5"
                        onClick={() => window.open(fullUrl, '_blank')}
                        loading="lazy"
                      />
                      {/* Download button overlay (visible on hover) */}
                      <button
                        onClick={handleDownload}
                        className="absolute top-2 right-2 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                        title="Download image"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      {/* Download button below image (always visible) */}
                      <button
                        onClick={handleDownload}
                        className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-md bg-background/80 hover:bg-background border border-border/50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="truncate">Download</span>
                      </button>
                    </div>
                  );
                } else if (isVideo) {
                  return (
                    <div key={index} className="relative">
                      <video
                        src={fullUrl}
                        controls
                        className="rounded-lg max-w-full md:max-w-[400px] max-h-[500px] w-auto h-auto bg-black/5"
                      />
                      {/* Download button below video */}
                      <button
                        onClick={handleDownload}
                        className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-1.5 text-xs rounded-md bg-background/80 hover:bg-background border border-border/50 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="truncate">Download Video</span>
                      </button>
                    </div>
                  );
                } else {
                  return (
                    <button
                      key={index}
                      onClick={handleDownload}
                      className="flex items-center gap-2 p-3 rounded-lg bg-background/50 hover:bg-background/70 transition-colors border border-border/30 w-full text-left"
                    >
                      <FileText className="w-5 h-5 flex-shrink-0" />
                      <span className="text-sm truncate flex-1 font-medium">{fileName}</span>
                      <Download className="w-4 h-4 flex-shrink-0 text-primary" />
                    </button>
                  );
                }
              })
            )}
          </div>
        )}
        
        {/* Text content */}
        {hasText && (
          <>
            {isDecryptionError ? (
              <div className="flex items-start gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-destructive mb-1">Unable to decrypt message</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    This message was encrypted with a different encryption key. 
                    {!isOwn && " Ask the sender to refresh their contacts and resend."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed break-words">
                {message.decryptedContent?.replace(/^encrypted:/, '') || '[Encrypted message]'}
              </p>
            )}
          </>
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
