from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os, json, joblib
import numpy as np
from tensorflow.keras.models import load_model

# ================== PATH ==================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")

# ================== LOAD METRICS ==================
if not os.path.exists(METRICS_PATH):
    raise FileNotFoundError("metrics.json not found")

with open(METRICS_PATH, "r", encoding="utf-8") as f:
    metrics = json.load(f)

FEATURE_COLS = metrics["feature_cols"]
LSTM_WINDOW = metrics["lstm_window"]
AVAILABLE_HORIZONS = [1, 7, 14]

# ================== FASTAPI ==================
app = FastAPI(title="Bitcoin Prediction API (Multi-Horizon)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================== SCHEMAS ==================
class PriceInput(BaseModel):
    open: float
    high: float
    low: float
    volume: float
    quote_asset_volume: float
    trades: float
    taker_buy_base: float
    taker_buy_quote: float
    sentiment: float = 0.0   # optional (default neutral)

class Candle(PriceInput):
    time: int
    close: float

# ================== UTILS ==================
def load_tree_model(model: str, h: int):
    model_path = os.path.join(MODEL_DIR, f"{model}+{h}.pkl")
    scaler_path = os.path.join(MODEL_DIR, f"scaler_X_tree+{h}.pkl")

    if not os.path.exists(model_path):
        raise HTTPException(404, f"Model not found: {model}+{h}")

    return joblib.load(model_path), joblib.load(scaler_path)


def load_lstm(h: int):
    paths = {
        "model": f"lstm_model+{h}.keras",
        "sx": f"scaler_X_lstm+{h}.pkl",
        "sy": f"scaler_y_lstm+{h}.pkl",
    }
    for p in paths.values():
        if not os.path.exists(os.path.join(MODEL_DIR, p)):
            raise HTTPException(404, f"Missing LSTM file: {p}")

    return (
        load_model(os.path.join(MODEL_DIR, paths["model"])),
        joblib.load(os.path.join(MODEL_DIR, paths["sx"])),
        joblib.load(os.path.join(MODEL_DIR, paths["sy"])),
    )

# ================== ROUTES ==================
@app.get("/")
def root():
    return {
        "models": ["rf", "gb", "lstm"],
        "horizons": AVAILABLE_HORIZONS,
        "feature_cols": FEATURE_COLS,
        "lstm_window": LSTM_WINDOW,
    }

@app.get("/metrics")
def get_metrics():
    return metrics["results"]

# ---------- RF / GB ----------
@app.post("/predict")
def predict_tree(
    data: PriceInput,
    model: str = Query("rf", regex="^(rf|gb)$"),
    horizon: int = Query(1),
):
    if horizon not in AVAILABLE_HORIZONS:
        raise HTTPException(400, "Invalid horizon")

    model_name = "random_forest" if model == "rf" else "gradient_boosting"
    model_obj, scaler = load_tree_model(model_name, horizon)

    payload = data.model_dump()
    X = np.array([[payload[c] for c in FEATURE_COLS]], dtype=float)
    X_scaled = scaler.transform(X)

    pred = model_obj.predict(X_scaled)[0]

    return {
        "model": model,
        "horizon": f"t+{horizon}",
        "predicted_close": float(pred),
    }

# ---------- LSTM ----------
@app.post("/predict/lstm")
def predict_lstm(
    rows: List[Candle],
    horizon: int = Query(1),
):
    if horizon not in AVAILABLE_HORIZONS:
        raise HTTPException(400, "Invalid horizon")

    if len(rows) <= LSTM_WINDOW:
        raise HTTPException(400, f"Need > {LSTM_WINDOW} candles")

    lstm, scaler_X, scaler_y = load_lstm(horizon)

    raw = np.array([[r.model_dump()[c] for c in FEATURE_COLS] for r in rows])
    X_scaled = scaler_X.transform(raw)

    X_seq = []
    for i in range(LSTM_WINDOW, len(X_scaled)):
        X_seq.append(X_scaled[i - LSTM_WINDOW:i])

    X_seq = np.array(X_seq)

    pred_scaled = lstm.predict(X_seq, verbose=0)
    pred = scaler_y.inverse_transform(pred_scaled).flatten()

    return {
        "model": "lstm",
        "horizon": f"t+{horizon}",
        "points": len(pred),
        "series": [
            {
                "time": rows[i + LSTM_WINDOW].time,
                "actual_close": rows[i + LSTM_WINDOW].close,
                "predicted_close": float(pred[i]),
            }
            for i in range(len(pred))
        ],
    }
