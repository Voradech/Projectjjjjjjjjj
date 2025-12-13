from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel
import os
import json
import joblib
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")

METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")
RF_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")
GB_PATH = os.path.join(MODEL_DIR, "gradient_boosting.pkl")

# โหลด metadata (feature_cols) จาก metrics.json ที่ train_model.py สร้างไว้
if not os.path.exists(METRICS_PATH):
    raise FileNotFoundError(f"Missing metrics.json at: {METRICS_PATH}")

with open(METRICS_PATH, "r", encoding="utf-8") as f:
    metrics = json.load(f)

FEATURE_COLS = metrics["feature_cols"]

# โหลดโมเดล
if not os.path.exists(RF_PATH) or not os.path.exists(GB_PATH):
    raise FileNotFoundError("Missing model files. Please run train_model.py to generate models in /model")

rf_model = joblib.load(RF_PATH)
gb_model = joblib.load(GB_PATH)

app = FastAPI(title="Bitcoin Price Prediction API (RF/GB)")

class PriceInput(BaseModel):
    open: float
    high: float
    low: float
    volume: float
    quote_asset_volume: float
    trades: float
    taker_buy_base: float
    taker_buy_quote: float

@app.get("/")
def root():
    return {
        "message": "Backend is running. Go to /docs",
        "available_models": ["rf", "gb"],
        "feature_cols": FEATURE_COLS
    }

@app.get("/metrics")
def get_metrics():
    return metrics

@app.post("/predict")
def predict_price(data: PriceInput, model: str = Query("rf", pattern="^(rf|gb)$")):
    # เรียงฟีเจอร์ให้ตรงกับตอนเทรน
    x = np.array([[
        data.open,
        data.high,
        data.low,
        data.volume,
        data.quote_asset_volume,
        data.trades,
        data.taker_buy_base,
        data.taker_buy_quote
    ]], dtype=float)

    if model == "rf":
        y_pred = rf_model.predict(x)[0]
    elif model == "gb":
        y_pred = gb_model.predict(x)[0]
    else:
        raise HTTPException(status_code=400, detail="model must be 'rf' or 'gb'")

    return {
        "model": model,
        "input": data.model_dump(),
        "predicted_close": float(y_pred)
    }
