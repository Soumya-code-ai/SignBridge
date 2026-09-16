"""
Pluggable gloss-prediction model for the WLASL pipeline.

Two implementations live here:

    - StubGlossModel: zero extra dependencies beyond numpy. Uses stable
        hand landmark geometry for a small, explicit counter vocabulary, so
        ambiguous movement is reported as idle instead of a guessed word.

  - PoseTGCNModel: a skeleton spatio-temporal graph-conv network shaped
    like Pose-TGCN (keypoints in, gloss logits out). This is NOT the
    published WLASL checkpoint's exact module graph -- it defines a
    compatible *interface* so the rest of the system (batching,
    WebSocket transport, frontend rendering) never has to change when
    you swap it for the real thing. See load_model() below for exactly
    where the real checkpoint plugs in.

Model selection is automatic: if torch is installed AND a checkpoint
path is configured via the WLASL_CHECKPOINT env var, PoseTGCNModel is
used; otherwise the server falls back to StubGlossModel.
"""
from __future__ import annotations

import os
from typing import Optional, Protocol, Tuple

import numpy as np


class GlossModel(Protocol):
    def predict(self, window: np.ndarray) -> Tuple[Optional[str], float]:
        """window: (T, K, 2) float32 array of normalised x/y keypoints.
        Returns (None, 0.0) when no active signing is detected."""
        ...


DEMO_PATTERNS = {
    "hello": (True, True, True, True, True),
    "yes": (True, False, False, False, False),
    "no": (True, False, True, False, False),
    "help": (True, True, False, False, False),
    "thank-you": (True, True, True, False, False),
    "bathroom": (True, True, True, True, False),
    "emergency": (False, True, True, True, True),
}


class StubGlossModel:
    """Conservative landmark heuristic used when no trained checkpoint exists.

    It only returns a word when a visible hand has a stable, known finger
    pattern and the window contains enough movement to indicate a signing
    episode. Ambiguous motion is reported as idle instead of being converted
    into a random vocabulary item.
    """

    MIN_HAND_FRAMES = 12
    MIN_EPISODE_MOTION = 0.0015
    MIN_CONFIDENCE = 0.64

    def predict(self, window: np.ndarray) -> Tuple[str | None, float]:
        if window.shape[0] < 2:
            return None, 0.0

        hand_frames = window[:, 33:, :]
        visible = np.linalg.norm(hand_frames, axis=-1).max(axis=1) > 0
        if int(visible.sum()) < self.MIN_HAND_FRAMES:
            return None, 0.0

        visible_window = hand_frames[visible]
        motion = float(np.linalg.norm(np.diff(visible_window, axis=0), axis=-1).mean())
        if motion < self.MIN_EPISODE_MOTION:
            return None, 0.0

        patterns = []
        for frame in visible_window:
            # Prefer the first visible hand; a second hand is included only
            # when the first hand is absent in that frame.
            hand = frame[:21] if np.linalg.norm(frame[:21], axis=-1).max() > 0 else frame[21:]
            wrist = hand[0]
            distances = lambda indices: np.linalg.norm(hand[indices] - wrist, axis=-1)
            tips = distances([4, 8, 12, 16, 20])
            bases = distances([2, 6, 10, 14, 18])
            patterns.append(tuple((tips > bases * 1.15).tolist()))

        pattern_counts = {}
        for pattern in patterns:
            pattern_counts[pattern] = pattern_counts.get(pattern, 0) + 1
        pattern, count = max(pattern_counts.items(), key=lambda item: item[1])
        gloss = next((name for name, expected in DEMO_PATTERNS.items() if expected == pattern), None)
        confidence = count / len(patterns)
        if gloss is None or confidence < self.MIN_CONFIDENCE:
            return None, 0.0
        return gloss, round(confidence, 2)


try:
    import torch
    import torch.nn as nn

    class PoseTGCNModel(nn.Module):
        """
        Skeleton spatio-temporal graph-conv net shaped like Pose-TGCN.
        Randomly initialised -- correct interface, not correct weights.

        To use the real WLASL model:
          1. Get the model class + skeleton adjacency matrix from the
             WLASL / Pose-TGCN authors' repo. Their released weights
             are research-use licensed -- check the terms before using
             them beyond a hackathon demo.
          2. Either replace this class with theirs outright, or make
             sure every layer name and shape here matches their
             state_dict before calling load_state_dict.
          3. Load their gloss label map (class index -> English word)
             into self.vocab instead of the placeholder below.
        """

        def __init__(self, num_keypoints: int = 75, num_classes: int = 2000, hidden: int = 64):
            super().__init__()
            self.spatial = nn.Linear(num_keypoints * 2, hidden)
            self.temporal = nn.GRU(hidden, hidden, batch_first=True)
            self.classifier = nn.Linear(hidden, num_classes)
            self.vocab = [f"gloss_{i}" for i in range(num_classes)]  # replace with the real label map

        def forward(self, x: "torch.Tensor") -> "torch.Tensor":
            b, t, k, c = x.shape
            x = x.reshape(b, t, k * c)
            x = torch.relu(self.spatial(x))
            _, h = self.temporal(x)
            return self.classifier(h.squeeze(0))

        def predict(self, window: np.ndarray) -> Tuple[str, float]:
            self.eval()
            with torch.no_grad():
                x = torch.from_numpy(window).float().unsqueeze(0)
                probs = torch.softmax(self.forward(x), dim=-1)[0]
                idx = int(torch.argmax(probs))
                return self.vocab[idx], float(probs[idx])

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    PoseTGCNModel = None  # type: ignore


def load_model() -> GlossModel:
    checkpoint_path = os.environ.get("WLASL_CHECKPOINT")
    if TORCH_AVAILABLE and checkpoint_path and os.path.exists(checkpoint_path):
        model = PoseTGCNModel()
        state_dict = torch.load(checkpoint_path, map_location="cpu")
        model.load_state_dict(state_dict)  # raises if shapes don't match the real repo's class
        return model
    return StubGlossModel()
