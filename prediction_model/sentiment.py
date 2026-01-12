import requests
import pandas as pd

URL = "https://api.alternative.me/fng/?limit=0&format=json"

resp = requests.get(URL)
data = resp.json()["data"]

rows = []
for item in data:
    rows.append({
        "date": pd.to_datetime(item["timestamp"], unit="s"),
        "sentiment": (int(item["value"]) - 50) / 50  # normalize -> [-1, 1]
    })

df = pd.DataFrame(rows)
df = df.sort_values("date")

df.to_csv("data/btc_sentiment.csv", index=False)

print("Saved btc_sentiment.csv")
