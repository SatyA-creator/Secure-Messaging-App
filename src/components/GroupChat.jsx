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
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 flex-shrink-0 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {(group.name || 'G').charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold">{group.name || 'Group Chat'}</h2>
            <p className="text-sm opacity-90">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                  <p className="text-gray-500">Loading messages...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-lg font-medium">No messages yet</p>
                  <p className="text-gray-400 text-sm mt-1">Be the first to send a message!</p>
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
                    className={`mb-4 flex items-end gap-2 ${
                      isCurrentUser ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {/* Sender Avatar for others */}
                    {!isCurrentUser && (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {senderInitial}
                      </div>
                    )}
                    
                    <div
                      className={`max-w-[70%] md:max-w-md px-4 py-2 rounded-2xl shadow-sm ${
                        isCurrentUser
                          ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                      }`}
                    >
                      {!isCurrentUser && (
                        <p className={`text-xs font-bold mb-1 ${
                          isCurrentUser ? 'opacity-90' : 'text-blue-600'
                        }`}>
                          {senderName}
                        </p>
                      )}
                      <p className="break-words">{msg.content}</p>
                      <p className={`text-xs mt-1 ${
                        isCurrentUser ? 'opacity-80' : 'text-gray-500'
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
          <div className="bg-white border-t border-gray-200 p-4 flex gap-3 flex-shrink-0 shadow-lg">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="bg-gradient-to-r from-blue-600 to-blue-500 text-white px-6 py-3 rounded-xl hover:from-blue-700 hover:to-blue-600 transition-all duration-200 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium shadow-md hover:shadow-lg disabled:shadow-none"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>

        {/* Members List */}
        <div className="w-72 border-l border-gray-200 bg-white overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">MEMBERS ({members.length})</h3>
          </div>
          <div className="p-3">
            {members.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No members found</p>
            ) : (
              <div className="space-y-1">
                {members.map(member => {
                  const isAdmin = member.role === 'admin' || 
                                  member.id === group.admin_id || 
                                  member.user_id === group.admin_id;
                  const isCurrentUser = member.id === currentUser?.id || member.user_id === currentUser?.id;
                  
                  return (
                    <div 
                      key={member.id || member.user_id} 
                      className={`p-3 rounded-lg transition-colors ${
                        isCurrentUser ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {member.avatar_url ? (
                          <img
                            src={member.avatar_url}
                            alt={member.username}
                            className="w-10 h-10 rounded-full object-cover border-2 border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-semibold text-sm">
                            {(member.full_name || member.username || '?').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {member.full_name || member.username}
                              {isCurrentUser && <span className="text-gray-500"> (You)</span>}
                            </p>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{member.email || member.username}</p>
                          {isAdmin && (
                            <span className="inline-flex items-center text-xs bg-blue-500 text-white px-2 py-0.5 rounded mt-1">
                              Admin
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}