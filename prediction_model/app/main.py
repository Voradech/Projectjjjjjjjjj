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
        joblib.load(os.path.join(MODEL_DIR, f"scaler_y_lstm+{h}.pkl")),
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
    if horizon not in HORIZONS:
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

@app.post("/predict/lstm/recursive")
def predict_lstm_recursive(
    rows: List[Candle],
    steps: int = Query(7),
):
    if steps < 1 or steps > 14:
        raise HTTPException(400, "steps must be 1-14")
    if len(rows) <= LSTM_WINDOW:
        raise HTTPException(400, f"Need > {LSTM_WINDOW} candles")

    # ใช้ horizon = 1 เสมอ
    lstm, scaler_X, scaler_y = load_lstm(1)

    data = rows.copy()
    results = []

    for step in range(steps):
        raw = np.array([[r.model_dump()[c] for c in FEATURE_COLS] for r in data])
        X_scaled = scaler_X.transform(raw)

        X_seq = np.array([X_scaled[-LSTM_WINDOW:]])
        pred_scaled = lstm.predict(X_seq, verbose=0)
        pred = scaler_y.inverse_transform(pred_scaled)[0][0]

        last = data[-1]
        next_time = last.time + 86400  # +1 day

        # สร้าง candle ใหม่จากค่าที่ทำนาย
        new_candle = Candle(
            time=next_time,
            open=pred,
            high=pred,
            low=pred,
            close=pred,
            volume=last.volume,
            quote_asset_volume=last.quote_asset_volume,
            trades=last.trades,
            taker_buy_base=last.taker_buy_base,
            taker_buy_quote=last.taker_buy_quote,
            sentiment=last.sentiment,
        )

        data.append(new_candle)
        results.append({
            "time": next_time,
            "predicted_close": float(pred),
        })

    return {
        "model": "lstm_recursive",
        "steps": steps,
        "series": results,
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

    pred = model.predict(X_scaled)[0]

    last_close  = data.open  # หรือ close ล่าสุด
    future_return = (pred - last_close) / last_close

    trend_score = np.tanh(future_return * 10)
    confidence = min(abs(trend_score), 1.0)

    return {
        "trend_score": float(trend_score),
        "confidence": float(confidence),
        "horizon": horizon
    }
@app.post("/predict/lstm/history")
def predict_lstm_history(
    rows: List[Candle],
):
    if len(rows) <= LSTM_WINDOW:
        raise HTTPException(400, "Not enough candles")

    lstm, scaler_X, scaler_y = load_lstm(1)

    raw = np.array([[r.model_dump()[c] for c in FEATURE_COLS] for r in rows])
    X_scaled = scaler_X.transform(raw)

    preds = []

    for i in range(LSTM_WINDOW, len(X_scaled)):
        X_seq = np.array([X_scaled[i - LSTM_WINDOW:i]])
        pred_scaled = lstm.predict(X_seq, verbose=0)
        pred = scaler_y.inverse_transform(pred_scaled)[0][0]

        preds.append({
            "time": rows[i].time,
            "predicted_close": float(pred),
        })

    return {
        "model": "lstm_history",
        "series": preds,
    }
