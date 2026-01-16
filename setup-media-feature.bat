@echo off
REM Media Feature Setup Script for Windows

echo 🚀 Setting up Media Sharing Feature...

REM Create uploads directory
echo 📁 Creating uploads directory...
if not exist "backend\uploads" mkdir "backend\uploads"
echo ✅ Uploads directory created

REM Run database migration
echo 🗄️  Running database migration...
cd backend
call alembic upgrade head
cd ..
echo ✅ Database migration complete

REM Create .gitignore entry for uploads
echo 📝 Updating .gitignore...
findstr /C:"backend/uploads/" .gitignore >nul 2>&1
if errorlevel 1 (
    echo backend/uploads/ >> .gitignore
    echo ✅ Added uploads directory to .gitignore
) else (
    echo ℹ️  Uploads directory already in .gitignore
)

echo.
echo ✅ Media feature setup complete!
echo.
echo 📋 Next steps:
echo 1. Restart your backend server
echo 2. Test file upload at: http://localhost:8000/docs
echo 3. Integrate MediaUpload and MediaPreview components in your chat UI
echo.
echo 📖 See MEDIA_FEATURE_GUIDE.md for integration examples
pause
