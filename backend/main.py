import uvicorn
from app.config import settings

if __name__ == "__main__":
    print("🚀 Starting Secure Messaging API...")
    print(f"📍 Server will run on: http://{settings.SERVER_HOST}:{settings.SERVER_PORT}")
    print(f"🌍 Environment: {settings.ENVIRONMENT}")
    print(f"🔧 Debug mode: {settings.DEBUG}")
    print("⏹️  Press Ctrl+C to stop")
    print("-" * 50)
    
    uvicorn.run(
        "app.main:app",
        host=settings.SERVER_HOST,
        port=settings.SERVER_PORT,
        reload=settings.DEBUG,
        log_level="info"
    )