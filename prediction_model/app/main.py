from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import os, json, joblib
import numpy as np
import pandas as pd
from tensorflow.keras.models import load_model

# ================= PATH =================
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "model")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")

# ================= LOAD METRICS =================
if not os.path.exists(METRICS_PATH):
    raise RuntimeError("metrics.json not found - train model first")

with open(METRICS_PATH, "r", encoding="utf-8") as f:
    metrics = json.load(f)

HORIZONS = [1, 7, 14]

# ================= FASTAPI =================
app = FastAPI(title="Bitcoin Return & Trend Prediction API")

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
    close: float
    volume: float
    quote_asset_volume: float
    trades: float
    taker_buy_base: float
    taker_buy_quote: float
    sentiment: float = 0.0

class Candle(PriceInput):
    time: int


# ================= UTILS =================
def create_features(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()

    df["return_1d"]  = df["close"].pct_change(1)
    df["return_7d"]  = df["close"].pct_change(7)
    df["return_14d"] = df["close"].pct_change(14)

    df["ma_7"]  = df["close"].rolling(7).mean()
    df["ma_14"] = df["close"].rolling(14).mean()
    df["ma_ratio_7"]  = df["close"] / df["ma_7"]
    df["ma_ratio_14"] = df["close"] / df["ma_14"]

    df["vol_7"]  = df["return_1d"].rolling(7).std()
    df["vol_14"] = df["return_1d"].rolling(14).std()

    df["close_lag1"]  = df["close"].shift(1)
    df["close_lag7"]  = df["close"].shift(7)
    df["close_lag14"] = df["close"].shift(14)

    df["volume_lag1"]  = df["volume"].shift(1)
    df["volume_lag7"]  = df["volume"].shift(7)
    df["volume_lag14"] = df["volume"].shift(14)

    return df


def load_feature_info(h: int):
    path = os.path.join(MODEL_DIR, f"feature_info+{h}.pkl")
    if not os.path.exists(path):
        raise HTTPException(404, f"feature_info for t+{h} not found")
    return joblib.load(path)


def load_tree(model: str, h: int):
    model_path = os.path.join(MODEL_DIR, f"{model}_return+{h}.pkl")
    scaler_path = os.path.join(MODEL_DIR, f"scaler+{h}.pkl")

    if not os.path.exists(model_path):
        raise HTTPException(404, f"Model not found: {model}_return+{h}")

    return joblib.load(model_path), joblib.load(scaler_path)


def load_lstm(h: int):
    return (
        load_model(os.path.join(MODEL_DIR, f"lstm_return+{h}.keras")),
        joblib.load(os.path.join(MODEL_DIR, f"scaler+{h}.pkl")),
        load_feature_info(h)
    )

def calculate_trend(pred_dict, threshold=0.0):
    values = list(pred_dict.values())

    positive = sum(1 for v in values if v > threshold)
    negative = sum(1 for v in values if v < -threshold)

    if positive >= 2:
        return "UP"
    elif negative >= 2:
        return "DOWN"
    else:
        return "SIDEWAY"

def calculate_confidence(pred_dict):
    values = list(pred_dict.values())
    if all(v > 0 for v in values) or all(v < 0 for v in values):
        return "HIGH"
    elif sum(v > 0 for v in values) >= 2 or sum(v < 0 for v in values) >= 2:
        return "MEDIUM"
    else:
        return "LOW"


# ================= ROUTES =================
@app.get("/")
def root():
    return {
        "models": ["rf", "gb", "lstm"],
        "horizons": HORIZONS,
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
    feature_info = load_feature_info(horizon)
    FEATURE_COLS = feature_info["feature_cols"]

    df = pd.DataFrame([data.model_dump()])
    df_feat = create_features(df).dropna()

    if len(df_feat) == 0:
        raise HTTPException(400, "Not enough data to create features")

    X = df_feat[FEATURE_COLS].values
    X_scaled = scaler.transform(X)

    pred_return = float(model_obj.predict(X_scaled)[0])

    return {
        "model": model,
        "horizon": f"t+{horizon}",
        "predicted_return": pred_return,
        "trend": "UP" if pred_return > 0 else "DOWN",
    }


# ---------- LSTM ----------@app.post("/predict/lstm")
def predict_lstm(
    rows: List[Candle],
    horizon: int = Query(1),
):
    if horizon not in HORIZONS:
        raise HTTPException(400, "Invalid horizon")

    lstm, scaler, feature_info = load_lstm(horizon)
    FEATURE_COLS = feature_info["feature_cols"]
    WINDOW = feature_info["lstm_window_size"]

    df = pd.DataFrame([r.model_dump() for r in rows])
    df_feat = create_features(df).dropna()

    if len(df_feat) <= WINDOW:
        raise HTTPException(400, f"Need more than {WINDOW} rows")

    X = df_feat[FEATURE_COLS].values
    X_scaled = scaler.transform(X)

    X_seq = []
    times = []

    for i in range(WINDOW, len(X_scaled)):
        X_seq.append(X_scaled[i - WINDOW:i])
        times.append(df_feat.iloc[i]["time"])

    X_seq = np.array(X_seq)

    # ===== 1) predict =====
    pred_returns = lstm.predict(X_seq, verbose=0).flatten()

    # ===== 2) trend logic (BACKEND) =====
    pred_dict = {f"step_{i}": float(v) for i, v in enumerate(pred_returns)}
    trend = calculate_trend(pred_dict)
    confidence = calculate_confidence(pred_dict)

    # ===== 3) series for graph =====
    series = [
        {
            "time": int(times[i]),
            "predicted_return": float(pred_returns[i]),
            "trend": "UP" if pred_returns[i] > 0 else "DOWN"
        }
        for i in range(len(pred_returns))
    ]

    return {
        "model": "lstm",
        "horizon": f"t+{horizon}",
        "trend": trend,
        "confidence": confidence,
        "series": series
    }


@app.post("/predict/trend")
def predict_trend(data: PriceInput, model: str = Query("rf", regex="^(rf|gb)$")):
    preds = {}

    for h in HORIZONS:
        model_name = "random_forest" if model == "rf" else "gradient_boosting"
        model_obj, scaler = load_tree(model_name, h)
        feature_info = load_feature_info(h)
        FEATURE_COLS = feature_info["feature_cols"]

        df = pd.DataFrame([data.model_dump()])
        df_feat = create_features(df).dropna()
        X = scaler.transform(df_feat[FEATURE_COLS].values)

        preds[f"t+{h}"] = float(model_obj.predict(X)[0])

    trend = calculate_trend(preds)
    confidence = calculate_confidence(preds)

    return {
        "model": model,
        "predictions": preds,
        "trend": trend,
        "confidence": confidence
    }
