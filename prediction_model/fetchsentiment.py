import requests
import pandas as pd
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

API_KEY = "8f87744ac1b3ada2ef0b3c388dfb64a0434a97d5"
URL = "https://cryptopanic.com/api/developer/v2/posts/?auth_token=8f87744ac1b3ada2ef0b3c388dfb64a0434a97d5"

params = {
    "auth_token": API_KEY,
    "currencies": "BTC",
    "kind": "news",
    "public": "true"
}

analyzer = SentimentIntensityAnalyzer()

resp = requests.get(URL, params=params)

# 🔎 DEBUG
print("Status code:", resp.status_code)
print("Response preview:", resp.text[:300])

# ❌ ถ้าไม่ใช่ 200 ให้หยุดทันที
if resp.status_code != 200:
    raise RuntimeError("CryptoPanic API error")

# ❌ ถ้า response ว่าง
if not resp.text.strip():
    raise RuntimeError("Empty response from CryptoPanic")

data = resp.json().get("results", [])

rows = []
for item in data:
    title = item.get("title", "")
    score = analyzer.polarity_scores(title)["compound"]

    rows.append({
        "date": pd.to_datetime(item["published_at"]).date(),
        "sentiment": score
    })

df = pd.DataFrame(rows)

if df.empty:
    raise RuntimeError("No news data returned")

daily_sent = df.groupby("date")["sentiment"].mean().reset_index()
daily_sent.to_csv("data/btc_sentiment.csv", index=False)

print("Saved data/btc_sentiment.csv")
