# Pre-Deployment Setup Script
# Run this before deploying to check everything is ready

Write-Host "🚀 Pre-Deployment Checker" -ForegroundColor Cyan
Write-Host "=========================" -ForegroundColor Cyan
Write-Host ""

# Check Git
Write-Host "✓ Checking Git status..." -ForegroundColor Yellow
git status --short
Write-Host ""

# Check if .env exists
if (Test-Path "backend\.env") {
    Write-Host "✓ backend\.env exists" -ForegroundColor Green
} else {
    Write-Host "✗ backend\.env missing!" -ForegroundColor Red
}

# Check if .gitignore includes .env
$gitignoreContent = Get-Content ".gitignore" -Raw
if ($gitignoreContent -match "\.env") {
    Write-Host "✓ .env is in .gitignore" -ForegroundColor Green
} else {
    Write-Host "✗ .env not in .gitignore - ADD IT!" -ForegroundColor Red
}

# Check requirements.txt
if (Test-Path "backend\requirements.txt") {
    Write-Host "✓ requirements.txt exists" -ForegroundColor Green
    $reqCount = (Get-Content "backend\requirements.txt" | Measure-Object -Line).Lines
    Write-Host "  → $reqCount dependencies listed" -ForegroundColor Gray
} else {
    Write-Host "✗ requirements.txt missing!" -ForegroundColor Red
}

# Check package.json
if (Test-Path "package.json") {
    Write-Host "✓ package.json exists" -ForegroundColor Green
} else {
    Write-Host "✗ package.json missing!" -ForegroundColor Red
}

Write-Host ""
Write-Host "📝 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Review uncommitted changes above" -ForegroundColor White
Write-Host "2. Commit and push to GitHub:" -ForegroundColor White
Write-Host "   git add ." -ForegroundColor Gray
Write-Host "   git commit -m 'Ready for deployment'" -ForegroundColor Gray
Write-Host "   git push origin main" -ForegroundColor Gray
Write-Host "3. Follow DEPLOY-CHECKLIST.md" -ForegroundColor White
Write-Host ""
Write-Host "4. Generate JWT Secret:" -ForegroundColor White
Write-Host "   python -c 'import secrets; print(secrets.token_urlsafe(32))'" -ForegroundColor Gray
Write-Host ""
