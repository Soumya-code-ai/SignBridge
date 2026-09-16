"""
SignBridge WLASL backend.

Receives MediaPipe pose + hand keypoints from the Angular client over a
WebSocket (coordinates, not video frames -- keeps payload under 1KB per
frame), buffers a per-connection sliding window, and returns gloss
predictions once enough frames have accumulated.

Run:
    uvicorn main:app --reload --port 8000
"""
import asyncio
import json
import logging
import os
from collections import deque
from typing import Any

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from model import load_model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("signbridge-backend")

app = FastAPI(title="SignBridge WLASL Backend")

allowed_origins = [
    origin.strip()
    for origin in os.environ.get("SIGNBRIDGE_ALLOWED_ORIGINS", "http://localhost:4200").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

WINDOW_SIZE = 45   # ~3.75s at the frontend's 12fps target -- long enough to cover one sign
STRIDE = 8         # run inference every 8th new frame once the window is full, not every frame
NUM_KEYPOINTS = 75  # 33 pose + 21 left hand + 21 right hand, x/y only
SUPPORTED_LANGUAGES = {"isl", "asl", "bsl", "auslan", "lsf"}

model = load_model()
logger.info("Loaded model: %s", type(model).__name__)


@app.get("/health")
@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "model": type(model).__name__,
        "supported_languages": sorted(SUPPORTED_LANGUAGES),
    }


@app.get("/languages")
@app.get("/api/languages")
def languages():
    return {"languages": sorted(SUPPORTED_LANGUAGES)}


@app.post("/translate")
@app.post("/api/translate")
def translate_http(payload: dict[str, Any]):
    """Stateless prediction endpoint for Vercel's serverless runtime.

    Vercel functions cannot hold a WebSocket connection, so the frontend
    sends its current 45-frame window over HTTP when deployed there.
    """
    language = str(payload.get("language", "isl")).lower()
    points = payload.get("keypoints")
    if language not in SUPPORTED_LANGUAGES:
        return {"type": "error", "error": "Unsupported sign language"}
    if not isinstance(points, list) or len(points) != WINDOW_SIZE * NUM_KEYPOINTS * 2:
        return {"type": "error", "error": "Expected a complete keypoint window"}

    window = np.array(points, dtype=np.float32).reshape(WINDOW_SIZE, NUM_KEYPOINTS, 2)
    gloss, confidence = model.predict(window)
    if gloss is None:
        return {"type": "idle", "language": language}
    return {
        "type": "prediction",
        "gloss": gloss,
        "confidence": confidence,
        "language": language,
    }


@app.websocket("/ws/translate")
async def translate(ws: WebSocket):
    await ws.accept()
    language = ws.query_params.get("language", "isl").lower()
    if language not in SUPPORTED_LANGUAGES:
        await ws.close(code=1008, reason="Unsupported sign language")
        return
    window: "deque[np.ndarray]" = deque(maxlen=WINDOW_SIZE)
    frames_since_inference = 0
    loop = asyncio.get_event_loop()

    # Keep one stable result per signing episode so the UI does not flicker
    # while the sliding window advances through the same gesture.
    episode_active = False
    episode_gloss: str | None = None
    last_sent_gloss: str | None = None

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            if msg.get("type") != "frame":
                continue

            points = msg.get("keypoints")
            if not points or len(points) != NUM_KEYPOINTS * 2:
                logger.warning("Dropped frame with unexpected keypoint length: %s", len(points or []))
                continue

            frame = np.array(points, dtype=np.float32).reshape(NUM_KEYPOINTS, 2)
            window.append(frame)
            frames_since_inference += 1

            # The main backend-side lever against latency and thermal load:
            # inference only runs once the window is full, and then only
            # every STRIDE frames -- buffering itself is cheap, inference
            # is the expensive step, so this is what actually saves CPU.
            if len(window) == WINDOW_SIZE and frames_since_inference >= STRIDE:
                frames_since_inference = 0
                window_array = np.stack(window, axis=0)  # (T, K, 2)
                gloss, confidence = await loop.run_in_executor(None, model.predict, window_array)

                if gloss is None:
                    # No active signing -- end any episode and clear a
                    # stale word from the frontend rather than leaving
                    # it displayed indefinitely.
                    episode_active, episode_gloss = False, None
                    if last_sent_gloss is not None:
                        last_sent_gloss = None
                        await ws.send_json({"type": "idle"})
                    continue

                if not episode_active:
                    episode_active, episode_gloss = True, gloss

                if episode_gloss != last_sent_gloss:
                    last_sent_gloss = episode_gloss
                    await ws.send_json({
                        "type": "prediction",
                        "gloss": episode_gloss,
                        "confidence": confidence,
                        "language": language,
                    })

    except WebSocketDisconnect:
        logger.info("Client disconnected")
