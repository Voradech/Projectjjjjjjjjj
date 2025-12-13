from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Literal, Dict, Any, List
import os
import json
import pandas as pd

import numpy as np
import joblib
import yfinance as yf

from tensorflow.keras.models import load_model

# BASE_DIR = โฟลเดอร์ backend
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# MODEL_DIR = backend/model
MODEL_DIR = os.path.join(BASE_DIR, "model")
DATA_PATH = os.path.join(BASE_DIR, "data", "bitcoin_price.csv")

RF_PATH = os.path.join(MODEL_DIR, "random_forest.pkl")
GB_PATH = os.path.join(MODEL_DIR, "gradient_boosting.pkl")
LSTM_PATH = os.path.join(MODEL_DIR, "lstm_model.keras")
METRICS_PATH = os.path.join(MODEL_DIR, "metrics.json")

LSTM_WINDOW_SIZE = 30  # ต้องตรงกับตอนเทรนโมเดล

# ---------- โหลดโมเดล ----------
if not os.path.exists(RF_PATH) or not os.path.exists(GB_PATH) or not os.path.exists(LSTM_PATH):
    print("⚠️ WARNING: ยังไม่พบไฟล์โมเดลครบ กรุณารัน python train_model.py ก่อน")

rf_model = joblib.load(RF_PATH) if os.path.exists(RF_PATH) else None
gb_model = joblib.load(GB_PATH) if os.path.exists(GB_PATH) else None
lstm_model = load_model(LSTM_PATH) if os.path.exists(LSTM_PATH) else None


# ---------- FastAPI app ----------
app = FastAPI(
    title="Bitcoin Price Prediction API",
    description="ระบบคาดการณ์ราคาบิทคอยน์ด้วย RandomForest, LSTM, GradientBoosting",
    version="1.0.0",
)


# ---------- Request body ----------
class PriceInput(BaseModel):
    open: float
    high: float
    low: float
    volume: float
    # เลือกโมเดล หรือ all = ทำนายทุกโมเดล
    model: Literal["random_forest", "gradient_boosting", "lstm", "all"] = "all"


# ---------- Helper สำหรับ LSTM ----------
def prepare_lstm_input(latest_close_values):
    """
    latest_close_values: list/array ขนาด 30 แท่งล่าสุด
    """
    arr = np.array(latest_close_values, dtype="float32")
    if len(arr) != LSTM_WINDOW_SIZE:
        raise ValueError(f"ต้องส่งค่า close จำนวน {LSTM_WINDOW_SIZE} ค่ามาให้ LSTM")
    arr = arr.reshape(1, LSTM_WINDOW_SIZE, 1)
    return arr


def predict_next_close_with_lstm_from_csv() -> float:
    """
    ใช้ LSTM ทำนายราคาปิดของ 'วันถัดไป'
    โดยใช้ค่า close ย้อนหลัง 30 วันล่าสุดจากไฟล์ bitcoin_price.csv
    """
    if lstm_model is None:
        raise HTTPException(status_code=500, detail="LSTM model not loaded")

    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=500, detail="ไม่พบไฟล์ bitcoin_price.csv")

    df = pd.read_csv(DATA_PATH)

    # รองรับทั้ง close / Close
    if "close" in df.columns:
        closes = df["close"].values.astype("float32")
    elif "Close" in df.columns:
        closes = df["Close"].values.astype("float32")
    else:
        raise HTTPException(status_code=500, detail="ไม่พบคอลัมน์ close ในไฟล์ข้อมูล")

    if len(closes) < LSTM_WINDOW_SIZE:
        raise HTTPException(
            status_code=500,
            detail=f"ข้อมูลไม่พอสำหรับ LSTM (ต้องมีอย่างน้อย {LSTM_WINDOW_SIZE} แท่ง)"
        )

    window = closes[-LSTM_WINDOW_SIZE:]
    X = window.reshape(1, LSTM_WINDOW_SIZE, 1)
    y_pred = lstm_model.predict(X).flatten()[0]
    return float(y_pred)


# ---------- Endpoints ----------

@app.get("/")
def root():
    return {
        "message": "Bitcoin Predict Backend is running",
        "docs": "/docs"
    }


@app.get("/check-data")
def check_data():
    return {
        "data_path": DATA_PATH,
        "exists": os.path.exists(DATA_PATH)
    }


@app.get("/metrics")
def get_metrics() -> Dict[str, Any]:
    """
    ดึงค่า MAE / R2 ของแต่ละโมเดลจากไฟล์ metrics.json
    เอาไว้ไปโชว์ในหน้าเว็บ + ใช้เขียนรายงานเรื่องความแม่นยำของโมเดล
    """
    if not os.path.exists(METRICS_PATH):
        raise HTTPException(status_code=404, detail="ยังไม่มีไฟล์ metrics.json กรุณารันเทรนโมเดลก่อน")

    with open(METRICS_PATH, "r", encoding="utf-8") as f:
        metrics = json.load(f)

    return metrics


@app.get("/history-with-predictions")
def history_with_predictions(limit: int = 100) -> List[Dict[str, Any]]:
    """
    ส่งข้อมูลราคาจริง + ราคาที่โมเดลทำนาย (RF, GB, LSTM)
    ใช้สำหรับวาดกราฟบนหน้าเว็บ
    """
    if not os.path.exists(DATA_PATH):
        raise HTTPException(status_code=500, detail="ไม่พบไฟล์ bitcoin_price.csv")

    df = pd.read_csv(DATA_PATH)

    # จัดการคอลัมน์วันที่
    if "date" in df.columns:
        df["date"] = pd.to_datetime(df["date"])
    elif "Date" in df.columns:
        df["date"] = pd.to_datetime(df["Date"])
    else:
        df["date"] = range(len(df))

    # เช็คคอลัมน์หลัก
    for col in ["open", "high", "low", "close", "volume"]:
        if col not in df.columns:
            raise HTTPException(status_code=500, detail=f"ไม่พบคอลัมน์ {col} ในไฟล์ข้อมูล")

    df = df.sort_values("date").reset_index(drop=True)

    # --- ทำนาย RF + GB ---
    df_tail_for_tree = df.tail(limit)
    X_tree = df_tail_for_tree[["open", "high", "low", "volume"]].values.astype("float32")

    rf_pred = rf_model.predict(X_tree).astype(float) if rf_model is not None else None
    gb_pred = gb_model.predict(X_tree).astype(float) if gb_model is not None else None

    # --- ทำนาย LSTM สำหรับทั้งซีรีส์ ---
    closes = df["close"].values.astype("float32")
    if lstm_model is not None and len(closes) > LSTM_WINDOW_SIZE:
        X_lstm = []
        for i in range(len(closes) - LSTM_WINDOW_SIZE):
            X_lstm.append(closes[i:i + LSTM_WINDOW_SIZE])
        X_lstm = np.array(X_lstm).reshape(-1, LSTM_WINDOW_SIZE, 1)
        y_lstm = lstm_model.predict(X_lstm).flatten()

        df["close_lstm"] = np.nan
        # prediction index k ตรงกับวันที่ index k + LSTM_WINDOW_SIZE
        df.loc[LSTM_WINDOW_SIZE:, "close_lstm"] = y_lstm
    else:
        df["close_lstm"] = np.nan

    df_tail = df.tail(limit).reset_index(drop=True)

    results: List[Dict[str, Any]] = []
    for i, row in df_tail_for_tree.reset_index(drop=True).iterrows():
        base = df_tail.iloc[i]

        item: Dict[str, Any] = {
            "date": base["date"].strftime("%Y-%m-%d") if hasattr(base["date"], "strftime") else base["date"],
            "close_actual": float(base["close"]),
        }
        if rf_pred is not None:
            item["close_rf"] = float(rf_pred[i])
        if gb_pred is not None:
            item["close_gb"] = float(gb_pred[i])
        # ใส่ค่า LSTM ถ้ามี (ถ้า NaN ให้ส่ง None)
        if not pd.isna(base["close_lstm"]):
            item["close_lstm"] = float(base["close_lstm"])
        else:
            item["close_lstm"] = None

        results.append(item)

    return results


@app.post("/predict")
def predict_price(data: PriceInput):
    """
    ทำนายราคาปิด (close)
    - RF / GB: ใช้ feature open, high, low, volume ของอินพุต
    - LSTM: ใช้ค่า close ย้อนหลัง 30 วันล่าสุดจากไฟล์ bitcoin_price.csv
            ทำนายราคาปิดของวันถัดไป (ไม่ใช้ค่าที่ user กรอก)
    """
    # สำหรับ RF / GB ใช้ feature 4 ตัวจากอินพุต
    X = np.array([[data.open, data.high, data.low, data.volume]], dtype="float32")

    results: Dict[str, Any] = {}

    # Random Forest
    if data.model in ("random_forest", "all"):
        if rf_model is None:
            raise HTTPException(status_code=500, detail="RandomForest model not loaded")
        y_pred_rf = float(rf_model.predict(X)[0])
        results["random_forest"] = y_pred_rf

    # Gradient Boosting
    if data.model in ("gradient_boosting", "all"):
        if gb_model is None:
            raise HTTPException(status_code=500, detail="GradientBoosting model not loaded")
        y_pred_gb = float(gb_model.predict(X)[0])
        results["gradient_boosting"] = y_pred_gb

    # LSTM: ใช้ sequence close 30 วันล่าสุดจากไฟล์
    if data.model in ("lstm", "all"):
        lstm_pred = predict_next_close_with_lstm_from_csv()
        results["lstm"] = lstm_pred

    return {
        "input": data.dict(),
        "predictions": results
    }
@app.get("/predict-now")
def predict_now():
    btc = yf.Ticker("BTC-USD")
    data = btc.history(period="1d", interval="1m")

    # ราคาปัจจุบัน
    open_p = float(data["Open"].iloc[-1])
    high_p = float(data["High"].iloc[-1])
    low_p = float(data["Low"].iloc[-1])
    vol_p = float(data["Volume"].iloc[-1])

    # 2. ใส่ค่าเข้าโมเดล RF/GB
    X = np.array([[open_p, high_p, low_p, vol_p]], dtype="float32")

    rf_pred = rf_model.predict(X)[0]
    gb_pred = gb_model.predict(X)[0]

    # 3. LSTM ใช้ close 30 วันล่าสุด (ดึงจาก yfinance อีกครั้ง)
    hist = btc.history(period="31d", interval="1d")
    closes = hist["Close"].values.astype("float32")
    window = closes[-30:].reshape(1, 30, 1)

    lstm_pred = lstm_model.predict(window)[0][0]

    return {
        "current_price": float(hist["Close"].iloc[-1]),
        "random_forest": float(rf_pred),
        "gradient_boosting": float(gb_pred),
        "lstm_next_day": float(lstm_pred)
    }
