# Деплой на GitHub Pages

Если в Actions падает **deploy** с ошибкой **404** / *Failed to create deployment*:

## 1. Включить Pages и указать источник «GitHub Actions»

1. Репозиторий → **Settings** → **Pages** (слева).
2. Блок **Build and deployment** → **Source**: выбери **GitHub Actions** (не «Deploy from a branch»).
3. Сохрани, если есть кнопка сохранения.

Без этого шага API деплоя возвращает **404**.

## 2. Права для Actions

1. **Settings** → **Actions** → **General**.
2. Внизу **Workflow permissions**:
   - включи **Read and write permissions**;
   - при необходимости отметь **Allow GitHub Actions to create and approve pull requests**.

## 3. Запустить workflow снова

**Actions** → workflow **Deploy to GitHub Pages** → **Run workflow** (или новый push в `main`).

## Адрес сайта

После успешного деплоя: **https://isvaya.github.io/fifa/**

(имя репозитория `fifa` = подпапка в URL; это учтено в `VITE_BASE_PATH=/fifa/` при сборке.)
