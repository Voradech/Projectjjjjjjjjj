from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os, json, joblib
import numpy as np
from tensorflow.keras.models import load_model

# ================= PATH =================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "model")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")

# ================= LOAD METRICS =================
if not os.path.exists(METRICS_PATH):
    raise RuntimeError("metrics.json not found – train model first")

with open(METRICS_PATH, "r", encoding="utf-8") as f:
    metrics = json.load(f)

FEATURE_COLS = [
    "open",
    "high",
    "low",
    "volume",
    "quote_asset_volume",
    "trades",
    "taker_buy_base",
    "taker_buy_quote",
    "sentiment",
]

LSTM_WINDOW = 30
HORIZONS = [1, 7, 14]
# ================= FASTAPI =================
app = FastAPI(title="Bitcoin Prediction API (Multi-Horizon)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ================= SCHEMAS =================
class PriceInput(BaseModel):
    open: float
    high: float
    low: float
    volume: float
    quote_asset_volume: float
    trades: float
    taker_buy_base: float
    taker_buy_quote: float
    sentiment: float = 0.0

class Candle(PriceInput):
    time: int
    close: float

# ================= UTILS =================
def load_tree(model: str, h: int):
    model_path = os.path.join(MODEL_DIR, f"{model}+{h}.pkl")
    scaler_path = os.path.join(MODEL_DIR, f"scaler_X_tree+{h}.pkl")

    if not os.path.exists(model_path):
        raise HTTPException(404, f"Model not found: {model}+{h}")

    return joblib.load(model_path), joblib.load(scaler_path)

def load_lstm(h: int):
    return (
        load_model(os.path.join(MODEL_DIR, f"lstm_model+{h}.keras")),
        joblib.load(os.path.join(MODEL_DIR, f"scaler_X_lstm+{h}.pkl")),
    )


# ================= ROUTES =================
@app.get("/")
def root():
    return {
        "models": ["rf", "gb", "lstm"],
        "horizons": HORIZONS,
        "feature_cols": FEATURE_COLS,
        "lstm_window": LSTM_WINDOW,
    }
@app.get("/metrics")
def get_metrics():
    return metrics

# ---------- RF / GB ----------
@app.post("/predict")
def predict_tree(
    data: PriceInput,
    model: str = Query("rf", regex="^(rf|gb)$"),
    horizon: int = Query(1),    
):
    if horizon not in HORIZONS:
        raise HTTPException(400, "Invalid horizon")

    model_name = "random_forest" if model == "rf" else "gradient_boosting"
    model_obj, scaler = load_tree(model_name, horizon)

    payload = data.model_dump()
    X = np.array([[payload[c] for c in FEATURE_COLS]], dtype=float)
    X_scaled = scaler.transform(X)

    pred = model_obj.predict(X_scaled)[0]
    trend = "UP" if int(pred) == 1 else "DOWN"

    return {
        "model": model,
        "horizon": f"t+{horizon}",
        "trend": trend,
        "signal": "BUY" if trend == "UP" else "SELL",
        "confidence": 0.7
    }



# ---------- LSTM ----------
@app.post("/predict/lstm")
def predict_lstm(
    rows: List[Candle],
    horizon: int = Query(1),
):
    if horizon not in HORIZONS:
        raise HTTPException(400, "Invalid horizon")
    if len(rows) <= LSTM_WINDOW:
        raise HTTPException(400, f"Need > {LSTM_WINDOW} candles")

    lstm, scaler_X = load_lstm(horizon)

    raw = np.array([[r.model_dump()[c] for c in FEATURE_COLS] for r in rows])
    X_scaled = scaler_X.transform(raw)

    X_seq = []
    for i in range(LSTM_WINDOW, len(X_scaled)):
        X_seq.append(X_scaled[i - LSTM_WINDOW:i])
    X_seq = np.array(X_seq)

    probs = lstm.predict(X_seq, verbose=0)
    pred = np.argmax(probs, axis=1)

    ups = []
    downs = []

    for i in range(len(pred)):
        item = {
            "trend": "UP" if pred[i] == 1 else "DOWN",
            "confidence": float(np.max(probs[i]))
        }
        if item["trend"] == "UP":
            ups.append(item)
        else:
            downs.append(item)

    if len(ups) > len(downs):
        trend = "UP"
        signal = "BUY"
        confidence = float(np.mean([x["confidence"] for x in ups]))
    else:
        trend = "DOWN"
        signal = "SELL"
        confidence = float(np.mean([x["confidence"] for x in downs]))

    # ---------- final response ----------
    return {
        "model": "lstm",
        "horizon": f"t+{horizon}",
        "trend": trend,
        "signal": signal,
        "confidence": round(confidence, 2),
        "series": [
            {
                "time": rows[i + LSTM_WINDOW].time,
                "trend": "UP" if pred[i] == 1 else "DOWN",
                "confidence": float(np.max(probs[i]))
            }
            for i in range(len(pred))
        ],
    }



@app.post("/predict/trend")
def predict_trend(
    data: PriceInput,
    horizon: int = Query(7)
):
    if horizon not in HORIZONS:
        raise HTTPException(400, "Invalid horizon")

    model, scaler = load_tree("random_forest", horizon)

    X = np.array([[data.model_dump()[c] for c in FEATURE_COLS]])
    X_scaled = scaler.transform(X)

    pred = int(model.predict(X_scaled)[0])

    return {
        "trend": "UP" if pred == 1 else "DOWN",
        "confidence": 0.7,  # RF ไม่มี prob ที่ stable มาก
        "horizon": f"t+{horizon}"
    }
