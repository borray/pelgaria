@echo off
echo Deploying to server...

set SERVER=root@194.67.119.74
set REMOTE=/var/www/pelgaria/pelgaria

scp -r C:\Users\turla\Desktop\pelgaria\app %SERVER%:%REMOTE%/
scp -r C:\Users\turla\Desktop\pelgaria\components %SERVER%:%REMOTE%/
scp -r C:\Users\turla\Desktop\pelgaria\lib %SERVER%:%REMOTE%/
scp C:\Users\turla\Desktop\pelgaria\auth.ts %SERVER%:%REMOTE%/
scp C:\Users\turla\Desktop\pelgaria\proxy.ts %SERVER%:%REMOTE%/
scp C:\Users\turla\Desktop\pelgaria\next.config.ts %SERVER%:%REMOTE%/

echo Building...
ssh %SERVER% "cd %REMOTE% && npm run build && pm2 restart most"

echo Done!
pause
