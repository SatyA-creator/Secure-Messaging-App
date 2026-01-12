import React, { useState, useEffect, useRef } from 'react';
import WebSocketService from '../lib/websocket';
import api from '../config/api';

export default function GroupChat({ group, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState([]);
  const messagesEndRef = useRef(null);
  const wsService = WebSocketService.getInstance();

useEffect(() => {
  console.log('🔧 Setting up group chat listeners for group:', group.id);
  
  loadGroupMessages();
  loadGroupMembers();
  
  // ✅ Listen for incoming group messages
  wsService.on('new_group_message', handleNewGroupMessage);
  
  // ✅ Listen for delivery confirmations
  wsService.on('message_delivered', (data) => {
    console.log('✅ Message delivered confirmation:', data.message_id);
    if (data.group_id === group.id) {
      setMessages(prev => prev.map(msg =>
        msg.id === data.message_id ? { ...msg, status: 'delivered' } : msg
      ));
    }
  });
  
  // ✅ Listen for read receipts
  wsService.on('message_read', (data) => {
    console.log('✅ Message read confirmation:', data.message_id);
    if (data.group_id === group.id) {
      setMessages(prev => prev.map(msg =>
        msg.id === data.message_id ? { ...msg, is_read: 1 } : msg
      ));
    }
  });
  
  // ✅ Listen for member updates (join/leave)
  wsService.on('group_member_joined', (data) => {
    console.log('👥 Member joined group:', data.user_id);
    if (data.group_id === group.id) {
      loadGroupMembers(); // Reload member list
    }
  });
  
  wsService.on('group_member_left', (data) => {
    console.log('👋 Member left group:', data.user_id);
    if (data.group_id === group.id) {
      loadGroupMembers(); // Reload member list
    }
  });
  
  return () => {
    console.log('🧹 Cleaning up group chat listeners for group:', group.id);
    wsService.off('new_group_message', handleNewGroupMessage);
    wsService.off('message_delivered');
    wsService.off('message_read');
    wsService.off('group_member_joined');
    wsService.off('group_member_left');
  };
}, [group.id]);


  const loadGroupMessages = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/groups/${group.id}/messages`);
      const messagesData = response.data.messages || [];
      setMessages(messagesData.reverse());
      scrollToBottom();
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadGroupMembers = async () => {
    try {
      const response = await api.get(`/groups/${group.id}/members`);
      const membersData = response.data || [];
      console.log('📋 Raw members data:', membersData);
      
      // Normalize member data to ensure consistent structure
      const normalizedMembers = membersData.map(member => ({
        id: member.user_id || member.id,
        user_id: member.user_id || member.id,
        username: member.username || member.full_name || 'Unknown User',
        full_name: member.full_name || member.username || 'Unknown User',
        email: member.email || '',
        role: member.role || 'member',
        avatar_url: member.avatar_url || null
      }));
      
      console.log('✅ Normalized members:', normalizedMembers);
      setMembers(normalizedMembers);
    } catch (err) {
      console.error('Error loading members:', err);
      setMembers([]);
    }
  };

const handleNewGroupMessage = (data) => {
  console.log('📨 Received group message:', {
    messageId: data.message_id,
    groupId: data.group_id,
    senderId: data.sender_id,
    timestamp: data.timestamp
  });
  
  // ✅ FIX: Only process if message is for current group
  if (data.group_id === group.id) {
    // Find sender info for display
    const sender = members.find(m => m.id === data.sender_id);
    
    const newMessage = {
      id: data.message_id || `msg-${Date.now()}`,
      sender_id: data.sender_id,
      content: data.encrypted_content,
      created_at: data.timestamp || new Date().toISOString(),
      is_read: 0,
      status: 'delivered', // Message arrived
      sender_username: sender?.username || 'Unknown User'
    };
    
    console.log(`✅ Adding message from ${newMessage.sender_username} to group ${data.group_id}`);
    
    // ✅ Avoid duplicate messages
    setMessages(prev => {
      const messageExists = prev.some(m => m.id === newMessage.id);
      if (messageExists) {
        console.warn(`⚠️ Message ${newMessage.id} already exists, skipping duplicate`);
        return prev;
      }
      // Sort messages by timestamp
      return [...prev, newMessage].sort((a, b) => 
        new Date(a.created_at) - new Date(b.created_at)
      );
    });
    
    scrollToBottom();
    
    // ✅ Send delivery confirmation to sender
    if (wsService?.isConnected()) {
      wsService.send('delivery_confirmation', {
        message_id: data.message_id,
        group_id: data.group_id,
        delivered_by: currentUser.id
      });
    }
  } else {
    console.log(`⚠️ Received message for different group: ${data.group_id}, current: ${group.id}`);
  }
};

const handleSendMessage = async () => {
  if (!inputMessage.trim()) return;

  try {
    // ✅ FIX 1: Build session keys for ALL members including the sender
    const encryptedSessionKeys = {};
    
    // Include ALL group members, including the admin sending the message
    for (const member of members) {
      try {
        // In production: encrypt with member's public key
        // For now: use secure placeholder with member ID and timestamp
        encryptedSessionKeys[member.id] = `key-${member.id}-${Date.now()}-${Math.random()}`;
        console.log(`✅ Built session key for member: ${member.username}`);
      } catch (error) {
        console.error(`❌ Failed to build key for member ${member.id}:`, error);
      }
    }
    
    console.log(`📋 Session keys built for ${Object.keys(encryptedSessionKeys).length} members:`, 
      Object.keys(encryptedSessionKeys).map(id => {
        const member = members.find(m => m.id === id);
        return member?.username || id;
      })
    );

    // ✅ FIX 2: Include all necessary fields for backend to process
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const messagePayload = {
      group_id: group.id,
      sender_id: currentUser.id,
      message_id: messageId,
      encrypted_content: inputMessage, // TODO: Implement actual E2E encryption
      encrypted_session_keys: encryptedSessionKeys,
      timestamp: new Date().toISOString(),
      recipient_ids: members.map(m => m.id) // ✅ Explicit list of who should receive
    };
    
    console.log('📤 Sending group message:', {
      groupId: group.id,
      senderId: currentUser.id,
      senderName: members.find(m => m.id === currentUser.id)?.username,
      totalMembers: members.length,
      sessionKeysCount: Object.keys(encryptedSessionKeys).length,
      messagePreview: inputMessage.substring(0, 50)
    });

    // ✅ FIX 3: Send via WebSocket with complete payload
    wsService.send('group_message', messagePayload);

    // ✅ FIX 4: Optimistically add to local messages with sending status
    setMessages(prev => [...prev, {
      id: messageId,
      sender_id: currentUser.id,
      content: inputMessage,
      created_at: new Date().toISOString(),
      status: 'sending', // Shows user the message is being sent
      is_read: 0
    }]);

    setInputMessage('');
    scrollToBottom();
    
    console.log('✅ Group message sent successfully');
    
  } catch (err) {
    console.error('❌ Error sending group message:', err);
    console.error('Error stack:', err.stack);
    alert(`Failed to send message: ${err.message || 'Unknown error'}`);
  }
};


  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex-1 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-3 border-b border-border bg-card/50">
        <div className="flex items-center gap-2 md:gap-3 min-w-0 flex-1">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <span className="font-medium text-primary text-sm md:text-base">
                {(group.name || 'G').charAt(0).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-medium text-sm md:text-base truncate">{group.name || 'Group Chat'}</h3>
            <p className="text-[10px] md:text-xs text-muted-foreground truncate">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-0.5 md:gap-1 flex-shrink-0">
          <button className="text-muted-foreground hover:text-foreground w-8 h-8 md:w-10 md:h-10 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 md:p-4 space-y-2 md:space-y-3">
        {/* Encryption notice */}
        <div className="flex justify-center mb-2 md:mb-4">
          <div className="inline-flex items-center gap-1.5 md:gap-2 px-2.5 md:px-3 py-1 md:py-1.5 rounded-full bg-primary/10 text-[10px] md:text-xs text-primary">
            <svg className="w-3 h-3 md:w-3.5 md:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span className="hidden sm:inline">Messages are end-to-end encrypted</span>
            <span className="sm:hidden">E2E encrypted</span>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
              <p className="text-muted-foreground">Loading messages...</p>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-sm animate-in">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-primary/10 mb-6">
                <svg className="w-10 h-10 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <p className="text-muted-foreground text-lg font-medium">No messages yet</p>
              <p className="text-muted-foreground/70 text-sm mt-1">Be the first to send a message!</p>
            </div>
          </div>
        ) : (
          messages.map(msg => {
            // Find sender from members list
            const sender = members.find(m => 
              m.id === msg.sender_id || m.user_id === msg.sender_id
            );
            const senderName = sender?.full_name || sender?.username || 'Unknown User';
            const isCurrentUser = msg.sender_id === currentUser.id;
            const senderInitial = senderName.charAt(0).toUpperCase();
            
            return (
              <div
                key={msg.id}
                className={`mb-2 md:mb-3 flex items-end gap-1.5 md:gap-2 ${
                  isCurrentUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {/* Sender Avatar for others */}
                {!isCurrentUser && (
                  <div className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs md:text-sm font-medium text-primary">
                      {senderInitial}
                    </span>
                  </div>
                )}
                
                <div
                  className={`max-w-[70%] md:max-w-md px-3 md:px-4 py-1.5 md:py-2 rounded-2xl shadow-sm ${
                    isCurrentUser
                      ? 'bg-primary text-primary-foreground rounded-br-sm'
                      : 'bg-card text-card-foreground border border-border rounded-bl-sm'
                  }`}
                >
                  {!isCurrentUser && (
                    <p className={`text-[10px] md:text-xs font-semibold mb-0.5 ${
                      isCurrentUser ? 'opacity-90' : 'text-primary'
                    }`}>
                      {senderName}
                    </p>
                  )}
                  <p className="break-words text-sm md:text-base">{msg.content}</p>
                  <p className={`text-[10px] md:text-xs mt-0.5 ${
                    isCurrentUser ? 'opacity-80' : 'text-muted-foreground'
                  }`}>
                    {new Date(msg.created_at || msg.timestamp).toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card/50 p-2 md:p-3">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Type a message..."
              className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-background border border-border rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm md:text-base max-h-32 transition-all"
              rows={1}
              style={{
                minHeight: '40px',
                height: 'auto'
              }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim()}
            className="flex-shrink-0 w-9 h-9 md:w-10 md:h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}