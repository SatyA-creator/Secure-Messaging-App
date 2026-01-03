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

        this.ws.onclose = () => {
          console.log('❌ WebSocket disconnected');
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
    const payload = data.payload || data;
    
    console.log(`📨 Handling message type: ${messageType}`);
    
    const handlers = this.eventHandlers.get(messageType) || [];
    handlers.forEach(handler => {
      try {
        handler(payload);
      } catch (error) {
        console.error(`❌ Error in handler for ${messageType}:`, error);
      }
    });
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        // ✅ Use stored userId and token for reconnection
        this.connect(this.userId, this.token).catch(() => {
          console.error('❌ Reconnection failed');
        });
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
      // Merge type and payload into one object for backend compatibility
      const message = JSON.stringify({ type, ...payload as object });
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
