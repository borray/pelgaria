#!/bin/bash
# Запускать один раз на сервере под пользователем sonar
# bash setup-server.sh

set -e

APP_DIR="/home/sonar/app"

echo "=== Создание директорий ==="
mkdir -p "$APP_DIR/dist"
mkdir -p "$APP_DIR/prisma"
mkdir -p "$APP_DIR/uploads"
mkdir -p "$APP_DIR/public"

echo "=== Настройка PM2 автозапуска ==="
pm2 startup systemd -u sonar --hp /home/sonar
pm2 save

echo "=== Настройка прав на uploads ==="
chmod 755 "$APP_DIR/uploads"

echo ""
echo "=== Готово! ==="
echo "После первого деплоя через GitHub Actions сервер запустится автоматически."
echo ""
echo "Полезные команды:"
echo "  pm2 logs sonar        — логи приложения"
echo "  pm2 status            — статус процессов"
echo "  pm2 restart sonar     — перезапуск"
echo "  tail -f /var/log/nginx/error.log  — логи nginx"
