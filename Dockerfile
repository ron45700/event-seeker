# Stage 1: build the UI. vite.config.ts writes the static build to ../web.
FROM node:24-alpine AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: the server, with the built UI inside the image.
FROM python:3.13-slim
# Event times are stored as Israel local time and compared with the clock, so the
# container must not run in UTC.
ENV TZ=Asia/Jerusalem \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ app/
COPY --from=web /src/web/ web/

# The database and the thumbnail cache. Mount a folder here to keep them.
VOLUME /app/data
EXPOSE 8765
HEALTHCHECK --interval=1m --timeout=10s --start-period=20s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/health', timeout=5)"
CMD ["python", "-m", "app.main", "serve"]
