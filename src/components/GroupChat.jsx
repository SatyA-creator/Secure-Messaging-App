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
    loadGroupMessages();
    loadGroupMembers();
    
    // Listen for group messages
    wsService.on('new_group_message', handleNewGroupMessage);
    
    return () => {
      wsService.off('new_group_message', handleNewGroupMessage);
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
      setMembers(response.data);
    } catch (err) {
      console.error('Error loading members:', err);
    }
  };

  const handleNewGroupMessage = (data) => {
    console.log('📨 Received group message:', data);
    if (data.group_id === group.id) {
      // For now, display messages without encryption
      // You can add encryption later
      setMessages(prev => [...prev, {
        id: data.message_id,
        sender_id: data.sender_id,
        content: data.encrypted_content, // Display as-is for now
        created_at: data.timestamp,
        is_read: 0
      }]);
      scrollToBottom();
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    try {
      // Build session keys object for all members
      const encryptedSessionKeys = {};
      members.forEach(member => {
        if (member.id !== currentUser.id) {
          encryptedSessionKeys[member.id] = 'encrypted-key-' + member.id;
        }
      });

      // Send via WebSocket
      wsService.send('group_message', {
        payload: {
          group_id: group.id,
          encrypted_content: inputMessage, // Send plain text for now
          encrypted_session_keys: encryptedSessionKeys
        }
      });

      // Add to local messages optimistically
      setMessages(prev => [...prev, {
        id: 'temp-' + Date.now(),
        sender_id: currentUser.id,
        content: inputMessage,
        created_at: new Date().toISOString(),
        status: 'sending'
      }]);

      setInputMessage('');
      scrollToBottom();
    } catch (err) {
      console.error('Error sending message:', err);
      alert('Failed to send message');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 flex-shrink-0 shadow-md">
        <h2 className="text-xl font-bold">{group.name || 'Group Chat'}</h2>
        <p className="text-sm opacity-75">{members.length} members</p>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
            {loading ? (
              <div className="text-center text-gray-500">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500">No messages yet</div>
            ) : (
              messages.map(msg => {
                const sender = members.find(m => m.id === msg.sender_id) || 
                               members.find(m => m.user_id === msg.sender_id);
                const senderName = sender?.username || sender?.full_name || 'Unknown User';
                
                return (
                  <div
                    key={msg.id}
                    className={`mb-4 flex ${
                      msg.sender_id === currentUser.id ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    <div
                      className={`max-w-xs px-4 py-2 rounded-lg ${
                        msg.sender_id === currentUser.id
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-900 border border-gray-300'
                      }`}
                    >
                      {msg.sender_id !== currentUser.id && (
                        <p className="text-xs font-semibold opacity-75 mb-1">
                          {senderName}
                        </p>
                      )}
                      <p>{msg.content}</p>
                      <p className="text-xs opacity-70 mt-1">
                        {new Date(msg.created_at || msg.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-gray-200 p-4 flex gap-2 flex-shrink-0 shadow-lg">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Type a message..."
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              Send
            </button>
          </div>
        </div>

        {/* Members List */}
        <div className="w-64 border-l border-gray-200 p-4 bg-gray-50 overflow-y-auto flex-shrink-0">
          <h3 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wide">Members ({members.length})</h3>
          <div className="space-y-2">
            {members.map(member => (
              <div key={member.id || member.user_id} className="text-sm p-2 rounded hover:bg-gray-200">
                {member.avatar_url && (
                  <img
                    src={member.avatar_url}
                    alt={member.username}
                    className="w-6 h-6 rounded-full inline mr-2"
                  />
                )}
                {member.username}
                {(member.role === 'admin' || member.id === group.admin_id || member.user_id === group.admin_id) && (
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded ml-2">
                    Admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}