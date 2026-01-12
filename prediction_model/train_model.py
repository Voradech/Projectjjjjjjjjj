import os
import json
import numpy as np
import pandas as pd

from sklearn.metrics import mean_absolute_error, r2_score
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import MinMaxScaler

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

import joblib
HORIZONS = [1, 7, 14]

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
    "sentiment",
]

TARGET_COL = "close"

LSTM_WINDOW_SIZE = 30  # ใช้ 30 แท่งทำนายแท่งถัดไป
TEST_SIZE = 0.3        # ทำให้เหมือนกันทั้ง 3 โมเดล


def create_sequences(X_data, y_data, window):
    """สร้าง sequences สำหรับ LSTM"""
    X_seq, y_seq = [], []
    for i in range(window, len(X_data)):
        X_seq.append(X_data[i - window:i])  # window แท่งก่อนหน้า
        y_seq.append(y_data[i])             # target ของแท่งถัดไป
    return np.array(X_seq), np.array(y_seq)


# ---------- 1. โหลด & เตรียมข้อมูล ----------
print("Loading data from:", DATA_PATH)
df = pd.read_csv(DATA_PATH)

df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date")

df = df.dropna()
df = df.drop_duplicates()
# ---------- Load News Sentiment ----------
SENTIMENT_PATH = os.path.join(BASE_DIR, "data", "btc_sentiment.csv")
sent_df = pd.read_csv(SENTIMENT_PATH)

sent_df["date"] = pd.to_datetime(sent_df["date"])

# merge ข่าวเข้ากับข้อมูลราคา
df = df.merge(sent_df, on="date", how="left")

# ถ้าวันไหนไม่มีข่าว → neutral
df["sentiment"] = df["sentiment"].fillna(0)

# ---------- Feature Engineering ----------
# Lag features
df["close_lag_1"] = df["close"].shift(1)
df["close_lag_7"] = df["close"].shift(7)
df["close_lag_14"] = df["close"].shift(14)

# Returns
df["return_1d"] = df["close"].pct_change()

# Moving averages
df["ma_7"] = df["close"].rolling(window=7).mean()
df["ma_14"] = df["close"].rolling(window=14).mean()

# Volatility
df["vol_7"] = df["return_1d"].rolling(window=7).std()


# กันพลาด: ensure คอลัมน์ครบ
missing_cols = [c for c in (["date"] + FEATURE_COLS + [TARGET_COL]) if c not in df.columns]
if missing_cols:
    raise ValueError(f"Missing columns in CSV: {missing_cols}")

#  แก้ไข Target Leakage: สร้าง target เป็นราคาปิดของแท่งถัดไป
print("Creating multi-horizon targets (t+1, t+7, t+14)...")
for h in HORIZONS:
    df[f"close_t+{h}"] = df["close"].shift(-h)
df = df.dropna()

all_metrics = {}

for h in HORIZONS:
    print(f"\n==============================")
    print(f" Training horizon t+{h}")
    print(f"==============================")

    target_col = f"close_t+{h}"
# ---------- 2. แบ่งข้อมูลตามเวลา (70/30) ----------
    split_idx = int(len(df) * (1 - TEST_SIZE))
    train_df = df.iloc[:split_idx].copy()
    test_df = df.iloc[split_idx:].copy()

    print(f"Train size: {len(train_df)}, Test size: {len(test_df)}")

    # ---------- 3. เตรียมข้อมูลสำหรับ RF & GB ----------
    X_train_raw = train_df[FEATURE_COLS].values
    y_train_raw = train_df[target_col].values

    X_test_raw = test_df[FEATURE_COLS].values
    y_test_raw = test_df[target_col].values

    #  Scale features เพื่อป้องกัน leakage (fit เฉพาะ train)
    scaler_X_tree = MinMaxScaler()
    X_train_scaled = scaler_X_tree.fit_transform(X_train_raw)
    X_test_scaled = scaler_X_tree.transform(X_test_raw)

    # ---------- 4. Train Random Forest ----------
    print("\nTraining Random Forest...")
    rf_model = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        n_jobs=-1,
    )
    rf_model.fit(X_train_scaled, y_train_raw)
    rf_pred = rf_model.predict(X_test_scaled)

    rf_mae = mean_absolute_error(y_test_raw, rf_pred)
    rf_r2 = r2_score(y_test_raw, rf_pred)

    print(f"Random Forest      MAE: {rf_mae:.4f}, R2: {rf_r2:.4f}")

    # ---------- 5. Train Gradient Boosting ----------
    print("Training Gradient Boosting...")
    gb_model = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=5,
        min_samples_split=5,
        random_state=42,
    )
    gb_model.fit(X_train_scaled, y_train_raw)
    gb_pred = gb_model.predict(X_test_scaled)

    gb_mae = mean_absolute_error(y_test_raw, gb_pred)
    gb_r2 = r2_score(y_test_raw, gb_pred)

    print(f"Gradient Boosting  MAE: {gb_mae:.4f}, R2: {gb_r2:.4f}")

    # ---------- 6. เตรียมข้อมูลสำหรับ LSTM ----------
    print("\nPreparing data for LSTM...")

    scaler_X_lstm = MinMaxScaler()
    scaler_y_lstm = MinMaxScaler()

    # Scale features (fit เฉพาะ train)
    train_X_scaled = scaler_X_lstm.fit_transform(train_df[FEATURE_COLS].values)
    test_X_scaled = scaler_X_lstm.transform(test_df[FEATURE_COLS].values)

    # Scale target (fit เฉพาะ train)
    train_y_scaled = scaler_y_lstm.fit_transform(train_df[[target_col]].values).flatten()

    # สร้าง sequences แยกฝั่ง train/test
    X_train_lstm, y_train_lstm = create_sequences(train_X_scaled, train_y_scaled, LSTM_WINDOW_SIZE)
   
    # === FIX: ใช้ 30 วันสุดท้ายของ train + test สำหรับ LSTM test ===

    # รวม features: 30 วันสุดท้ายของ train + test
    lstm_test_input_X = pd.concat([
        train_df[FEATURE_COLS].tail(LSTM_WINDOW_SIZE),
        test_df[FEATURE_COLS]
    ])

    # scale X ด้วย scaler ที่ fit จาก train
    X_lstm_test_scaled = scaler_X_lstm.transform(lstm_test_input_X.values)

    # สร้าง dummy y (ยาวเท่ากัน) เพื่อใช้สร้าง sequence
    dummy_y = np.zeros(len(X_lstm_test_scaled))

    # สร้าง sequence
    X_test_lstm_all, _ = create_sequences(
        X_lstm_test_scaled,
        dummy_y,
        LSTM_WINDOW_SIZE
    )

    # เอาเฉพาะส่วนที่เป็น test จริง
    X_test_lstm = X_test_lstm_all[-len(test_df):]

    # y test (original scale)
    y_test_lstm_original = test_df[target_col].values



    print("LSTM shapes ->",
        "X_train:", X_train_lstm.shape,
        "X_test:", X_test_lstm.shape)

    # ---------- 7. สร้าง & เทรน LSTM ----------
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

    # ทำนาย (scaled)
    lstm_pred_scaled = lstm_model.predict(X_test_lstm, verbose=0).flatten()

    # inverse กลับเป็นราคาจริง
    lstm_pred = scaler_y_lstm.inverse_transform(lstm_pred_scaled.reshape(-1, 1)).flatten()
   

    lstm_mae = mean_absolute_error(y_test_lstm_original, lstm_pred)
    lstm_r2 = r2_score(y_test_lstm_original, lstm_pred)

    print(f"LSTM              MAE: {lstm_mae:.4f}, R2: {lstm_r2:.4f}")

    # ---------- 8. เซฟโมเดล + scalers + metrics ----------
    print("\nSaving models...")
    joblib.dump(rf_model, os.path.join(MODEL_DIR, f"random_forest+{h}.pkl"))
    joblib.dump(gb_model, os.path.join(MODEL_DIR, f"gradient_boosting+{h}.pkl"))
    joblib.dump(scaler_X_tree, os.path.join(MODEL_DIR, f"scaler_X_tree+{h}.pkl"))

    lstm_model.save(os.path.join(MODEL_DIR, f"lstm_model+{h}.keras"))
    joblib.dump(scaler_X_lstm, os.path.join(MODEL_DIR, f"scaler_X_lstm+{h}.pkl"))
    joblib.dump(scaler_y_lstm, os.path.join(MODEL_DIR, f"scaler_y_lstm+{h}.pkl"))

    metrics = {
        "horizon": f"t+{h}",
        "random_forest": {"mae": float(rf_mae), "r2": float(rf_r2)},
        "gradient_boosting": {"mae": float(gb_mae), "r2": float(gb_r2)},
        "lstm": {"mae": float(lstm_mae), "r2": float(lstm_r2)},
    }
    all_metrics[f"t+{h}"] = metrics

print(f"Total samples after target shift: {len(df)}")


with open(os.path.join(MODEL_DIR, "metrics.json"), "w", encoding="utf-8") as f:
    json.dump(all_metrics, f, indent=2, ensure_ascii=False)

print("\n Done! Models and metrics are saved in:", MODEL_DIR)
    