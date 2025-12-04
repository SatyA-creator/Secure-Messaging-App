import React from 'react';
import { useChat } from '@/context/ChatContext';
import { cn } from '@/lib/utils';

export function ConnectionStatus() {
  const { isConnected } = useChat();

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-xs">
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          isConnected ? "bg-green-500" : "bg-red-500"
        )}
      />
      <span className="text-muted-foreground">
        {isConnected ? "Connected" : "Disconnected"}
      </span>
    </div>
  );
}