# app.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Tuple, Any
from datetime import datetime
import pandas as pd
import numpy as np
import joblib
import os
from pathlib import Path

app = FastAPI()

class PredictRequest(BaseModel):
    coin: str
    horizon: str
    timestamp: Optional[datetime] = None


BASE_DIR = "/Users/ayushgupta/Desktop/ML-Driven-Web-Platform-for-Cryptocurrency-Price-Forecasting_November_Batch-5_2025"
MODEL_DIR = f"{BASE_DIR}/Milestone_2/models"
DATA_DIR  = f"{BASE_DIR}/Milestone_1/data"

# Prefer repo-relative paths (works across machines). If you *need* to override,
# set BASE_DIR via environment variable.
_THIS_DIR = Path(__file__).resolve().parent
BASE_DIR = Path(os.environ.get("BASE_DIR", str(_THIS_DIR.parent.parent))).resolve()
MODEL_DIR = (BASE_DIR / "Milestone_2" / "models").resolve()
DATA_DIR = (BASE_DIR / "Milestone_1" / "data").resolve()

model_cache = {}
scaler_cache = {}

SUPPORTED_COINS = {"bitcoin", "ethereum", "solana", "cardano", "binancecoin"}
SUPPORTED_HORIZONS = {"1h", "24h"}


def load_model_and_scalers(coin: str, horizon: str) -> Tuple[Any, Tuple[Any, Any]]:
    key = f"{coin}_{horizon}"
    if key in model_cache:
        return model_cache[key], scaler_cache[key]

    model_path = MODEL_DIR / coin / horizon / f"final_lstm_{coin}_{horizon}.keras"
    feat_scaler_path = DATA_DIR / "scaled" / coin / f"{coin}_feature_scaler.pkl"
    price_scaler_path = DATA_DIR / "scaled" / coin / f"{coin}_price_scaler.pkl"

    if not model_path.exists():
        raise HTTPException(status_code=404, detail=f"Model not found: {model_path}")
    if not feat_scaler_path.exists():
        raise HTTPException(status_code=404, detail=f"Feature scaler not found: {feat_scaler_path}")
    if not price_scaler_path.exists():
        raise HTTPException(status_code=404, detail=f"Price scaler not found: {price_scaler_path}")

    try:
        import tensorflow as tf  # lazy import
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TensorFlow is not available: {exc}")

    model = tf.keras.models.load_model(str(model_path))
    feature_scaler = joblib.load(str(feat_scaler_path))
    price_scaler = joblib.load(str(price_scaler_path))

    model_cache[key] = model
    scaler_cache[key] = (feature_scaler, price_scaler)

    return model, (feature_scaler, price_scaler)


@app.post("/predict")
async def predict(req: PredictRequest):

    coin = req.coin
    horizon = req.horizon
    timestamp = req.timestamp

    if coin not in SUPPORTED_COINS:
        raise HTTPException(status_code=400, detail=f"Unsupported coin '{coin}'. Supported: {sorted(SUPPORTED_COINS)}")
    if horizon not in SUPPORTED_HORIZONS:
        raise HTTPException(status_code=400, detail=f"Unsupported horizon '{horizon}'. Supported: {sorted(SUPPORTED_HORIZONS)}")

    model, (feature_scaler, price_scaler) = load_model_and_scalers(coin, horizon)

    csv_path = DATA_DIR / "processed" / f"{coin}_processed.csv"
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail=f"Processed CSV not found: {csv_path}")
    df = pd.read_csv(str(csv_path), parse_dates=["open_time"]).set_index("open_time")

    # *** FIXED: close REMOVED from features ***
    feature_cols = [
        "open","high","low","volume",
        "return_1h","volatility_24h",
        "ma_24","ma_168","ma_ratio",
        "vol_change","missing_flag"
    ]

    missing_cols = [c for c in feature_cols + ["close"] if c not in df.columns]
    if missing_cols:
        raise HTTPException(status_code=500, detail=f"CSV missing required columns: {missing_cols}")

    expected_n_features = getattr(feature_scaler, "n_features_in_", None)
    if expected_n_features is not None and expected_n_features != len(feature_cols):
        raise HTTPException(
            status_code=500,
            detail=f"Feature scaler expects {expected_n_features} features but app is using {len(feature_cols)}."
        )

    if timestamp is None:
        idx = len(df) - 1
    else:
        ts = pd.Timestamp(timestamp)
        if ts.tzinfo is not None:
            ts = ts.tz_convert(None)
        if ts not in df.index:
            raise HTTPException(
                status_code=404,
                detail=f"Timestamp not found. Range is {df.index.min()} to {df.index.max()}."
            )
        idx = df.index.get_loc(ts)

    H = int(horizon.replace("h", ""))
    SEQ_LEN = 48

    if idx < SEQ_LEN + H:
        raise HTTPException(status_code=400, detail="Not enough history before timestamp.")

    start = idx - SEQ_LEN - H
    end   = start + SEQ_LEN

    # Transform features
    window = df[feature_cols].iloc[start:end].values
    window = feature_scaler.transform(window)
    window = window.reshape(1, SEQ_LEN, len(feature_cols))

    # Predict (scaled)
    pred_scaled = model.predict(window, verbose=0)[0][0]

    # *** FIXED inverse scale ***
    pred_price = price_scaler.inverse_transform([[pred_scaled]])[0][0]

    # Actual close price (processed CSV contains raw close, not close_scaled)
    actual_price = float(df["close"].iloc[idx])

    return {
        "coin": coin,
        "horizon": horizon,
        "timestamp": str(df.index[idx]),
        "predicted_price": float(pred_price),
        "actual_price": float(actual_price)
    }