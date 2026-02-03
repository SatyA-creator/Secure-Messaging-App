interface WebSocketMessage {
  type: string;
  payload: unknown;
}

type EventHandler = (data: unknown) => void;

class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private userId: string = '';
  private token: string = '';

  private constructor() {}

  public static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  public connect(userId: string, token: string): Promise<void> {
    this.userId = userId;
    this.token = token;
    
    return new Promise((resolve, reject) => {
      try {
        // Remove trailing slash from WS_URL if present
        const baseUrl = (import.meta.env.VITE_WS_URL || 'ws://127.0.0.1:8001').replace(/\/$/, '');
        // ✅ CRITICAL: Pass token as query parameter
        const wsUrl = `${baseUrl}/ws/${userId}?token=${encodeURIComponent(token)}`;
        
        console.log(`🔌 Connecting to WebSocket for user ${userId}...`);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected with authentication');
          this.reconnectAttempts = 0;
          
          // Fetch pending relay messages on connect
          this.fetchPendingMessages();
          
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('📨 WebSocket message received:', data);
            this.handleMessage(data);
          } catch (error) {
            console.error('❌ Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onclose = (event) => {
          console.log('❌ WebSocket disconnected', event.code, event.reason);
          
          // If disconnected due to authentication error (403), get fresh token
          if (event.code === 1008 || event.code === 1006) {
            console.log('🔑 Authentication error detected, will use fresh token on reconnect');
            const freshToken = localStorage.getItem('token');
            if (freshToken) {
              this.token = freshToken;
            }
          }
          
          this.handleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          reject(error);
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleMessage(data: any) {
    // Handle both formats: { type, payload } and { type, ...rest }
    const messageType = data.type;
    const payload = data.payload || data.data || data;
    
    console.log(`📨 Handling message type: ${messageType}`);
    
    // Handle relay messages specially
    if (messageType === 'relay_message') {
      console.log('📬 Received relay message:', payload);
      this.handleRelayMessage(payload);
      return;
    }
    
    const handlers = this.eventHandlers.get(messageType) || [];
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`❌ Error in handler for ${messageType}:`, error);
      }
    });
  }
  
  private async handleRelayMessage(relayMsg: any) {
    try {
      // Import relayClient dynamically to avoid circular deps
      const { relayClient } = await import('./relayClient');
      const userId = this.userId;
      
      if (userId) {
        await relayClient.processRelayMessage(relayMsg, userId);
        
        // ✅ Emit new_message event to update UI
        console.log('📨 Emitting new_message event from relay message');
        const handlers = this.eventHandlers.get('new_message') || [];
        handlers.forEach(handler => {
          try {
            handler({
              message_id: relayMsg.id,
              sender_id: relayMsg.sender_id,
              recipient_id: relayMsg.recipient_id,
              encrypted_content: relayMsg.encrypted_content,
              timestamp: relayMsg.created_at,
              has_media: relayMsg.has_media || false,
              media_attachments: relayMsg.media_refs || []
            });
          } catch (error) {
            console.error('❌ Error in new_message handler:', error);
          }
        });
      }
    } catch (error) {
      console.error('❌ Failed to handle relay message:', error);
    }
  }
  
  private async fetchPendingMessages() {
    try {
      console.log('📬 Fetching pending relay messages...');
      const { relayClient } = await import('./relayClient');
      const pendingMessages = await relayClient.fetchPendingMessages();
      
      if (pendingMessages.length > 0) {
        console.log(`📥 Processing ${pendingMessages.length} pending relay messages`);
        for (const msg of pendingMessages) {
          await relayClient.processRelayMessage(msg, this.userId);
          
          // ✅ Emit new_message event to update UI for each pending message
          console.log(`📨 Emitting new_message event for pending relay message ${msg.id}`);
          const handlers = this.eventHandlers.get('new_message') || [];
          handlers.forEach(handler => {
            try {
              handler({
                message_id: msg.id,
                sender_id: msg.sender_id,
                recipient_id: msg.recipient_id,
                encrypted_content: msg.encrypted_content,
                timestamp: msg.created_at,
                has_media: msg.has_media || false,
                media_attachments: msg.media_refs || []
              });
            } catch (error) {
              console.error('❌ Error in new_message handler:', error);
            }
          });
        }
      }
    } catch (error) {
      console.error('❌ Failed to fetch pending messages:', error);
    }
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        // ✅ Get fresh token from localStorage for reconnection
        const freshToken = localStorage.getItem('token');
        if (freshToken) {
          this.token = freshToken;  // Update stored token
          this.connect(this.userId, freshToken).catch(() => {
            console.error('❌ Reconnection failed');
          });
        } else {
          console.error('❌ No token available for reconnection');
        }
      }, this.reconnectDelay * this.reconnectAttempts);
    } else {
      console.error('❌ Max reconnection attempts reached');
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      console.log('🔌 WebSocket disconnected');
    }
  }

  public send(type: string, payload: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // ✅ CRITICAL FIX: Nest payload properly for backend compatibility
      const message = JSON.stringify({ type, payload });
      console.log(`📤 Sending WebSocket message: ${type}`, payload);
      this.ws.send(message);
    } else {
      console.error('❌ WebSocket is not connected, cannot send message');
      throw new Error('WebSocket not connected');
    }
  }

  public on(eventType: string, handler: EventHandler) {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
    console.log(`👂 Registered handler for: ${eventType}`);
  }

  public off(eventType: string, handler: EventHandler) {
    const handlers = this.eventHandlers.get(eventType);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
        console.log(`🔕 Removed handler for: ${eventType}`);
      }
    }
  }

  public isConnected(): boolean {
    return this.ws ? this.ws.readyState === WebSocket.OPEN : false;
  }
}

export default WebSocketService;
