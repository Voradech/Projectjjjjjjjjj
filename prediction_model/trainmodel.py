# โมเดลตัวเก่า (Random Forest, Gradient Boosting, LSTM) สำหรับทำนายราคาปิด Bitcoin

import os
import json
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import MinMaxScaler

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense
from tensorflow.keras.callbacks import EarlyStopping

# ---------- config พื้นฐาน ----------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "BTCDATA_1d_full.csv")
MODEL_DIR = os.path.join(BASE_DIR, "model")
os.makedirs(MODEL_DIR, exist_ok=True)

FEATURE_COLS = [
    "open",
    "high",
    "low",
    "volume",
    "quote_asset_volume",
    "trades",
    "taker_buy_base",
    "taker_buy_quote",
]
TARGET_COL = "close"

LSTM_WINDOW_SIZE = 30  # ใช้ 30 แท่งทำนายแท่งถัดไป


# ---------- 1. โหลด & เตรียมข้อมูล ----------
print("Loading data from:", DATA_PATH)
df = pd.read_csv(DATA_PATH)

# แปลง date เป็น datetime (ใช้เป็น index เฉย ๆ)
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date")

# ลบแถวที่มี NaN
df = df.dropna()

# เลือกเฉพาะคอลัมน์ที่ต้องใช้
df_features = df[FEATURE_COLS]
df_target = df[TARGET_COL]

X = df_features.values
y = df_target.values

# แบ่ง Train/Test แบบไม่ shuffle (รักษาลำดับเวลา)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, shuffle=False
)


# ---------- 2. Train Random Forest ----------
print("Training Random Forest...")
rf_model = RandomForestRegressor(
    n_estimators=200,
    random_state=42,
    n_jobs=-1,
)
rf_model.fit(X_train, y_train)
rf_pred = rf_model.predict(X_test)

rf_mae = mean_absolute_error(y_test, rf_pred)
rf_r2 = r2_score(y_test, rf_pred)

print(f"Random Forest  MAE: {rf_mae:.4f}, R2: {rf_r2:.4f}")


# ---------- 3. Train Gradient Boosting ----------
print("Training Gradient Boosting...")
gb_model = GradientBoostingRegressor(
    random_state=42,
)
gb_model.fit(X_train, y_train)
gb_pred = gb_model.predict(X_test)

gb_mae = mean_absolute_error(y_test, gb_pred)
gb_r2 = r2_score(y_test, gb_pred)

print(f"Gradient Boosting MAE: {gb_mae:.4f}, R2: {gb_r2:.4f}")


# ---------- 4. เตรียมข้อมูลสำหรับ LSTM ----------
print("Preparing data for LSTM...")

# รวม feature + target เพื่อ normalize พร้อมกัน
full_data = df[FEATURE_COLS + [TARGET_COL]].values

scaler = MinMaxScaler()
scaled_data = scaler.fit_transform(full_data)

def create_sequences(data: np.ndarray, window: int):
    X_seq, y_seq = [], []
    for i in range(window, len(data)):
        X_seq.append(data[i - window:i, :-1])  # ทุกคอลัมน์ยกเว้น target
        y_seq.append(data[i, -1])              # คอลัมน์สุดท้าย = close
    return np.array(X_seq), np.array(y_seq)

X_lstm, y_lstm = create_sequences(scaled_data, LSTM_WINDOW_SIZE)

split_idx = int(len(X_lstm) * 0.8)
X_train_lstm = X_lstm[:split_idx]
X_test_lstm = X_lstm[split_idx:]
y_train_lstm = y_lstm[:split_idx]
y_test_lstm = y_lstm[split_idx:]

print("LSTM shapes ->",
      "X_train:", X_train_lstm.shape,
      "X_test:", X_test_lstm.shape)


# ---------- 5. สร้าง & เทรน LSTM ----------
print("Training LSTM...")

lstm_model = Sequential([
    LSTM(64, return_sequences=True, input_shape=(LSTM_WINDOW_SIZE, len(FEATURE_COLS))),
    LSTM(32),
    Dense(1)
])

lstm_model.compile(optimizer="adam", loss="mse")

early_stop = EarlyStopping(
    monitor="val_loss",
    patience=5,
    restore_best_weights=True,
)

history = lstm_model.fit(
    X_train_lstm,
    y_train_lstm,
    validation_split=0.1,
    epochs=50,
    batch_size=32,
    callbacks=[early_stop],
    verbose=1,
)

lstm_pred_scaled = lstm_model.predict(X_test_lstm).flatten()

# แปลงค่าทำนาย LSTM กลับสเกลเดิม (เอาเฉพาะคอลัมน์ close)
# สร้าง array ว่างเพื่อ inverse
temp = np.zeros((len(lstm_pred_scaled), full_data.shape[1]))
temp[:, -1] = lstm_pred_scaled
inv_pred = scaler.inverse_transform(temp)[:, -1]

# y_test_lstm ก็ต้อง inverse เหมือนกัน
temp_true = np.zeros((len(y_test_lstm), full_data.shape[1]))
temp_true[:, -1] = y_test_lstm
inv_true = scaler.inverse_transform(temp_true)[:, -1]

lstm_mae = mean_absolute_error(inv_true, inv_pred)
lstm_r2 = r2_score(inv_true, inv_pred)

print(f"LSTM           MAE: {lstm_mae:.4f}, R2: {lstm_r2:.4f}")


# ---------- 6. เซฟโมเดล + metrics ----------
import joblib

joblib.dump(rf_model, os.path.join(MODEL_DIR, "random_forest.pkl"))
joblib.dump(gb_model, os.path.join(MODEL_DIR, "gradient_boosting.pkl"))
lstm_model.save(os.path.join(MODEL_DIR, "lstm_model.keras"))
joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))

metrics = {
    "random_forest": {
        "mae": rf_mae,
        "r2": rf_r2,
    },
    "gradient_boosting": {
        "mae": gb_mae,
        "r2": gb_r2,
    },
    "lstm": {
        "mae": lstm_mae,
        "r2": lstm_r2,
        "window_size": LSTM_WINDOW_SIZE,
    },
    "feature_cols": FEATURE_COLS,
    "target_col": TARGET_COL,
}

with open(os.path.join(MODEL_DIR, "metrics.json"), "w", encoding="utf-8") as f:
    json.dump(metrics, f, indent=2, ensure_ascii=False)

print("Done! Models and metrics are saved in:", MODEL_DIR)
