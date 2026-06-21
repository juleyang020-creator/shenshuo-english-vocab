#!/bin/zsh
set -e

APP_DIR="${0:A:h}"
PORT="5173"
URL="http://127.0.0.1:${PORT}/"
LOG_FILE="${APP_DIR}/output/playwright/dev-server.log"

cd "$APP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
  echo "没有找到 Node.js/npm，无法启动本地学习软件。"
  echo "请先安装 Node.js，或把这个窗口截图发给 Codex 处理。"
  read -k "?按任意键关闭..."
  exit 1
fi

if ! lsof -ti tcp:${PORT} >/dev/null 2>&1; then
  echo "正在启动申硕英语词汇学习..."
  nohup npm run dev > "$LOG_FILE" 2>&1 &
  sleep 2
fi

if [ -d "/Applications/Google Chrome Beta.app" ]; then
  open -a "Google Chrome Beta" "$URL"
elif [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "$URL"
else
  open "$URL"
fi

echo "已打开：$URL"
echo "这个窗口可以关闭，学习软件会继续在浏览器中运行。"
