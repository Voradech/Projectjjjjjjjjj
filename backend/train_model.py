#โมเดลตัวปัจจุบัน
import os
import json
import numpy as np
import pandas as pd

from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import MinMaxScaler

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
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
df = df.drop_duplicates()

# เลือกเฉพาะคอลัมน์ที่ต้องใช้
df_features = df[FEATURE_COLS]
df_target = df[TARGET_COL]

X = df_features.values
y = df_target.values

# แบ่ง Train/Test แบบไม่ shuffle (รักษาลำดับเวลา)
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.3, shuffle=False
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
    n_estimators=200,
    learning_rate=0.1,
    max_depth=5,
    min_samples_split=5,
    random_state=42,
)
gb_model.fit(X_train, y_train)
gb_pred = gb_model.predict(X_test)

gb_mae = mean_absolute_error(y_test, gb_pred)
gb_r2 = r2_score(y_test, gb_pred)

print(f"Gradient Boosting MAE: {gb_mae:.4f}, R2: {gb_r2:.4f}")


# ---------- 4. เตรียมข้อมูลสำหรับ LSTM ----------
print("Preparing data for LSTM...")

# แยก scaler สำหรับ X และ y
scaler_X = MinMaxScaler()
scaler_y = MinMaxScaler()

# Scale ข้อมูลทั้งหมด (จะ split ทีหลัง)
scaled_features = scaler_X.fit_transform(df[FEATURE_COLS].values)
scaled_target = scaler_y.fit_transform(df[[TARGET_COL]].values).flatten()

def create_sequences(X_data, y_data, window):
    """สร้าง sequences สำหรับ LSTM"""
    X_seq, y_seq = [], []
    for i in range(window, len(X_data)):
        X_seq.append(X_data[i - window:i])  # เอา window แท่งก่อนหน้า
        y_seq.append(y_data[i])              # เอาค่า target ของแท่งปัจจุบัน
    return np.array(X_seq), np.array(y_seq)

# สร้าง sequences
X_lstm, y_lstm = create_sequences(scaled_features, scaled_target, LSTM_WINDOW_SIZE)

# Split train/test
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
    Dropout(0.2),
    LSTM(32),
    Dropout(0.2),
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

# ทำนายและแปลงกลับ
lstm_pred_scaled = lstm_model.predict(X_test_lstm, verbose=0).flatten()

# Inverse transform (ใช้ scaler_y ที่แยกไว้)
lstm_pred = scaler_y.inverse_transform(lstm_pred_scaled.reshape(-1, 1)).flatten()
y_test_lstm_original = scaler_y.inverse_transform(y_test_lstm.reshape(-1, 1)).flatten()

lstm_mae = mean_absolute_error(y_test_lstm_original, lstm_pred)
lstm_r2 = r2_score(y_test_lstm_original, lstm_pred)

print(f"LSTM           MAE: {lstm_mae:.4f}, R2: {lstm_r2:.4f}")


# ---------- 6. เซฟโมเดล + metrics ----------
import joblib

joblib.dump(rf_model, os.path.join(MODEL_DIR, "random_forest.pkl"))
joblib.dump(gb_model, os.path.join(MODEL_DIR, "gradient_boosting.pkl"))
lstm_model.save(os.path.join(MODEL_DIR, "lstm_model.keras"))
joblib.dump(scaler_X, os.path.join(MODEL_DIR, "scaler_X.pkl"))
joblib.dump(scaler_y, os.path.join(MODEL_DIR, "scaler_y.pkl"))

metrics = {
    "random_forest": {
        "mae": float(rf_mae),
        "r2": float(rf_r2),
    },
    "gradient_boosting": {
        "mae": float(gb_mae),
        "r2": float(gb_r2),
    },
    "lstm": {
        "mae": float(lstm_mae),
        "r2": float(lstm_r2),
        "window_size": LSTM_WINDOW_SIZE,
    },
    "feature_cols": FEATURE_COLS,
    "target_col": TARGET_COL,
}

with open(os.path.join(MODEL_DIR, "metrics.json"), "w", encoding="utf-8") as f:
    json.dump(metrics, f, indent=2, ensure_ascii=False)

print("Done! Models and metrics are saved in:", MODEL_DIR)