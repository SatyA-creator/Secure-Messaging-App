import React, { useState } from 'react';
import { ChatProvider } from '@/context/ChatContext';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useChat } from '@/context/ChatContext';

function ChatContent() {
  const { selectedContactId } = useChat();
  const [showSidebar, setShowSidebar] = useState(true);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - hidden on mobile when chat is selected */}
      <div className={`
        ${selectedContactId && !showSidebar ? 'hidden md:flex' : 'flex'}
        w-full md:w-80 flex-shrink-0
      `}>
        <Sidebar onSelectContact={() => setShowSidebar(false)} />
      </div>
      
      {/* Chat Window - full width on mobile, beside sidebar on desktop */}
      <div className={`
        ${!selectedContactId ? 'hidden md:flex' : 'flex'}
        flex-1 w-full
      `}>
        <ChatWindow onBack={() => setShowSidebar(true)} />
      </div>
    </div>
  );
}

export default function Chat() {
  return (
    <ChatProvider>
      <ChatContent />
    </ChatProvider>
  );
}
