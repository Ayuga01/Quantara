import pandas as pd
import requests
import time

def fetch_klines(symbol, interval, start_ms, end_ms):
    url = "https://api.binance.com/api/v3/klines"
    out = []
    limit = 1000

    current = start_ms

    while current < end_ms:
        params = {
            "symbol": symbol,
            "interval": interval,
            "startTime": current,
            "endTime": end_ms,
            "limit": limit
        }
        
        r = requests.get(url, params=params)
        r.raise_for_status()
        data = r.json()

        if not data:
            break

        out.extend(data)

       
        last_open_time = data[-1][0]
        next_ts = last_open_time + 1

       
        if next_ts <= current:
            break

        current = next_ts
        time.sleep(0.25)  

    return out


def get_clean_klines(symbol, interval, start_ms, end_ms):
    raw = fetch_klines(symbol, interval, start_ms, end_ms)

    df = pd.DataFrame(raw, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_asset_volume", "num_trades",
        "taker_buy_base", "taker_buy_quote", "ignore"
    ])

    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    df = df[["open_time","open","high","low","close","volume"]]

    df = df.sort_values("open_time").reset_index(drop=True)

   
    full_range = pd.date_range(
        start=df["open_time"].iloc[0],
        end=df["open_time"].iloc[-1],
        freq="1H"
    )

   
    df = df.set_index("open_time").reindex(full_range)

    df.index.name = "open_time"

    return df.reset_index()


import datetime
end_dt = datetime.datetime.utcnow()
start_dt = end_dt - datetime.timedelta(days=365.25*5)

start_ms = int(start_dt.timestamp() * 1000)
end_ms   = int(end_dt.timestamp() * 1000)

coins = {
    "BTCUSDT": "bitcoin",
    "ETHUSDT": "ethereum",
    "BNBUSDT": "binancecoin",
    "ADAUSDT": "cardano",
    "SOLUSDT": "solana"
}

for symbol, name in coins.items():
    print(f"Fetching: {name}")

    df = get_clean_klines(symbol, "1h", start_ms, end_ms)

    missing = df["open"].isna().sum()
    print(f"{name}: missing candles filled: {missing}")

    df.to_csv(f"data/raw/{name}_5y.csv", index=False)
    print(f"Saved {name}_5y.csv — rows: {len(df)}\n")