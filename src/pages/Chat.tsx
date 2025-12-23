import React, { useState } from 'react';
import { ChatProvider } from '@/context/ChatContext';
import { Sidebar } from '@/components/chat/Sidebar';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { useChat } from '@/context/ChatContext';

function ChatContent() {
  const { selectedContactId } = useChat();
  const [isMobileView, setIsMobileView] = useState(window.innerWidth < 768);

  // Update mobile view on resize
  React.useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar - hidden on mobile when chat is selected */}
      <div className={`
        ${isMobileView && selectedContactId ? 'hidden' : 'flex'}
        w-full md:w-80 flex-shrink-0
      `}>
        <Sidebar />
      </div>
      
      {/* Chat Window - full width on mobile, beside sidebar on desktop */}
      <div className={`
        ${isMobileView && !selectedContactId ? 'hidden' : 'flex'}
        flex-1 w-full
      `}>
        <ChatWindow />
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
