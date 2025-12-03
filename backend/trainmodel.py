import os
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_absolute_percentage_error, r2_score
from sklearn.preprocessing import StandardScaler
import joblib

# 1) โหลดข้อมูลจากไฟล์ CSV
data_path = os.path.join("data", "btc_price.csv")
df = pd.read_csv(data_path)

# ตรวจสอบข้อมูล
print(f"Dataset shape: {df.shape}")
print(f"\nMissing values:\n{df.isnull().sum()}")
print(f"\nFirst few rows:\n{df.head()}")

# เลือกคอลัมน์ที่จะใช้เป็น input (features) และ output (target)
feature_cols = ["Open", "High", "Low", "Volume"]
target_col = "Close"

X = df[feature_cols]
y = df[target_col]

# 2) แบ่งข้อมูล train/test
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

# 3) Feature Scaling
scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

# 4) สร้างและเทรนโมเดลแบบ Linear Regression
model = LinearRegression()
model.fit(X_train_scaled, y_train)

# 5) ประเมินโมเดลเบื้องต้น
y_pred = model.predict(X_test_scaled)

mae = mean_absolute_error(y_test, y_pred)
mape = mean_absolute_percentage_error(y_test, y_pred) * 100
r2 = r2_score(y_test, y_pred)

print(f"\n=== Model Performance ===")
print(f"MAE: {mae:.4f}")
print(f"MAPE: {mape:.2f}%")
print(f"R² Score: {r2:.4f}")

# 6) เซฟโมเดลและ scaler เป็นไฟล์ .pkl
os.makedirs("model", exist_ok=True)
model_path = os.path.join("model", "bitcoin_model.pkl")
scaler_path = os.path.join("model", "scaler.pkl")

joblib.dump(model, model_path)
joblib.dump(scaler, scaler_path)

print(f"\nโมเดลถูกบันทึกที่: {model_path}")
print(f"Scaler ถูกบันทึกที่: {scaler_path}")