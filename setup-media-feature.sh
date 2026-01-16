#!/bin/bash

# Media Feature Setup Script

echo "🚀 Setting up Media Sharing Feature..."

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p backend/uploads
echo "✅ Uploads directory created"

# Run database migration
echo "🗄️  Running database migration..."
cd backend
alembic upgrade head
cd ..
echo "✅ Database migration complete"

# Create .gitignore entry for uploads
echo "📝 Updating .gitignore..."
if ! grep -q "backend/uploads/" .gitignore 2>/dev/null; then
    echo "backend/uploads/" >> .gitignore
    echo "✅ Added uploads directory to .gitignore"
else
    echo "ℹ️  Uploads directory already in .gitignore"
fi

echo ""
echo "✅ Media feature setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Restart your backend server"
echo "2. Test file upload at: http://localhost:8000/docs"
echo "3. Integrate MediaUpload and MediaPreview components in your chat UI"
echo ""
echo "📖 See MEDIA_FEATURE_GUIDE.md for integration examples"
