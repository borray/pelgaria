#!/bin/bash
# Резервное копирование БД Пельгарии
# Запускать вручную или через cron: 0 3 * * * /var/www/pelgaria/pelgaria/backup.sh

DB_PATH="/var/www/pelgaria/pelgaria/pelgaria.db"
BACKUP_DIR="/var/www/pelgaria/backups"
DATE=$(date +"%Y-%m-%d_%H-%M")
BACKUP_FILE="$BACKUP_DIR/pelgaria_$DATE.db"

mkdir -p "$BACKUP_DIR"

# Используем sqlite3 .backup для безопасного копирования (работает даже при активных запросах)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

echo "Бэкап создан: $BACKUP_FILE ($(du -sh "$BACKUP_FILE" | cut -f1))"

# Удалить бэкапы старше 30 дней
find "$BACKUP_DIR" -name "pelgaria_*.db" -mtime +30 -delete
echo "Старые бэкапы удалены (>30 дней)"
