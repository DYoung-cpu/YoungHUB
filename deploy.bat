@echo off
echo Deploying to GitHub...
git add -A
git commit -m "Update from local development"
git push origin main
echo.
echo Deployment complete! Check https://young-hub.vercel.app in 30 seconds.
pause