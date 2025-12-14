from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
from typing import List
import os, json, joblib
import numpy as np
from tensorflow.keras.models import load_model

# ================== PATH SETUP ==================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")
RF_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")
GB_PATH = os.path.join(MODEL_DIR, "gradient_boosting.pkl")
SCALER_TREE_PATH = os.path.join(MODEL_DIR, "scaler_X_tree.pkl")

LSTM_PATH = os.path.join(MODEL_DIR, "lstm_model.keras")
SCALER_X_LSTM_PATH = os.path.join(MODEL_DIR, "scaler_X_lstm.pkl")
SCALER_Y_LSTM_PATH = os.path.join(MODEL_DIR, "scaler_y_lstm.pkl")

# ================== LOAD METRICS ==================
if not os.path.exists(METRICS_PATH):
    raise FileNotFoundError(f"Missing metrics.json at: {METRICS_PATH}")

with open(METRICS_PATH, "r", encoding="utf-8") as f:
    metrics = json.load(f)

FEATURE_COLS = metrics["feature_cols"]
WINDOW = int(metrics.get("lstm", {}).get("window_size", 30))

# ================== LOAD RF / GB ==================
if not (os.path.exists(RF_PATH) and os.path.exists(GB_PATH) and os.path.exists(SCALER_TREE_PATH)):
    raise FileNotFoundError("Missing RF/GB model or scaler files")

rf_model = joblib.load(RF_PATH)
gb_model = joblib.load(GB_PATH)
scaler_X_tree = joblib.load(SCALER_TREE_PATH)

# ================== LOAD LSTM ==================
if not (os.path.exists(LSTM_PATH) and os.path.exists(SCALER_X_LSTM_PATH) and os.path.exists(SCALER_Y_LSTM_PATH)):
    raise FileNotFoundError("Missing LSTM model or scaler files")

lstm_model = load_model(LSTM_PATH)
scaler_X_lstm = joblib.load(SCALER_X_LSTM_PATH)
scaler_y_lstm = joblib.load(SCALER_Y_LSTM_PATH)

# ================== FASTAPI APP ==================
app = FastAPI(title="Bitcoin Price Prediction API (RF / GB / LSTM)")
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js
    allow_credentials=True,
    allow_methods=["*"],                      # POST / OPTIONS / GET
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

class Candle(BaseModel):
    time: int
    open: float
    high: float
    low: float
    close: float
    volume: float
    quote_asset_volume: float
    trades: float
    taker_buy_base: float
    taker_buy_quote: float

# ================== ROUTES ==================
@app.get("/")
def root():
    return {
        "message": "Backend is running. Go to /docs",
        "available_models": ["rf", "gb", "lstm"],
        "feature_cols": FEATURE_COLS,
        "lstm_window": WINDOW
    }

@app.get("/metrics")
def get_metrics():
    return metrics

@app.post("/predict")
def predict_price(data: PriceInput, model: str = Query("rf", regex="^(rf|gb)$")):
    payload = data.model_dump()

    missing = [c for c in FEATURE_COLS if c not in payload]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing features: {missing}")

    x = np.array([[payload[c] for c in FEATURE_COLS]], dtype=float)
    x_scaled = scaler_X_tree.transform(x)

    if model == "rf":
        y_pred = rf_model.predict(x_scaled)[0]
    else:
        y_pred = gb_model.predict(x_scaled)[0]

    return {"model": model, "predicted_close": float(y_pred)}

@app.post("/compare/lstm")
def compare_lstm(rows: List[Candle]):
    if len(rows) <= WINDOW:
        raise HTTPException(status_code=400, detail=f"Need at least {WINDOW + 1} candles")

    payloads = [r.model_dump() for r in rows]

    missing = [c for c in FEATURE_COLS if c not in payloads[0]]
    if missing:
        raise HTTPException(status_code=400, detail=f"Missing columns in payload: {missing}")

    X_raw = np.array([[p[c] for c in FEATURE_COLS] for p in payloads], dtype=float)
    X_scaled = scaler_X_lstm.transform(X_raw)

    X_seq = []
    for i in range(WINDOW, len(X_scaled)):
        X_seq.append(X_scaled[i - WINDOW:i])
    X_seq = np.array(X_seq)

    pred_scaled = lstm_model.predict(X_seq, verbose=0)
    pred = scaler_y_lstm.inverse_transform(pred_scaled).flatten()

    series = []
    for i, p in enumerate(pred):
        idx = i + WINDOW
        series.append({
            "time": rows[idx].time,
            "actual_close": float(rows[idx].close),
            "predicted_close": float(p)
        })

    return {
        "model": "lstm",
        "window_size": WINDOW,
        "points": len(series),
        "series": series
    }
