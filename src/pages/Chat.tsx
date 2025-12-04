import React from 'react';
import { ChatProvider } from '@/context/ChatContext';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';

export default function Chat() {
  return (
    <ChatProvider>
      <div className="h-screen flex overflow-hidden">
        <Sidebar />
        <ChatWindow />
      </div>
    </ChatProvider>
  );
}
