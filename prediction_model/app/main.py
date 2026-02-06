import os
import json
import numpy as np
import pandas as pd
import joblib
import requests
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from tensorflow.keras.models import load_model


# ================= CONFIG =================
BASE_DIR = os.path.dirname(
    os.path.dirname(os.path.abspath(__file__))
)
MODEL_DIR = os.path.join(BASE_DIR, "model")
DATA_PATH = os.path.join(BASE_DIR, "data", "BTCDATA_1d_full.csv")

AVAILABLE_HORIZONS = [1, 7, 14]
LSTM_WINDOW_SIZE = 30


# ================= PYDANTIC MODELS =================
class PredictionRequest(BaseModel):
    horizon: int = Field(..., description="Prediction horizon (1, 7, or 14 days)")
    use_latest_data: bool = Field(True, description="Use latest data from CSV file")


class PredictionResponse(BaseModel):
    horizon: int
    best_model: str
    model_metrics: Dict[str, float]
    prediction: Dict[str, Any]
    metadata: Dict[str, Any]


# ================= HELPER FUNCTIONS =================
def create_features(df):
    """สร้าง features แบบเดียวกับตอน train"""
    df = df.copy()

    # Returns
    df["return_1d"]  = df["close"].pct_change(1).shift(1)
    df["return_7d"]  = df["close"].pct_change(7).shift(1)
    df["return_14d"] = df["close"].pct_change(14).shift(1)

    # Moving averages
    df["ma_7"]  = df["close"].rolling(7, min_periods=7).mean()
    df["ma_14"] = df["close"].rolling(14, min_periods=14).mean()
    df["ma_ratio_7"]  = df["close"] / df["ma_7"]
    df["ma_ratio_14"] = df["close"] / df["ma_14"]

    # Volatility
    returns = df["close"].pct_change(1)
    df["vol_7"] = returns.shift(1).rolling(7, min_periods=7).std()
    df["vol_14"] = returns.shift(1).rolling(14, min_periods=14).std()

    # Lag prices
    df["close_lag1"]  = df["close"].shift(1)
    df["close_lag7"]  = df["close"].shift(7)
    df["close_lag14"] = df["close"].shift(14)

    # Lag volume
    df["volume_lag1"]  = df["volume"].shift(1)
    df["volume_lag7"]  = df["volume"].shift(7)
    df["volume_lag14"] = df["volume"].shift(14)

    return df


def get_best_model(horizon: int) -> tuple:
    """หาโมเดลที่ดีที่สุดจาก metrics.json"""
    metrics_path = os.path.join(BASE_DIR, "model", "metrics.json")
    
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="Metrics file not found.")
    
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    
    horizon_key = f"t+{horizon}"
    if horizon_key not in metrics:
        raise HTTPException(
            status_code=400,
            detail=f"Horizon {horizon} not found in metrics."
        )
    
    model_metrics = metrics[horizon_key]
    
    best_model_name = None
    best_direction_acc = 0  
    
    for model_name, model_metric in model_metrics.items():
        direction_acc = model_metric.get("direction_accuracy", 0)
        if direction_acc > best_direction_acc:
            best_direction_acc = direction_acc
            best_model_name = model_name
    
    return best_model_name, model_metrics[best_model_name]
 
def load_model_and_scaler(horizon: int, model_name: str):
    """โหลดโมเดลและ scaler"""
    scaler_path = os.path.join(MODEL_DIR, f"scaler+{horizon}.pkl")
    feature_info_path = os.path.join(MODEL_DIR, f"feature_info+{horizon}.pkl")
    
    if not os.path.exists(scaler_path):
        raise HTTPException(status_code=404, detail=f"Scaler for horizon {horizon} not found")
    
    scaler = joblib.load(scaler_path)
    feature_info = joblib.load(feature_info_path)
    
    # โหลดโมเดลตามชื่อ
    if model_name == "random_forest":
        model_path = os.path.join(MODEL_DIR, f"rf_return+{horizon}.pkl")
        model = joblib.load(model_path)
    elif model_name == "gradient_boosting":
        model_path = os.path.join(MODEL_DIR, f"gb_return+{horizon}.pkl")
        model = joblib.load(model_path)
    elif model_name == "lstm":
        model_path = os.path.join(MODEL_DIR, f"lstm_return+{horizon}.keras")
        model = load_model(model_path)
    else:
        raise HTTPException(status_code=400, detail=f"Unknown model name: {model_name}")
    
    return model, scaler, feature_info


def create_sequences(X, window):
    """สร้าง sequences สำหรับ LSTM (ไม่ต้องการ y)"""
    if len(X) < window:
        raise ValueError(f"Not enough data. Need at least {window} rows, got {len(X)}")
    
    X_seq = []
    for i in range(window, len(X) + 1):
        X_seq.append(X[i - window:i])
    return np.array(X_seq)


def predict_with_model(model, model_name: str, X_scaled, feature_cols, horizon: int):
    """ทำนายด้วยโมเดล"""
    if model_name == "lstm":
        # LSTM ต้องการ sequences
        if len(X_scaled) < LSTM_WINDOW_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"Not enough data for LSTM. Need at least {LSTM_WINDOW_SIZE} rows"
            )
        
        X_seq = create_sequences(X_scaled, LSTM_WINDOW_SIZE)
        # เอาแค่ sequence สุดท้าย (ล่าสุด)
        X_latest = X_seq[-1:, :, :]
        prediction = model.predict(X_latest, verbose=0).flatten()[0]
    else:
        # Random Forest / Gradient Boosting
        X_latest = X_scaled[-1:, :]
        prediction = model.predict(X_latest)[0]
    
    return float(prediction)

def fetch_market_data(limit=200):
    url = "https://api.binance.com/api/v3/klines"
    params = {
        "symbol": "BTCUSDT",
        "interval": "1d",
        "limit": limit
    }

    res = requests.get(url, params=params)
    res.raise_for_status()
    data = res.json()

    df = pd.DataFrame(
        data,
        columns=[
            "open_time",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "close_time",
            "quote_asset_volume",
            "trades",
            "taker_buy_base",
            "taker_buy_quote",
            "ignore",
        ],
    )

    # ===== basic price columns =====
    df["date"] = pd.to_datetime(df["open_time"], unit="ms")

    df["open"] = df["open"].astype(float)
    df["high"] = df["high"].astype(float)
    df["low"] = df["low"].astype(float)
    df["close"] = df["close"].astype(float)
    df["volume"] = df["volume"].astype(float)

    # ===== columns ที่โมเดลคุณต้องใช้ =====
    df["quote_asset_volume"] = df["quote_asset_volume"].astype(float)
    df["trades"] = df["trades"].astype(int)
    df["taker_buy_base"] = df["taker_buy_base"].astype(float)
    df["taker_buy_quote"] = df["taker_buy_quote"].astype(float)

    # ===== sentiment (ไม่มีจาก Binance → ใส่ default) =====
    df["sentiment"] = 0.0

    # เรียงเวลาให้ชัวร์
    df = df.sort_values("date").reset_index(drop=True)

    return df[
        [
            "date",
            "open",
            "high",
            "low",
            "close",
            "volume",
            "quote_asset_volume",
            "trades",
            "taker_buy_base",
            "taker_buy_quote",
            "sentiment",
        ]
    ]

# ================= FASTAPI APP =================
app = FastAPI(
    title="BTC Price Prediction API",
    description="Bitcoin price prediction using ML models (RF, GB, LSTM)",
    version="1.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    """API info"""
    return {
        "message": "BTC Price Prediction API",
        "version": "1.0.0",
        "endpoints": {
            "/predict": "POST - Make prediction",
            "/models": "GET - List available models",
            "/metrics": "GET - Get all model metrics",
            "/health": "GET - Health check"
        }
    }


@app.get("/health")
def health_check():
    """Health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }


@app.get("/models")
def list_models():
    """รายการโมเดลที่มี"""
    metrics_path = os.path.join(MODEL_DIR, "metrics.json")
    
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="Metrics file not found")
    
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    
    available_models = {}
    for horizon_key, model_metrics in metrics.items():
        horizon = int(horizon_key.split("+")[1])
        best_model, best_metrics = get_best_model(horizon)
        
        available_models[horizon_key] = {
            "horizon_days": horizon,
            "best_model": best_model,
            "best_model_metrics": best_metrics,
            "all_models": list(model_metrics.keys())
        }
    
    return available_models


@app.get("/metrics")
def get_metrics():
    """ดู metrics ทั้งหมด"""
    metrics_path = os.path.join(MODEL_DIR, "metrics.json")
    
    if not os.path.exists(metrics_path):
        raise HTTPException(status_code=404, detail="Metrics file not found")
    
    with open(metrics_path, "r", encoding="utf-8") as f:
        metrics = json.load(f)
    
    return metrics


@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):

    if request.horizon not in AVAILABLE_HORIZONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid horizon. Available: {AVAILABLE_HORIZONS}"
        )
    
    try:
        # 1. หาโมเดลที่ดีที่สุด
        best_model_name, best_metrics = get_best_model(request.horizon)
        print(f"Best model for horizon {request.horizon}: {best_model_name}")
        
        # 2. โหลดโมเดล
        model, scaler, feature_info = load_model_and_scaler(request.horizon, best_model_name)
        feature_cols = feature_info['feature_cols']
        
        df = fetch_market_data(limit=200)


        # 4. สร้าง features
        df_features = create_features(df)
        df_features = df_features.dropna()
        
        if len(df_features) == 0:
            raise HTTPException(status_code=400, detail="No valid data after feature engineering")
        
        # 5. เตรียมข้อมูลสำหรับ prediction
        X = df_features[feature_cols].values
        X_scaled = scaler.transform(X)
        
        # 6. ทำนาย
        predicted_return = predict_with_model(
            model, 
            best_model_name, 
            X_scaled, 
            feature_cols, 
            request.horizon
        )
        
        # 7. แปลง return เป็นราคา
        latest_raw = df.iloc[-1]   # 👈 เพิ่มบรรทัดนี้ตรงนี้เลย
        latest_close = float(latest_raw["close"])
        latest_date = latest_raw["date"]

        predicted_price = latest_close * (1 + predicted_return)
        predicted_date = latest_date + timedelta(days=request.horizon)
                
        # 8. คำนวณ direction
        direction = "UP" if predicted_return > 0 else "DOWN"
        confidence = abs(predicted_return) * 100  # แปลงเป็น %
        
        return PredictionResponse(
            horizon=request.horizon,
            best_model=best_model_name,
            model_metrics=best_metrics,
            prediction={
                "current_price": latest_close,
                "current_date": latest_date.strftime("%Y-%m-%d"),
                "predicted_price": predicted_price,
                "predicted_date": predicted_date.strftime("%Y-%m-%d"),
                "predicted_return": predicted_return,
                "predicted_return_pct": predicted_return * 100,
                "direction": direction,
                "price_change": predicted_price - latest_close,
                "price_change_pct": predicted_return * 100
            },
            metadata={
                "model_used": best_model_name,
                "features_count": len(feature_cols),
                "data_points_used": len(df_features),
                "latest_data_date": latest_date.strftime("%Y-%m-%d"),
                "prediction_timestamp": datetime.now().isoformat()
            }
        )
        
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"Value error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# ================= RUN =================
if __name__ == "__main__":
    import uvicorn
    
    print("="*60)
    print(" BTC PRICE PREDICTION API")
    print("="*60)
    print(f"Model directory: {MODEL_DIR}")
    print(f"Data path: {DATA_PATH}")
    print(f"Available horizons: {AVAILABLE_HORIZONS}")
    print("="*60)
    
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8001,
        log_level="info"
    )