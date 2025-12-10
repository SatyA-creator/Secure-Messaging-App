import uvicorn
import os
from app.config import settings

if __name__ == "__main__":
    # Railway/Render uses PORT environment variable
    port = int(os.getenv("PORT", settings.SERVER_PORT))
    host = os.getenv("HOST", settings.SERVER_HOST)
    
    print("🚀 Starting Secure Messaging API...")
    print(f"📍 Server will run on: http://{host}:{port}")
    print(f"🌍 Environment: {settings.ENVIRONMENT}")
    print(f"🔧 Debug mode: {settings.DEBUG}")
    print("⏹️  Press Ctrl+C to stop")
    print("-" * 50)
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=settings.DEBUG,
        log_level="info"
    )