import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Send, Paperclip, Smile, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [message]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border-t border-border bg-card/50">
      <div className="flex items-end gap-2">
        <Button type="button" variant="ghost" size="icon" className="flex-shrink-0 text-muted-foreground hover:text-foreground">
          <Paperclip className="w-5 h-5" />
        </Button>
        
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={e => setMessage(e.target.value)}
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

        <Button type="button" variant="ghost" size="icon" className="flex-shrink-0 text-muted-foreground hover:text-foreground">
          <Smile className="w-5 h-5" />
        </Button>

        <Button 
          type="submit" 
          variant="glow" 
          size="icon" 
          className="flex-shrink-0"
          disabled={!message.trim() || disabled}
        >
          <Send className="w-5 h-5" />
        </Button>
      </div>
      
      <p className="text-[10px] text-muted-foreground/60 mt-2 text-center flex items-center justify-center gap-1">
        <Lock className="w-3 h-3" />
        End-to-end encrypted with AES-256-GCM
      </p>
    </form>
  );
}
