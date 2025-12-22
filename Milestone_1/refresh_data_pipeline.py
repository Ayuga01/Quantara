"""
Data Refresh Pipeline
======================

This script automates the full data pipeline:
1. Fetch fresh data from Binance API (through current date)
2. Preprocess: fill missing values, add technical features
3. Split into train/val/test and create sequences

Run this whenever you want to update your models with fresh data.

Usage:
    python refresh_data_pipeline.py
"""

import pandas as pd
import numpy as np
import requests
import time
import os
import datetime
from sklearn.preprocessing import MinMaxScaler
import joblib
import warnings
warnings.filterwarnings('ignore')

# ===== CONFIGURATION =====
BASE_DIR = "/Users/ayushgupta/Desktop/ML-Driven-Web-Platform-for-Cryptocurrency-Price-Forecasting_November_Batch-5_2025/Milestone_1"
RAW_DATA_DIR = f"{BASE_DIR}/data/raw"
PROCESSED_DATA_DIR = f"{BASE_DIR}/data/processed"
SCALED_DATA_DIR = f"{BASE_DIR}/data/scaled"
SEQUENCES_DIR = f"{BASE_DIR}/data/sequences"

COINS = {
    "BTCUSDT": "bitcoin",
    "ETHUSDT": "ethereum",
    "BNBUSDT": "binancecoin",
    "ADAUSDT": "cardano",
    "SOLUSDT": "solana"
}

# Data split ratios
TRAIN_RATIO = 0.7
VAL_RATIO = 0.15
# TEST_RATIO = 0.15 (remaining)

# Sequence parameters
SEQ_LEN = 48
HORIZONS = [1, 24]

# Feature columns
FEATURE_COLS = [
    "open", "high", "low", "volume",
    "return_1h", "volatility_24h",
    "ma_24", "ma_168", "ma_ratio",
    "vol_change", "missing_flag"
]


# ===== STEP 1: DATA FETCHING =====
def fetch_klines(symbol, interval, start_ms, end_ms):
    """Fetch klines from Binance API."""
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
        time.sleep(0.25)  # Rate limiting

    return out


def get_clean_klines(symbol, interval, start_ms, end_ms):
    """Fetch and clean klines data."""
    raw = fetch_klines(symbol, interval, start_ms, end_ms)

    df = pd.DataFrame(raw, columns=[
        "open_time", "open", "high", "low", "close", "volume",
        "close_time", "quote_asset_volume", "num_trades",
        "taker_buy_base", "taker_buy_quote", "ignore"
    ])

    df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
    df = df[["open_time", "open", "high", "low", "close", "volume"]]
    
    # Convert to numeric
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = pd.to_numeric(df[col], errors='coerce')

    df = df.sort_values("open_time").reset_index(drop=True)

    # Fill missing timestamps
    full_range = pd.date_range(
        start=df["open_time"].iloc[0],
        end=df["open_time"].iloc[-1],
        freq="1h"
    )

    df = df.set_index("open_time").reindex(full_range)
    df.index.name = "open_time"

    return df.reset_index()


def fetch_all_coins():
    """Fetch data for all coins."""
    print("=" * 60)
    print("STEP 1: FETCHING DATA FROM BINANCE")
    print("=" * 60)
    
    os.makedirs(RAW_DATA_DIR, exist_ok=True)
    
    # Fetch last 5 years of data
    end_dt = datetime.datetime.utcnow()
    start_dt = end_dt - datetime.timedelta(days=365.25 * 5)
    
    start_ms = int(start_dt.timestamp() * 1000)
    end_ms = int(end_dt.timestamp() * 1000)
    
    print(f"Date range: {start_dt.strftime('%Y-%m-%d')} → {end_dt.strftime('%Y-%m-%d')}\n")

    for symbol, name in COINS.items():
        print(f"Fetching: {name}...", end=" ", flush=True)
        
        try:
            df = get_clean_klines(symbol, "1h", start_ms, end_ms)
            missing = df["open"].isna().sum()
            
            output_path = f"{RAW_DATA_DIR}/{name}_5y.csv"
            df.to_csv(output_path, index=False)
            
            print(f"✅ {len(df)} rows, {missing} missing filled → {output_path}")
        except Exception as e:
            print(f"❌ Error: {e}")

    print()


# ===== STEP 2: PREPROCESSING =====
def preprocess_coin(name):
    """Preprocess a single coin's data."""
    input_path = f"{RAW_DATA_DIR}/{name}_5y.csv"
    output_path = f"{PROCESSED_DATA_DIR}/{name}_processed.csv"
    
    df = pd.read_csv(input_path, parse_dates=["open_time"])
    df = df.sort_values("open_time").reset_index(drop=True)
    
    # Fill missing OHLC with forward fill, then backward fill
    for col in ["open", "high", "low", "close", "volume"]:
        df[col] = df[col].ffill().bfill()
    
    # Add missing flag
    df["missing_flag"] = df["close"].isna().astype(int)
    
    # Calculate technical features
    df["return_1h"] = df["close"].pct_change(1).fillna(0)
    df["volatility_24h"] = df["return_1h"].rolling(24, min_periods=1).std().fillna(0)
    
    df["ma_24"] = df["close"].rolling(24, min_periods=1).mean()
    df["ma_168"] = df["close"].rolling(168, min_periods=1).mean()  # 7 days
    df["ma_ratio"] = df["ma_24"] / df["ma_168"].replace(0, np.nan)
    df["ma_ratio"] = df["ma_ratio"].fillna(1.0)
    
    df["vol_change"] = df["volume"].pct_change(1).fillna(0)
    # Clip extreme volume changes
    df["vol_change"] = df["vol_change"].clip(-10, 10)
    
    # Forward fill any remaining NaN in moving averages
    df["ma_24"] = df["ma_24"].ffill().bfill()
    df["ma_168"] = df["ma_168"].ffill().bfill()
    
    # Drop any rows with NaN (shouldn't be any now)
    df = df.dropna()
    
    # Save
    df.to_csv(output_path, index=False)
    
    return len(df)


def preprocess_all_coins():
    """Preprocess all coins."""
    print("=" * 60)
    print("STEP 2: PREPROCESSING DATA")
    print("=" * 60)
    
    os.makedirs(PROCESSED_DATA_DIR, exist_ok=True)
    
    for symbol, name in COINS.items():
        print(f"Preprocessing: {name}...", end=" ", flush=True)
        
        try:
            rows = preprocess_coin(name)
            print(f"✅ {rows} rows processed")
        except Exception as e:
            print(f"❌ Error: {e}")

    print()


# ===== STEP 3: SPLITTING =====
def create_sequences(df, horizon, feature_cols):
    """Create sequences from dataframe."""
    X, y = [], []
    data_X = df[feature_cols].values
    data_y = df["close_scaled"].values

    for i in range(SEQ_LEN, len(df) - horizon):
        X.append(data_X[i - SEQ_LEN:i])
        y.append(data_y[i + horizon])

    return np.array(X), np.array(y)


def split_and_save_coin(name):
    """Split and save sequences for a single coin."""
    input_path = f"{PROCESSED_DATA_DIR}/{name}_processed.csv"
    
    df = pd.read_csv(input_path, parse_dates=["open_time"])
    df = df.set_index("open_time").sort_index()
    
    n = len(df)
    train_end = int(n * TRAIN_RATIO)
    val_end = train_end + int(n * VAL_RATIO)
    
    df_train = df.iloc[:train_end].copy()
    df_val = df.iloc[train_end:val_end].copy()
    df_test = df.iloc[val_end:].copy()
    
    # Fit scalers on FULL dataset
    feature_scaler = MinMaxScaler()
    feature_scaler.fit(df[FEATURE_COLS])
    
    price_scaler = MinMaxScaler()
    price_scaler.fit(df[["close"]])
    
    # Transform features
    df_train[FEATURE_COLS] = feature_scaler.transform(df_train[FEATURE_COLS])
    df_val[FEATURE_COLS] = feature_scaler.transform(df_val[FEATURE_COLS])
    df_test[FEATURE_COLS] = feature_scaler.transform(df_test[FEATURE_COLS])
    
    # Transform target
    df_train["close_scaled"] = price_scaler.transform(df_train[["close"]])
    df_val["close_scaled"] = price_scaler.transform(df_val[["close"]])
    df_test["close_scaled"] = price_scaler.transform(df_test[["close"]])
    
    # Save scalers
    scaler_dir = f"{SCALED_DATA_DIR}/{name}"
    os.makedirs(scaler_dir, exist_ok=True)
    joblib.dump(feature_scaler, f"{scaler_dir}/feature_scaler.pkl")
    joblib.dump(price_scaler, f"{scaler_dir}/price_scaler.pkl")
    
    # Create and save sequences for each horizon
    for h in HORIZONS:
        X_tr, y_tr = create_sequences(df_train, h, FEATURE_COLS)
        X_v, y_v = create_sequences(df_val, h, FEATURE_COLS)
        X_te, y_te = create_sequences(df_test, h, FEATURE_COLS)
        
        seq_path = f"{SEQUENCES_DIR}/{name}/{h}h/"
        os.makedirs(seq_path, exist_ok=True)
        
        np.save(f"{seq_path}X_train.npy", X_tr)
        np.save(f"{seq_path}y_train.npy", y_tr)
        np.save(f"{seq_path}X_val.npy", X_v)
        np.save(f"{seq_path}y_val.npy", y_v)
        np.save(f"{seq_path}X_test.npy", X_te)
        np.save(f"{seq_path}y_test.npy", y_te)
    
    return {
        "train": len(df_train),
        "val": len(df_val),
        "test": len(df_test),
        "price_range": (price_scaler.data_min_[0], price_scaler.data_max_[0])
    }


def split_all_coins():
    """Split all coins into sequences."""
    print("=" * 60)
    print("STEP 3: CREATING TRAIN/VAL/TEST SPLITS & SEQUENCES")
    print("=" * 60)
    
    for symbol, name in COINS.items():
        print(f"\n{name}:")
        
        try:
            result = split_and_save_coin(name)
            print(f"  Train: {result['train']} | Val: {result['val']} | Test: {result['test']}")
            print(f"  Price range: ${result['price_range'][0]:,.2f} - ${result['price_range'][1]:,.2f}")
            print(f"  ✅ Sequences saved for 1h and 24h horizons")
        except Exception as e:
            print(f"  ❌ Error: {e}")

    print()


# ===== MAIN =====
def main():
    print("\n" + "=" * 60)
    print("       DATA REFRESH PIPELINE")
    print("=" * 60)
    print(f"Started at: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    
    # Step 1: Fetch data
    fetch_all_coins()
    
    # Step 2: Preprocess
    preprocess_all_coins()
    
    # Step 3: Split and create sequences
    split_all_coins()
    
    # Summary
    print("=" * 60)
    print("🎉 DATA REFRESH COMPLETE!")
    print("=" * 60)
    print(f"\nNew sequences saved to: {SEQUENCES_DIR}")
    print(f"New scalers saved to: {SCALED_DATA_DIR}")
    print("\n📋 NEXT STEPS:")
    print("  1. Open LSTM_v3_improved.ipynb (or your training notebook)")
    print("  2. Set COIN_NAME and HORIZON")
    print("  3. Run all cells to train each model")
    print()


if __name__ == "__main__":
    main()
