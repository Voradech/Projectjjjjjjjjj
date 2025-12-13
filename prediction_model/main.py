from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import numpy as np

# โหลดโมเดลที่เทรนไว้แล้ว
MODEL_PATH = "model/bitcoin_model.pkl"
model = joblib.load(MODEL_PATH)

# สร้าง FastAPI app
app = FastAPI(title="Bitcoin Price Prediction API")

# รูปแบบข้อมูลที่รับจากผู้ใช้ (request body)
class PriceInput(BaseModel):
    open: float
    high: float
    low: float
    volume: float

# endpoint สำหรับเช็คว่า backend ยังทำงานไหม
@app.get("/")
def root():
    return {
        "message": "Bitcoin Predict Backend is running. Go to /docs for API docs."
    }

# endpoint สำหรับทำนายราคา
@app.post("/predict")
def predict_price(data: PriceInput):
    # แปลงข้อมูลให้เป็นรูปแบบที่โมเดลต้องการ (2D array)
    X = np.array([[data.open, data.high, data.low, data.volume]])
    y_pred = model.predict(X)[0]

    return {
        "input": data.dict(),
        "predicted_close": float(y_pred)
    }
