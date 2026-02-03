import os
import json
import numpy as np
import pandas as pd
import joblib

from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping


# ================= CONFIG =================
HORIZONS = [1, 7, 14]

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_PATH = os.path.join(BASE_DIR, "data", "BTCDATA_1d_full.csv")
MODEL_DIR = os.path.join(BASE_DIR, "model")
os.makedirs(MODEL_DIR, exist_ok=True)

# เฉพาะ features ที่มีในข้อมูลดิบ
BASE_FEATURE_COLS = [
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

LSTM_WINDOW_SIZE = 30
TEST_SIZE = 0.3


# ================= UTILS =================
def create_sequences(X, y, window):
    """สร้าง sequences สำหรับ LSTM"""
    X_seq, y_seq = [], []
    for i in range(window, len(X)):
        X_seq.append(X[i - window:i])
        y_seq.append(y[i])
    return np.array(X_seq), np.array(y_seq)


def create_features(df):
    df = df.copy()

    # Returns (ใช้ข้อมูลอดีต)
    df["return_1d"]  = df["close"].pct_change(1).shift(1)
    df["return_7d"]  = df["close"].pct_change(7).shift(1)
    df["return_14d"] = df["close"].pct_change(14).shift(1)

    # Moving averages (คำนวณภายใน df นี้เท่านั้น)
    df["ma_7"]  = df["close"].rolling(7, min_periods=7).mean()
    df["ma_14"] = df["close"].rolling(14, min_periods=14).mean()
    df["ma_ratio_7"]  = df["close"] / df["ma_7"]
    df["ma_ratio_14"] = df["close"] / df["ma_14"]

    # Volatility
    returns = df["close"].pct_change(1)
    df["vol_7"] = returns.shift(1).rolling(7, min_periods=7).std()
    df["vol_14"] = returns.shift(1).rolling(14, min_periods=14).std()

    # Lag prices (ใช้อดีต)
    df["close_lag1"]  = df["close"].shift(1)
    df["close_lag7"]  = df["close"].shift(7)
    df["close_lag14"] = df["close"].shift(14)

    # Lag volume
    df["volume_lag1"]  = df["volume"].shift(1)
    df["volume_lag7"]  = df["volume"].shift(7)
    df["volume_lag14"] = df["volume"].shift(14)

    return df


def prepare_train_test_split(df, test_size=0.3, horizons=[1, 7, 14]):

    # 1. Sort และ reset index
    df = df.sort_values("date").reset_index(drop=True)
    
    # 2. Split ข้อมูลดิบก่อน (ก่อนสร้าง features)
    split_idx = int(len(df) * (1 - test_size))
    
    train_raw = df.iloc[:split_idx].copy()
    test_raw = df.iloc[split_idx:].copy()
    
    print(f"\nSplit at index {split_idx}")
    print(f"Train raw: {train_raw['date'].min()} to {train_raw['date'].max()} ({len(train_raw)} rows)")
    print(f"Test raw:  {test_raw['date'].min()} to {test_raw['date'].max()} ({len(test_raw)} rows)")
    
    # 3. สร้าง features แยกกัน
    print("\n Creating features separately for train and test...")
    train_df = create_features(train_raw)
    test_df = create_features(test_raw)
    
    # 4. สร้าง targets แยกกัน
    for h in horizons:
        train_df[f"close_t+{h}"] = train_df["close"].shift(-h)
        train_df[f"return_t+{h}"] = (
            (train_df[f"close_t+{h}"] - train_df["close"]) / train_df["close"]
        )
        
        test_df[f"close_t+{h}"] = test_df["close"].shift(-h)
        test_df[f"return_t+{h}"] = (
            (test_df[f"close_t+{h}"] - test_df["close"]) / test_df["close"]
        )
    
    # 5. ลบ NaN
    train_df = train_df.dropna()
    test_df = test_df.dropna()
    
    print(f"\n After feature engineering:")
    print(f"Train: {len(train_df)} rows ({train_df['date'].min()} to {train_df['date'].max()})")
    print(f"Test:  {len(test_df)} rows ({test_df['date'].min()} to {test_df['date'].max()})")
    
    return train_df, test_df


def check_no_leakage(train_df, test_df):
  
    train_max_date = train_df['date'].max()
    test_min_date = test_df['date'].min()
    
    assert test_min_date > train_max_date, \
        f" DATA LEAKAGE DETECTED: test starts before train ends!"
    
    print(f"\n NO TEMPORAL LEAKAGE:")
    print(f"   Train ends:  {train_max_date}")
    print(f"   Test starts: {test_min_date}")
    print(f"   Gap: {(test_min_date - train_max_date).days} days")
    
    return True


# รายการ features ทั้งหมด
FEATURE_COLS = BASE_FEATURE_COLS + [
    "return_1d",
    "return_7d",
    "return_14d",
    "ma_7", 
    "ma_14",
    "ma_ratio_7",
    "ma_ratio_14",
    "vol_7",
    "vol_14",
    "close_lag1", 
    "close_lag7",
    "close_lag14", 
    "volume_lag1",
    "volume_lag7",
    "volume_lag14",
]   


# ================= LOAD DATA =================
print("="*60)
print(" LOADING DATA")
print("="*60)
print(f"Data path: {DATA_PATH}")

df = pd.read_csv(DATA_PATH)
df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date").drop_duplicates()

# ---------- Sentiment ----------
print("\n Merging sentiment data...")
sent_df = pd.read_csv(os.path.join(BASE_DIR, "data", "btc_sentiment.csv"))
sent_df["date"] = pd.to_datetime(sent_df["date"])
df = df.merge(sent_df, on="date", how="left")
df["sentiment"] = df["sentiment"].fillna(0)

# ตรวจสอบข้อมูลดิบ
print(f"\n Raw data info:")
print(f"Shape: {df.shape}")
print(f"Date range: {df['date'].min()} to {df['date'].max()}")
print(f"\nMissing values in base features:")
print(df[BASE_FEATURE_COLS + ['close']].isnull().sum())

# ลบ missing ในข้อมูลดิบ
df = df.dropna(subset=BASE_FEATURE_COLS + ["close"])
print(f"\nAfter dropping missing: {len(df)} rows")


# ================= TRAIN/TEST SPLIT (NO LEAKAGE!) =================
print("\n" + "="*60)
print("  SPLITTING DATA (NO LEAKAGE)")
print("="*60)

#  Split แบบปลอดภัย - ไม่มี data leakage
train_df, test_df = prepare_train_test_split(df, TEST_SIZE, HORIZONS)

# ตรวจสอบว่าไม่มี leakage
check_no_leakage(train_df, test_df)

print(f"\n Features: {len(FEATURE_COLS)}")
print(f"Feature list: {FEATURE_COLS[:5]}... (and {len(FEATURE_COLS)-5} more)")


# ================= TRAIN MODELS =================
print("\n" + "="*60)
print(" TRAINING MODELS")
print("="*60)

all_metrics = {}

for h in HORIZONS:
    print(f"\n{'='*60}")
    print(f" TRAINING HORIZON t+{h}")
    print(f"{'='*60}")
    
    target_col = f"return_t+{h}"

    # ตรวจสอบว่ามี target column
    if target_col not in train_df.columns or target_col not in test_df.columns:
        print(f"  Warning: {target_col} not found in data, skipping...")
        continue

    X_train = train_df[FEATURE_COLS].values
    y_train = train_df[target_col].values
    X_test = test_df[FEATURE_COLS].values
    y_test = test_df[target_col].values

    print(f"\nData shapes:")
    print(f"  X_train: {X_train.shape}")
    print(f"  y_train: {y_train.shape}")
    print(f"  X_test:  {X_test.shape}")
    print(f"  y_test:  {y_test.shape}")

    # ---------- SCALE ----------
    #  Fit scaler บน train เท่านั้น
    print("\n Scaling features...")
    scaler = MinMaxScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s = scaler.transform(X_test)

    # ---------- Random Forest ----------
    print("\n Training Random Forest...")
    rf = RandomForestRegressor(
        n_estimators=200,
        max_depth=15,
        min_samples_split=10,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train_s, y_train)
    rf_pred = rf.predict(X_test_s)

    rf_mae = mean_absolute_error(y_test, rf_pred)
    rf_rmse = np.sqrt(mean_squared_error(y_test, rf_pred))
    rf_direction = np.mean((rf_pred > 0) == (y_test > 0))

    print(f"  MAE: {rf_mae:.6f} | RMSE: {rf_rmse:.6f} | Direction: {rf_direction:.4f}")

    # ---------- Gradient Boosting ----------
    print("\nTraining Gradient Boosting...")
    gb = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=5,
        min_samples_split=10,
        random_state=42
    )
    gb.fit(X_train_s, y_train)
    gb_pred = gb.predict(X_test_s)

    gb_mae = mean_absolute_error(y_test, gb_pred)
    gb_rmse = np.sqrt(mean_squared_error(y_test, gb_pred))
    gb_direction = np.mean((gb_pred > 0) == (y_test > 0))

    print(f"  MAE: {gb_mae:.6f} | RMSE: {gb_rmse:.6f} | Direction: {gb_direction:.4f}")

    # ---------- LSTM ----------
    print("\n Training LSTM...")
    
    # ===== TRAIN SEQUENCE (เหมือนเดิม) =====
    X_train_seq, y_train_seq = create_sequences(
        X_train_s,
        y_train,
        LSTM_WINDOW_SIZE
    )

    # ===== TEST SEQUENCE (ต่อ tail ของ train) =====
    X_all = np.vstack([
        X_train_s[-LSTM_WINDOW_SIZE:], 
        X_test_s
    ])

    y_all = np.concatenate([
        y_train[-LSTM_WINDOW_SIZE:], 
        y_test
    ])

    X_test_seq, y_test_seq = create_sequences(
        X_all,
        y_all,
        LSTM_WINDOW_SIZE
    )
    print(f"  Sequence shapes:")
    print(f"    X_train_seq: {X_train_seq.shape}")
    print(f"    X_test_seq:  {X_test_seq.shape}")

    lstm = Sequential([
        LSTM(64, return_sequences=True, input_shape=(LSTM_WINDOW_SIZE, len(FEATURE_COLS))),
        Dropout(0.2),
        LSTM(32),
        Dropout(0.2),
        Dense(1)
    ])

    lstm.compile(
        optimizer="adam",
        loss="mse",
        metrics=["mae"]
    )

    lstm.fit(
        X_train_seq,
        y_train_seq,
        epochs=50,
        batch_size=32,
        callbacks=[EarlyStopping(patience=5, restore_best_weights=True)],
        verbose=0
    )

    lstm_pred = lstm.predict(X_test_seq, verbose=0).flatten()

    lstm_mae = mean_absolute_error(y_test_seq, lstm_pred)
    lstm_rmse = np.sqrt(mean_squared_error(y_test_seq, lstm_pred))
    lstm_direction = np.mean((lstm_pred > 0) == (y_test_seq > 0))

    print(f"  MAE: {lstm_mae:.6f} | RMSE: {lstm_rmse:.6f} | Direction: {lstm_direction:.4f}")

    # ---------- SAVE MODELS ----------
    print(f"\n Saving models for horizon t+{h}...")
    
    joblib.dump(rf, os.path.join(MODEL_DIR, f"rf_return+{h}.pkl"))
    joblib.dump(gb, os.path.join(MODEL_DIR, f"gb_return+{h}.pkl"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, f"scaler+{h}.pkl"))
    lstm.save(os.path.join(MODEL_DIR, f"lstm_return+{h}.keras"))
    
    # บันทึก feature info สำหรับ production
    feature_info = {
        'feature_cols': FEATURE_COLS,
        'base_feature_cols': BASE_FEATURE_COLS,
        'lstm_window_size': LSTM_WINDOW_SIZE,
        'horizon': h
    }
    joblib.dump(feature_info, os.path.join(MODEL_DIR, f"feature_info+{h}.pkl"))

    # บันทึก metrics
    all_metrics[f"t+{h}"] = {
        "random_forest": {
            "mae": float(rf_mae),
            "rmse": float(rf_rmse),
            "direction_accuracy": float(rf_direction)
        },
        "gradient_boosting": {
            "mae": float(gb_mae),
            "rmse": float(gb_rmse),
            "direction_accuracy": float(gb_direction)
        },
        "lstm": {
            "mae": float(lstm_mae),
            "rmse": float(lstm_rmse),
            "direction_accuracy": float(lstm_direction)
        },
    }

    print(f"  Saved successfully!")


# ================= SAVE METRICS =================
print("\n" + "="*60)
print(" SAVING METRICS")
print("="*60)

with open(os.path.join(MODEL_DIR, "metrics.json"), "w", encoding="utf-8") as f:
    json.dump(all_metrics, f, indent=2, ensure_ascii=False)

print(f"\n{'='*60}")
print("TRAINING COMPLETE!")
print(f"{'='*60}")
print(f"\nSaved to: {MODEL_DIR}")
print(f"\nFiles created:")
print(f"   Models:")
for h in HORIZONS:
    print(f"     - rf_return+{h}.pkl")
    print(f"     - gb_return+{h}.pkl")
    print(f"     - lstm_return+{h}.keras")
    print(f"     - scaler+{h}.pkl")
    print(f"     - feature_info+{h}.pkl")
print(f"   Metrics:")
print(f"     - metrics.json")
print(f"\n{'='*60}")
print(f"{'='*60}\n")