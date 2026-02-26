import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, Smile, Lock, Image, Video, File, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useKeyboard } from '@/hooks/useKeyboard';

interface MessageInputProps {
  onSend: (content: string, files?: File[]) => void;
  disabled?: boolean;
  recipientId?: string;
  onTyping?: (isTyping: boolean) => void;
}

export function MessageInput({ onSend, disabled, recipientId, onTyping }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const keyboardHeight = useKeyboard();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  // Handle typing indicator
  const handleTyping = () => {
    if (!onTyping || !recipientId) return;

    // Send "typing" indicator if not already typing
    if (!isTypingRef.current && message.trim()) {
      onTyping(true);
      isTypingRef.current = true;
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      if (isTypingRef.current) {
        onTyping(false);
        isTypingRef.current = false;
      }
    }, 2000);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && onTyping) {
        onTyping(false);
      }
    };
  }, [onTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((message.trim() || selectedFiles.length > 0) && !disabled && !isSending) {
      // Stop typing indicator
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (isTypingRef.current && onTyping) {
        onTyping(false);
        isTypingRef.current = false;
      }
      
      setIsSending(true);
      
      // Send message with files
      onSend(message.trim(), selectedFiles.length > 0 ? selectedFiles : undefined);
      
      // Clear input and files after sending
      setMessage('');
      setSelectedFiles([]);
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileSelect = (type: 'image' | 'video' | 'file') => {
    if (!fileInputRef.current) return;
    
    switch (type) {
      case 'image':
        fileInputRef.current.accept = 'image/*';
        break;
      case 'video':
        fileInputRef.current.accept = 'video/*';
        break;
      case 'file':
        fileInputRef.current.accept = '.pdf,.doc,.docx,.txt,.zip';
        break;
    }
    
    fileInputRef.current.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      // Validate file size (50MB max)
      const MAX_FILE_SIZE = 50 * 1024 * 1024;
      const validFiles = files.filter(file => {
        if (file.size > MAX_FILE_SIZE) {
          alert(`File ${file.name} is too large (max 50MB)`);
          return false;
        }
        return true;
      });
      
      setSelectedFiles(prev => [...prev, ...validFiles]);
      
      // Reset input value so same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-2 md:p-4 border-t border-border bg-card/50"
      style={keyboardHeight > 0 ? { paddingBottom: keyboardHeight } : undefined}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={onFileChange}
        className="hidden"
      />
      
      {/* Selected files preview */}
      {selectedFiles.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 p-2 bg-secondary/20 rounded-lg">
          {selectedFiles.map((file, index) => (
            <div key={index} className="flex items-center gap-2 bg-background px-3 py-1.5 rounded border text-xs">
              {file.type.startsWith('image/') && <Image className="w-3.5 h-3.5 text-blue-500" />}
              {file.type.startsWith('video/') && <Video className="w-3.5 h-3.5 text-purple-500" />}
              {!file.type.startsWith('image/') && !file.type.startsWith('video/') && <File className="w-3.5 h-3.5 text-gray-500" />}
              <span className="truncate max-w-[150px]">{file.name}</span>
              <span className="text-muted-foreground">({(file.size / 1024).toFixed(1)}KB)</span>
              <button
                type="button"
                onClick={() => setSelectedFiles(prev => prev.filter((_, i) => i !== index))}
                className="text-destructive hover:text-destructive/80 ml-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex items-end gap-1 md:gap-2">
        {/* Desktop dropdown menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="hidden md:flex flex-shrink-0 text-muted-foreground hover:text-foreground">
              <Paperclip className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => handleFileSelect('image')} className="cursor-pointer">
              <Image className="w-4 h-4 mr-2" />
              <span>Images</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('video')} className="cursor-pointer">
              <Video className="w-4 h-4 mr-2" />
              <span>Videos</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFileSelect('file')} className="cursor-pointer">
              <File className="w-4 h-4 mr-2" />
              <span>Documents</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Mobile attachment button */}
        <Button 
          type="button" 
          variant="ghost" 
          size="icon" 
          className="md:hidden flex-shrink-0 text-muted-foreground hover:text-foreground"
          onClick={() => {
            fileInputRef.current!.accept = 'image/*,video/*,.pdf,.doc,.docx,.txt,.zip';
            fileInputRef.current?.click();
          }}
        >
          <Paperclip className="w-5 h-5" />
        </Button>
        
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => {
              setMessage(e.target.value);
              handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={disabled}
            rows={1}
            className={cn(
              "w-full resize-none rounded-xl bg-secondary/50 border border-border px-4 py-3 pr-12",
              "text-sm placeholder:text-muted-foreground",
              "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50",
              "transition-all duration-200",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          />
          <div className="absolute right-3 bottom-3 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-primary/60" />
          </div>
        </div>

        <Button type="button" variant="ghost" size="icon" className="hidden md:flex flex-shrink-0 text-muted-foreground hover:text-foreground">
          <Smile className="w-5 h-5" />
        </Button>

        <Button 
          type="submit" 
          variant="glow" 
          size="icon" 
          className="flex-shrink-0"
          disabled={(!message.trim() && selectedFiles.length === 0) || disabled || isSending}
        >
          {isSending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </Button>
      </div>
      
      <p className="text-[10px] text-muted-foreground/60 mt-2 text-center items-center justify-center gap-1 hidden md:flex">
        <Lock className="w-3 h-3" />
        End-to-end encrypted with AES-256-GCM
      </p>
    </form>
  );
}
