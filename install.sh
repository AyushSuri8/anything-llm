#!/usr/bin/env bash
#
# UsingOpen installer (Linux, v1).
# Installs the bundled model runtime (Ollama), pulls the default model,
# and runs the UsingOpen container. Re-runs are safe (idempotent).
#
#   curl -fsSL https://raw.githubusercontent.com/AyushSuri8/usingopen/master/install.sh | bash
#   bash install.sh --model qwen3.5:4b --port 3001 --storage ~/.usingopen
#
set -euo pipefail

IMAGE="${USINGOPEN_IMAGE:-ghcr.io/ayushsuri8/usingopen:latest}"
MODEL="${USINGOPEN_MODEL:-qwen3.5:4b}"
PORT="${USINGOPEN_PORT:-3001}"
STORAGE="${USINGOPEN_STORAGE:-$HOME/.usingopen}"
CONTAINER_NAME="${USINGOPEN_CONTAINER:-usingopen}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --image) IMAGE="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    --port) PORT="$2"; shift 2 ;;
    --storage) STORAGE="$2"; shift 2 ;;
    --name) CONTAINER_NAME="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: install.sh [--image IMG] [--model MODEL] [--port PORT] [--storage DIR] [--name NAME]"
      exit 0 ;;
    *) echo "Unknown flag: $1" >&2; exit 1 ;;
  esac
done

log()  { printf '\033[1;32m[usingopen]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[usingopen]\033[0m %s\n' "$*"; }
fail() { printf '\033[1;31m[usingopen]\033[0m %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null || fail "docker is required: https://docs.docker.com/engine/install/"
command -v curl >/dev/null || fail "curl is required."
docker info >/dev/null 2>&1 || fail "docker daemon is not running."

# ---- 1. Model runtime (Ollama-compatible API on :11434) ----
if ! command -v ollama >/dev/null; then
  log "Installing Ollama runtime..."
  curl -fsSL https://ollama.com/install.sh | sh
else
  log "Ollama runtime already installed ($(ollama --version 2>/dev/null | head -n 1))."
fi
export OLLAMA_MODELS="${OLLAMA_MODELS:-$STORAGE/ollama-models}"
mkdir -p "$OLLAMA_MODELS"
if ! curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  log "Starting Ollama serve..."
  export OLLAMA_HOST="${OLLAMA_HOST:-0.0.0.0:11434}"
  nohup ollama serve >"$STORAGE/ollama.log" 2>&1 &
  for _ in $(seq 1 30); do
    curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
    sleep 1
  done
fi
curl -sf http://127.0.0.1:11434/api/tags >/dev/null 2>&1 \
  || fail "Ollama API did not come up on :11434 (see $STORAGE/ollama.log)."

# ---- 2. Default model ----
if ! ollama list 2>/dev/null | grep -q "^${MODEL%%:*}"; then
  log "Pulling model $MODEL (one-time download)..."
  ollama pull "$MODEL"
else
  log "Model $MODEL already present."
fi

# ---- 3. UsingOpen container ----
mkdir -p "$STORAGE/app-storage"
if docker ps -a --format '{{.Names}}' | grep -qx "$CONTAINER_NAME"; then
  log "Removing previous $CONTAINER_NAME container..."
  docker rm -f "$CONTAINER_NAME" >/dev/null
fi
log "Starting UsingOpen ($IMAGE)..."
docker run -d --name "$CONTAINER_NAME" --restart unless-stopped \
  -p "${PORT}:3001" --cap-add SYS_ADMIN \
  --add-host=host.docker.internal:host-gateway \
  -v "$STORAGE/app-storage:/app/server/storage" \
  -e STORAGE_DIR="/app/server/storage" \
  "$IMAGE" >/dev/null

log "Waiting for first boot (runtime auto-detection runs now)..."
for _ in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${PORT}/" || echo 000)
  [ "$code" = "200" ] && break
  sleep 2
done

# ---- 4. First-run wiring (same calls as a fresh onboarding) ----
curl -s -X POST "http://127.0.0.1:${PORT}/api/system/update-env" \
  -H "Content-Type: application/json" \
  -d "{\"LLMProvider\":\"ollama\",\"EmbeddingEngine\":\"native\",\"VectorDB\":\"lancedb\",\"OllamaLLMBasePath\":\"http://host.docker.internal:11434\",\"OllamaLLMModelPref\":\"$MODEL\"}" \
  >/dev/null
curl -s -X POST "http://127.0.0.1:${PORT}/api/onboarding" >/dev/null
curl -s -X POST "http://127.0.0.1:${PORT}/api/workspace/new" \
  -H "Content-Type: application/json" -d '{"name":"quickstart"}' >/dev/null || true

log "Done. Open http://localhost:${PORT} and start chatting."
log "Data lives in $STORAGE (safe to keep across upgrades; re-run this script to update)."
