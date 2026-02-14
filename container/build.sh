#!/bin/bash
# Build the NanoClaw agent container image
# Supports Apple Container (macOS) and Podman (Linux)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

IMAGE_NAME="nanoclaw-agent"
TAG="${1:-latest}"

# Auto-detect backend from platform (override with CONTAINER_BACKEND env var)
if [ -z "$CONTAINER_BACKEND" ]; then
  case "$(uname -s)" in
    Darwin) CONTAINER_BACKEND="apple" ;;
    *)      CONTAINER_BACKEND="podman" ;;
  esac
fi

echo "Building NanoClaw agent container image..."
echo "Image: ${IMAGE_NAME}:${TAG}"
echo "Backend: ${CONTAINER_BACKEND}"

if [ "$CONTAINER_BACKEND" = "podman" ]; then
  podman build -t "localhost/${IMAGE_NAME}:${TAG}" .

  FULL_IMAGE="localhost/${IMAGE_NAME}:${TAG}"
  RUN_CMD="podman"
  RUNTIME_FLAG=""
  if [ -n "$CONTAINER_RUNTIME" ]; then
    RUNTIME_FLAG="--runtime $CONTAINER_RUNTIME"
  fi
else
  # Apple Container (macOS)
  container build -t "${IMAGE_NAME}:${TAG}" .

  FULL_IMAGE="${IMAGE_NAME}:${TAG}"
  RUN_CMD="container"
  RUNTIME_FLAG=""
fi

echo ""
echo "Build complete!"
echo "Image: ${FULL_IMAGE}"
echo ""
echo "Test with:"
echo "  echo '{\"prompt\":\"What is 2+2?\",\"groupFolder\":\"test\",\"chatJid\":\"test@g.us\",\"isMain\":false}' | ${RUN_CMD} run -i ${RUNTIME_FLAG} ${FULL_IMAGE}"
