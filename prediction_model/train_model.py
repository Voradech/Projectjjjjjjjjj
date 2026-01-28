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

LSTM_WINDOW_SIZE = 30
TEST_SIZE = 0.3


# ================= UTILS =================
def create_sequences(X, y, window):
    X_seq, y_seq = [], []
    for i in range(window, len(X)):
        X_seq.append(X[i - window:i])
        y_seq.append(y[i])
    return np.array(X_seq), np.array(y_seq)


# ================= LOAD DATA =================
print("Loading data:", DATA_PATH)
df = pd.read_csv(DATA_PATH)

df["date"] = pd.to_datetime(df["date"])
df = df.sort_values("date").dropna().drop_duplicates()

# ---------- Sentiment ----------
sent_df = pd.read_csv(os.path.join(BASE_DIR, "data", "btc_sentiment.csv"))
sent_df["date"] = pd.to_datetime(sent_df["date"])
df = df.merge(sent_df, on="date", how="left")
df["sentiment"] = df["sentiment"].fillna(0)


# ================= FEATURE ENGINEERING =================
df["return_1d"] = df["close"].pct_change()
df["ma_7"] = df["close"].rolling(7).mean()
df["ma_14"] = df["close"].rolling(14).mean()
df["vol_7"] = df["return_1d"].rolling(7).std()

# ---------- Targets ----------
for h in HORIZONS:
    df[f"close_t+{h}"] = df["close"].shift(-h)
    df[f"return_t+{h}"] = (df[f"close_t+{h}"] - df["close"]) / df["close"]

df = df.dropna()


# ================= TRAIN =================
all_metrics = {}

for h in HORIZONS:
    print(f"\n========== TRAIN t+{h} ==========")
    target_col = f"return_t+{h}"

    split_idx = int(len(df) * (1 - TEST_SIZE))
    train_df = df.iloc[:split_idx]
    test_df = df.iloc[split_idx:]

    X_train = train_df[FEATURE_COLS].values
    y_train = train_df[target_col].values
    X_test = test_df[FEATURE_COLS].values
    y_test = test_df[target_col].values

    # ---------- SCALE ----------
    scaler_tree = MinMaxScaler()
    X_train_s = scaler_tree.fit_transform(X_train)
    X_test_s = scaler_tree.transform(X_test)

    # ---------- Random Forest ----------
    rf = RandomForestRegressor(
        n_estimators=200,
        random_state=42,
        n_jobs=-1
    )
    rf.fit(X_train_s, y_train)
    rf_pred = rf.predict(X_test_s)

    rf_mae = mean_absolute_error(y_test, rf_pred)
    rf_rmse = np.sqrt(mean_squared_error(y_test, rf_pred))

    print(f"RF  MAE: {rf_mae:.6f} | RMSE: {rf_rmse:.6f}")

    # ---------- Gradient Boosting ----------
    gb = GradientBoostingRegressor(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=5,
        random_state=42
    )
    gb.fit(X_train_s, y_train)
    gb_pred = gb.predict(X_test_s)

    gb_mae = mean_absolute_error(y_test, gb_pred)
    gb_rmse = np.sqrt(mean_squared_error(y_test, gb_pred))

    print(f"GB  MAE: {gb_mae:.6f} | RMSE: {gb_rmse:.6f}")

    # ---------- LSTM ----------
    scaler_lstm = MinMaxScaler()
    X_train_lstm = scaler_lstm.fit_transform(train_df[FEATURE_COLS].values)

    X_train_seq, y_train_seq = create_sequences(
        X_train_lstm,
        y_train,
        LSTM_WINDOW_SIZE
    )

    lstm_input = pd.concat([
        train_df[FEATURE_COLS].tail(LSTM_WINDOW_SIZE),
        test_df[FEATURE_COLS]
    ])
    X_test_lstm = scaler_lstm.transform(lstm_input.values)
    X_test_seq, _ = create_sequences(
        X_test_lstm,
        np.zeros(len(X_test_lstm)),
        LSTM_WINDOW_SIZE
    )
    X_test_seq = X_test_seq[-len(test_df):]

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
        validation_split=0.1,
        epochs=50,
        batch_size=32,
        callbacks=[EarlyStopping(patience=5, restore_best_weights=True)],
        verbose=0
    )

    lstm_pred = lstm.predict(X_test_seq, verbose=0).flatten()

    lstm_mae = mean_absolute_error(y_test, lstm_pred)
    lstm_rmse = np.sqrt(mean_squared_error(y_test, lstm_pred))

    print(f"LSTM MAE: {lstm_mae:.6f} | RMSE: {lstm_rmse:.6f}")

    # ---------- SAVE ----------
    joblib.dump(rf, os.path.join(MODEL_DIR, f"rf_return+{h}.pkl"))
    joblib.dump(gb, os.path.join(MODEL_DIR, f"gb_return+{h}.pkl"))
    joblib.dump(scaler_tree, os.path.join(MODEL_DIR, f"scaler_tree+{h}.pkl"))
    joblib.dump(scaler_lstm, os.path.join(MODEL_DIR, f"scaler_lstm+{h}.pkl"))
    lstm.save(os.path.join(MODEL_DIR, f"lstm_return+{h}.keras"))

    all_metrics[f"t+{h}"] = {
        "random_forest": {"mae": rf_mae, "rmse": rf_rmse},
        "gradient_boosting": {"mae": gb_mae, "rmse": gb_rmse},
        "lstm": {"mae": lstm_mae, "rmse": lstm_rmse},
    }


# ================= SAVE METRICS =================
with open(os.path.join(MODEL_DIR, "metrics.json"), "w", encoding="utf-8") as f:
    json.dump(all_metrics, f, indent=2, ensure_ascii=False)

print("\n DONE: Return-based price models saved.")
