import requests
import pandas as pd
import time
import sys

def get_binance_klines(symbol="BTCUSDT", interval="1d", start_time=None, end_time=None, limit=1000):
    """
    ดึงข้อมูล K-lines (แท่งเทียน) รายวัน (1d) จาก Binance API
    """
    url = "https://api.binance.com/api/v3/klines"
    
    params = {
        "symbol": symbol,
        # *** กำหนดช่วงเวลาเป็น 1 วัน (1d) ***
        "interval": interval, 
        "limit": limit
    }
    
    if start_time:
        params["startTime"] = start_time
    if end_time:
        params["endTime"] = end_time

    try:
        response = requests.get(url, params=params, timeout=20) 
        response.raise_for_status() 
    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from Binance API: {e}")
        return pd.DataFrame() 

    data = response.json()
    if not isinstance(data, list):
         print(f"Error: API response is not a list. Response: {data}")
         return pd.DataFrame()


    # คอลัมน์ทั้งหมดจาก Binance Klines API (ตามที่คุณต้องการ)
    cols = ["open_time", "open", "high", "low", "close", "volume",
            "close_time", "quote_asset_volume", "trades",
            "taker_buy_base", "taker_buy_quote", "ignore"]

    df = pd.DataFrame(data, columns=cols)
    if df.empty:
        return df
        
    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    df["close_time"] = pd.to_datetime(df["close_time"], unit="ms")
    
    numeric_cols = ["open", "high", "low", "close", "volume", 
                    "quote_asset_volume", "trades", 
                    "taker_buy_base", "taker_buy_quote"]
    
    for col in numeric_cols:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors='coerce') 

    return df


def download_btc_historical_data(days=365 * 5):
    """
    ดาวน์โหลดข้อมูล BTC/USDT รายวัน (1d) ย้อนหลัง 5 ปี (หรือตามจำนวนวันที่กำหนด)
    """
    print(f"Downloading BTC **1-day** data for the past {days} days from Binance...")

    target_days = days
    end_time_ms = int(time.time() * 1000)
    
    # ดึงข้อมูลรายวัน 5 ปี (~1825 วัน) ต้องใช้ 2 รอบ (Batch)
    loops = (target_days // 1000) + 1 

    all_df = []
    current_end_time = end_time_ms

    for i in range(loops):
        print(f"Fetching batch {i+1}/{loops}...")
        
        # ดึงข้อมูลรายวัน (1d)
        df = get_binance_klines("BTCUSDT", "1d", end_time=current_end_time, limit=1000)
        
        if df.empty:
            print("No more data received or an error occurred. Stopping download.")
            break
            
        all_df.append(df)
        
        # อัพเดท current_end_time 
        oldest_open_time = df["open_time"].iloc[0]
        current_end_time = int(oldest_open_time.timestamp() * 1000) - 1
        
        time.sleep(0.3) 

    # รวมทุก batch และทำความสะอาดข้อมูล
    final_df = pd.concat(all_df, ignore_index=True)
    final_df = final_df.drop_duplicates(subset=['open_time'])
    final_df = final_df.sort_values("open_time").reset_index(drop=True)
    
    # เปลี่ยนชื่อคอลัมน์ open_time เป็น date
    final_df = final_df.rename(columns={"open_time": "date"})
    
    # กรองข้อมูลให้ตรงตามช่วงเวลาที่ต้องการ (5 ปี)
    # (3600*1000*24 คือ จำนวน milliseconds ใน 1 วัน)
    start_target_time = pd.to_datetime(end_time_ms - target_days * 3600 * 1000 * 24, unit='ms')
    final_df = final_df[final_df['date'] >= start_target_time].copy()

    # บันทึกเป็น CSV
    filename = f"BTCDATA_1d_full.csv"
    final_df.to_csv(filename, index=False)

    print(f"\n--- Download Complete ---")
    print(f"Saved {final_df.shape[0]} records (days) as **{filename}**")
    print(f"Data includes: {', '.join(final_df.columns)}")
    print("\nHead of Data:")
    print(final_df.head())
    print("\nTail of Data:")
    print(final_df.tail())
    print("-------------------------")


if __name__ == "__main__":
    try:
        # 5 ปี = 1825 วัน 
        days_to_download = 5 * 365 
        download_btc_historical_data(days=days_to_download)
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        sys.exit(1)