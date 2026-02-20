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
                
                // Debug: Log media info
                if (index === 0) {
                  console.log('🖼️ Rendering media:', {
                    file_name: media.file_name,
                    category: media.category,
                    file_url: media.file_url,
                    cleanUrl,
                    fullUrl,
                    API_URL: ENV.API_URL
                  });
                }
                
                const handleDownload = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  console.log('🔽 Starting download:', media.file_name);
                  console.log('📍 Download URL:', fullUrl);
                  
                  try {
                    const response = await fetch(fullUrl, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                      },
                      mode: 'cors',
                      credentials: 'include',
                    });
                    
                    console.log('📡 Response:', response.status, response.statusText);
                    
                    if (!response.ok) {
                      let errorDetail = `HTTP ${response.status} ${response.statusText}`;
                      try {
                        const errorData = await response.json();
                        errorDetail = errorData.detail || errorDetail;
                      } catch {
                        const errorText = await response.text();
                        errorDetail = errorText || errorDetail;
                      }
                      throw new Error(errorDetail);
                    }
                    
                    const blob = await response.blob();
                    console.log('📦 Blob created:', blob.size, 'bytes, type:', blob.type);
                    
                    // Force download by creating a blob URL and triggering click
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = media.file_name; // Force download with original filename
                    link.style.display = 'none';
                    
                    document.body.appendChild(link);
                    link.click();
                    
                    // Cleanup
                    setTimeout(() => {
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                      console.log('✅ Download triggered:', media.file_name);
                    }, 100);
                    
                  } catch (error) {
                    console.error('❌ Download failed:', error);
                    console.error('❌ Error details:', {
                      name: error instanceof Error ? error.name : 'Unknown',
                      message: error instanceof Error ? error.message : String(error),
                      stack: error instanceof Error ? error.stack : undefined
                    });
                    
                    let userMessage = 'Download failed';
                    if (error instanceof Error) {
                      if (error.message.includes('404') || error.message.includes('not found')) {
                        userMessage = 'File not found on server. The file may have been deleted or the server was restarted (files in /tmp are temporary on Render).';
                      } else if (error.message.includes('Failed to fetch')) {
                        userMessage = 'Network error. Please check your connection and try again.';
                      } else {
                        userMessage = error.message;
                      }
                    }
                    
                    alert(`Failed to download ${media.file_name}:\n\n${userMessage}`);
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
                        onError={(e) => {
                          console.error('❌ Image failed to load:', {
                            src: fullUrl,
                            file_name: media.file_name,
                            error: e
                          });
                          // Show a broken image placeholder
                          (e.target as HTMLImageElement).style.display = 'none';
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400';
                          errorDiv.innerHTML = `<p class="font-medium mb-1">⚠️ Image failed to load</p><p class="text-xs">${media.file_name}</p>`;
                          (e.target as HTMLImageElement).parentElement?.appendChild(errorDiv);
                        }}
                        onLoad={() => {
                          console.log('✅ Image loaded successfully:', media.file_name);
                        }}
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
                
                // Debug: Log media info
                if (index === 0) {
                  console.log('🖼️ Rendering media (mediaUrls fallback):', {
                    mediaUrl,
                    cleanUrl,
                    fullUrl,
                    isImage,
                    fileName,
                    API_URL: ENV.API_URL
                  });
                }
                
                const handleDownload = async (e: React.MouseEvent) => {
                  e.stopPropagation();
                  e.preventDefault();
                  
                  console.log('🔽 Starting download:', fileName);
                  console.log('📍 Download URL:', fullUrl);
                  
                  try {
                    const response = await fetch(fullUrl, {
                      method: 'GET',
                      headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                      },
                      mode: 'cors',
                      credentials: 'include',
                    });
                    
                    console.log('📡 Response:', response.status, response.statusText);
                    
                    if (!response.ok) {
                      let errorDetail = `HTTP ${response.status} ${response.statusText}`;
                      try {
                        const errorData = await response.json();
                        errorDetail = errorData.detail || errorDetail;
                      } catch {
                        const errorText = await response.text();
                        errorDetail = errorText || errorDetail;
                      }
                      throw new Error(errorDetail);
                    }
                    
                    const blob = await response.blob();
                    console.log('📦 Blob created:', blob.size, 'bytes, type:', blob.type);
                    
                    // Force download by creating a blob URL and triggering click
                    const blobUrl = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = blobUrl;
                    link.download = fileName; // Force download with original filename
                    link.style.display = 'none';
                    
                    document.body.appendChild(link);
                    link.click();
                    
                    // Cleanup
                    setTimeout(() => {
                      document.body.removeChild(link);
                      window.URL.revokeObjectURL(blobUrl);
                      console.log('✅ Download triggered:', fileName);
                    }, 100);
                    
                  } catch (error) {
                    console.error('❌ Download failed:', error);
                    console.error('❌ Error details:', {
                      name: error instanceof Error ? error.name : 'Unknown',
                      message: error instanceof Error ? error.message : String(error),
                      stack: error instanceof Error ? error.stack : undefined
                    });
                    
                    let userMessage = 'Download failed';
                    if (error instanceof Error) {
                      if (error.message.includes('404') || error.message.includes('not found')) {
                        userMessage = 'File not found on server. The file may have been deleted or the server was restarted (files in /tmp are temporary on Render).';
                      } else if (error.message.includes('Failed to fetch')) {
                        userMessage = 'Network error. Please check your connection and try again.';
                      } else {
                        userMessage = error.message;
                      }
                    }
                    
                    alert(`Failed to download ${fileName}:\n\n${userMessage}`);
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
                        onError={(e) => {
                          console.error('❌ Image failed to load (mediaUrls):', {
                            src: fullUrl,
                            fileName,
                            error: e
                          });
                          (e.target as HTMLImageElement).style.display = 'none';
                          const errorDiv = document.createElement('div');
                          errorDiv.className = 'p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400';
                          errorDiv.innerHTML = `<p class="font-medium mb-1">⚠️ Image failed to load</p><p class="text-xs">${fileName}</p>`;
                          (e.target as HTMLImageElement).parentElement?.appendChild(errorDiv);
                        }}
                        onLoad={() => {
                          console.log('✅ Image loaded successfully (mediaUrls):', fileName);
                        }}
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
