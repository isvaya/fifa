# Бэкенд: заявка → Telegram

Деплой на **Railway** (или любой Node-хостинг с `PORT`).

## Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
2. Если в репозитории есть и `FIFA/`, и `backend/`: в настройках сервиса → **Settings → Root Directory** → `backend`.
3. **Variables** (или вкладка Variables):

   | Variable | Значение |
   |----------|----------|
   | `TELEGRAM_BOT_TOKEN` | токен от @BotFather |
   | `TELEGRAM_CHAT_ID` | `chat.id` из `getUpdates` |
   | `ALLOWED_ORIGINS` | origins сайта через запятую, **без** слэша в конце |

   Пример `ALLOWED_ORIGINS` для GitHub Pages:

   `https://isvaya.github.io,http://localhost:5173,http://127.0.0.1:5173`

   `PORT` Railway подставит сам — не задавайте вручную.

4. После деплоя откройте **Settings → Networking → Generate Domain** (публичный URL).
5. Проверка: `GET https://ВАШ-ДОМЕН.railway.app/health` → `{"ok":true}`.
6. URL для сайта: `https://ВАШ-ДОМЕН.railway.app/api/order` (полная строка).

## Связка с сайтом (FIFA)

В **`FIFA/.env`** и в GitHub **Secrets** для Pages:

- `VITE_ORDER_API_URL` = `https://ВАШ-ДОМЕН.railway.app/api/order`
- `VITE_FORMSPREE_FORM_ID` = как раньше (письма на почту)

Тогда форма шлёт **параллельно** в Formspree и сюда (Telegram).

**Mailto** (`VITE_ORDER_EMAIL`) на фронте используется только если **нет** ни Formspree, ни `VITE_ORDER_API_URL` — для продакшена задайте оба канала выше; mailto можно оставить пустым или как запасной сценарий без API.

## Локально

```bash
cp .env.example .env
# заполнить TELEGRAM_*, при необходимости ALLOWED_ORIGINS
npm install
npm start
```
