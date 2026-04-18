$SERVER = "root@194.67.119.74"
$LOCAL = "C:\Users\turla\Desktop\pelgaria"
$REMOTE = "/var/www/pelgaria/pelgaria"
$gitBash = "C:\Program Files\Git\bin\bash.exe"

Write-Host "Packaging files..." -ForegroundColor Cyan

& $gitBash -c "cd '/c/Users/turla/Desktop/pelgaria' && tar czf /tmp/pelgaria-deploy.tar.gz app components lib auth.ts proxy.ts next.config.ts package.json package-lock.json"

Write-Host "Uploading..." -ForegroundColor Cyan
scp "/tmp/pelgaria-deploy.tar.gz" "${SERVER}:/tmp/"

Write-Host "Extracting, building, restarting..." -ForegroundColor Cyan
ssh $SERVER @"
set -e
cd $REMOTE

# Create swap if not exists (prevents OOM during build)
if [ ! -f /swapfile ]; then
  echo 'Creating 1GB swapfile...'
  fallocate -l 1G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo 'Swap created.'
fi

tar xzf /tmp/pelgaria-deploy.tar.gz
rm /tmp/pelgaria-deploy.tar.gz
npm install --prefer-offline 2>/dev/null || npm install

# Limit Node memory to avoid OOM (512MB is enough for build)
NODE_OPTIONS='--max-old-space-size=512' npm run build

/usr/bin/pm2 restart most
echo 'Deploy complete!'
"@

Write-Host "Done! Site updated." -ForegroundColor Green
