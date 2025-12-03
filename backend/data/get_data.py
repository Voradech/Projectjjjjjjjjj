import yfinance as yf
import pandas as pd

def download_btc():
    btc = yf.Ticker("BTC-USD")
    df = btc.history(period="2y", interval="1d")

    print("Sample data:")
    print(df.head())

    df.to_csv("btc_price.csv")
    print("\nSaved as btc_price.csv")

if __name__ == "__main__":
    download_btc()
