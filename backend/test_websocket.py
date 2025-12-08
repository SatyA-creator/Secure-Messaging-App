import asyncio
import websockets
import json

async def test_websocket():
    uri = "ws://127.0.0.1:8001/ws/test-user-123"
    
    print(f"🔌 Connecting to {uri}...")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("✅ WebSocket connected successfully!")
            
            # Wait for connection confirmation
            response = await websocket.recv()
            print(f"📨 Received: {response}")
            
            # Send a test message
            test_message = {
                "type": "new_message",
                "payload": {
                    "recipient_id": "test-user-456",
                    "content": "Hello from WebSocket test!"
                }
            }
            
            print(f"📤 Sending test message: {test_message}")
            await websocket.send(json.dumps(test_message))
            
            print("✅ Message sent successfully!")
            print("⏳ Waiting for 2 seconds to receive messages...")
            
            # Wait a bit to receive any responses
            try:
                response = await asyncio.wait_for(websocket.recv(), timeout=2.0)
                print(f"📨 Received response: {response}")
            except asyncio.TimeoutError:
                print("⏰ No response received (timeout - this is normal if no recipient is connected)")
            
            print("✅ WebSocket test completed successfully!")
            
    except websockets.exceptions.InvalidStatusCode as e:
        print(f"❌ Connection failed with status code: {e.status_code}")
        print(f"   Headers: {e.headers}")
    except ConnectionRefusedError:
        print("❌ Connection refused - make sure the backend server is running on port 8001")
    except Exception as e:
        print(f"❌ Error: {type(e).__name__}: {str(e)}")

if __name__ == "__main__":
    print("🧪 WebSocket Connection Test")
    print("=" * 50)
    asyncio.run(test_websocket())
