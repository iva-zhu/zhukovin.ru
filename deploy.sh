#!/bin/bash

# ========================================
# Deploy-скрипт для сайта
# ========================================

SERVER="ivan@zhukovin.ru"
SITE="zhukovin.ru"
LOCAL_DIR="$HOME/zhukovin.ru"
REMOTE_DIR="/var/www/zhukovin"

# BPM-калькулятор: единственный источник правды — bpm-tool
BPM_SRC="$HOME/Nextcloud/Code/bpm-tool"
BPM_DEST="$LOCAL_DIR/static/bpm"

cd "$LOCAL_DIR"

echo "🧮 Синхронизирую BPM из $BPM_SRC..."
# бамп версии service worker, чтобы PWA не отдавала старый кэш
ver=$(grep -oE "bpmtool-v[0-9]+" "$BPM_SRC/sw.js" | grep -oE "[0-9]+$" | head -1)
if [ -n "$ver" ]; then
  new=$((ver + 1))
  sed -i.bak "s/bpmtool-v${ver}/bpmtool-v${new}/" "$BPM_SRC/sw.js" && rm -f "$BPM_SRC/sw.js.bak"
  echo "   cache: v${ver} → v${new}"
fi
mkdir -p "$BPM_DEST"
# только 10 файлов модуля; test.js/Makefile/deploy.sh/.git и прочее не копируются,
# а лишнее из static/bpm удаляется (--delete-excluded + белый список)
rsync -a --delete --delete-excluded \
  --include='index.html' --include='lib.js' --include='compressor-lib.js' --include='sw.js' \
  --include='manifest.webmanifest' --include='icon.svg' \
  --include='icon-180.png' --include='icon-192.png' --include='icon-512.png' \
  --include='og.png' --exclude='*' \
  "$BPM_SRC/" "$BPM_DEST/"

echo "🔨 Собираю $SITE..."
hugo || { echo "❌ Hugo: сборка упала, деплой остановлен"; exit 1; }

echo "📤 Заливаю на сервер..."
# каталог принадлежит http:http, поэтому заливка идёт от root через sudo rsync
rsync -avz --rsync-path="sudo rsync" public/ "$SERVER:$REMOTE_DIR/" \
  || { echo "❌ rsync: заливка упала, деплой остановлен"; exit 1; }

echo "🔐 Исправляю права и владельца..."
ssh "$SERVER" "sudo chown -R http:http $REMOTE_DIR/ && sudo chmod -R 644 $REMOTE_DIR/ && sudo find $REMOTE_DIR/ -type d -exec chmod 755 {} \;"

echo "✅ Сайт $SITE готов!"
echo "🌐 https://$SITE"

# ========================================
# Будущие сайты (раскомментируй, когда понадобится):
# ========================================

# --- zhukovin.ru (личный сайт) ---
# SITE="zhukovin.ru"
# LOCAL_DIR="$HOME/zhukovin.ru"
# REMOTE_DIR="/var/www/zhukovin.ru"
# cd "$LOCAL_DIR" && hugo
# rsync -avz --delete public/ "$SERVER:$REMOTE_DIR/"

# --- barter.zhukovin.ru (бартер) ---
# SITE="barter.zhukovin.ru"
# LOCAL_DIR="$HOME/barter.zhukovin.ru"
# REMOTE_DIR="/var/www/barter.zhukovin.ru"
# cd "$LOCAL_DIR" && hugo
# rsync -avz --delete public/ "$SERVER:$REMOTE_DIR/"

# --- store.zhukovin.ru (магазин) ---
# SITE="store.zhukovin.ru"
# LOCAL_DIR="$HOME/store.zhukovin.ru"
# REMOTE_DIR="/var/www/store.zhukovin.ru"
# cd "$LOCAL_DIR" && hugo
# rsync -avz --delete public/ "$SERVER:$REMOTE_DIR/"
