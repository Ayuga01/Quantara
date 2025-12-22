"""
Accuracy Service for Prediction Verification
=============================================

This module provides functions to verify prediction accuracy by fetching
actual prices from Binance after the predicted time has passed.
"""

import sqlite3
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Database path (same as app.py)
_THIS_DIR = Path(__file__).resolve().parent
AUTH_DB_PATH = Path(str((_THIS_DIR / "auth.db").resolve()))

# Binance symbols mapping
BINANCE_SYMBOLS = {
    "bitcoin": "BTCUSDT",
    "ethereum": "ETHUSDT",
    "solana": "SOLUSDT",
    "cardano": "ADAUSDT",
    "binancecoin": "BNBUSDT",
}

# Verification delay: wait 10 minutes after target time before fetching actual price
VERIFICATION_DELAY_MINUTES = 10


def _db_connect() -> sqlite3.Connection:
    """Connect to the SQLite database."""
    conn = sqlite3.connect(str(AUTH_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def get_pending_verifications() -> list:
    """
    Get predictions that are ready for accuracy verification.
    
    A prediction is ready when:
    - accuracy_verified_at is NULL (not yet verified)
    - All target_timestamps have passed + VERIFICATION_DELAY_MINUTES
    - target_timestamps_json is not NULL
    
    Returns:
        List of prediction records ready for verification
    """
    now = datetime.utcnow()
    cutoff_time = now - timedelta(minutes=VERIFICATION_DELAY_MINUTES)
    cutoff_iso = cutoff_time.isoformat() + "Z"
    
    with _db_connect() as conn:
        rows = conn.execute(
            """
            SELECT id, coin, horizon, steps_ahead, predictions_json, target_timestamps_json
            FROM prediction_history
            WHERE accuracy_verified_at IS NULL
              AND target_timestamps_json IS NOT NULL
            ORDER BY predicted_at ASC
            LIMIT 100
            """
        ).fetchall()
    
    pending = []
    for row in rows:
        try:
            target_timestamps = json.loads(row["target_timestamps_json"])
            if not target_timestamps:
                continue
            
            # Check if the last (latest) target timestamp has passed + delay
            last_target = target_timestamps[-1]
            last_target_dt = datetime.fromisoformat(last_target.replace("Z", ""))
            
            if last_target_dt <= cutoff_time:
                pending.append({
                    "id": row["id"],
                    "coin": row["coin"],
                    "horizon": row["horizon"],
                    "steps_ahead": row["steps_ahead"],
                    "predictions": json.loads(row["predictions_json"]) if row["predictions_json"] else [],
                    "target_timestamps": target_timestamps,
                })
        except (json.JSONDecodeError, ValueError) as e:
            logger.warning(f"Error parsing timestamps for prediction {row['id']}: {e}")
            continue
    
    return pending


def fetch_binance_historical_prices(coin: str, timestamps: list) -> dict:
    """
    Fetch historical prices from Binance for specific timestamps.
    
    Uses the klines API to get hourly candles and matches the closest
    close price to each requested timestamp.
    
    Args:
        coin: Coin identifier (e.g., 'bitcoin')
        timestamps: List of ISO timestamp strings
    
    Returns:
        Dict mapping timestamp -> actual price (or None if not found)
    """
    symbol = BINANCE_SYMBOLS.get(coin)
    if not symbol:
        logger.error(f"No Binance symbol for coin: {coin}")
        return {ts: None for ts in timestamps}
    
    if not timestamps:
        return {}
    
    # Parse timestamps and find the range
    parsed_times = []
    for ts in timestamps:
        try:
            dt = datetime.fromisoformat(ts.replace("Z", ""))
            parsed_times.append((ts, dt))
        except ValueError:
            logger.warning(f"Invalid timestamp: {ts}")
            parsed_times.append((ts, None))
    
    valid_times = [(ts, dt) for ts, dt in parsed_times if dt is not None]
    if not valid_times:
        return {ts: None for ts in timestamps}
    
    # Get the time range we need
    min_time = min(dt for _, dt in valid_times)
    max_time = max(dt for _, dt in valid_times)
    
    # Fetch klines from Binance
    # startTime and endTime are in milliseconds
    start_ms = int(min_time.timestamp() * 1000) - 3600000  # 1 hour before
    end_ms = int(max_time.timestamp() * 1000) + 3600000    # 1 hour after
    
    url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=1h&startTime={start_ms}&endTime={end_ms}&limit=1000"
    
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "CryptoForecast/1.0"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
    except Exception as e:
        logger.error(f"Binance API error for {symbol}: {e}")
        return {ts: None for ts in timestamps}
    
    # Parse klines into a dict: open_time_ms -> close_price
    klines = {}
    for k in data:
        # k[0] = open_time (ms), k[4] = close price
        klines[k[0]] = float(k[4])
    
    # Match each timestamp to the closest kline
    result = {}
    for ts, dt in parsed_times:
        if dt is None:
            result[ts] = None
            continue
        
        # Round to the nearest hour and find the matching kline
        # Binance klines use the open time, so we need to find the hour the timestamp falls into
        ts_ms = int(dt.timestamp() * 1000)
        hour_start_ms = (ts_ms // 3600000) * 3600000  # Round down to hour
        
        # Try the hour containing the timestamp
        if hour_start_ms in klines:
            result[ts] = klines[hour_start_ms]
        else:
            # Try the previous hour if not found
            prev_hour_ms = hour_start_ms - 3600000
            if prev_hour_ms in klines:
                result[ts] = klines[prev_hour_ms]
            else:
                result[ts] = None
                logger.warning(f"No kline found for {ts} ({symbol})")
    
    return result


def calculate_error_metrics(predicted_prices: list, actual_prices: list) -> dict:
    """
    Calculate error metrics between predicted and actual prices.
    
    Args:
        predicted_prices: List of predicted prices
        actual_prices: List of actual prices (may contain None)
    
    Returns:
        Dict with error metrics (mean_error_pct, max_error_pct, errors list)
    """
    errors = []
    for pred, actual in zip(predicted_prices, actual_prices):
        if pred is not None and actual is not None and pred != 0:
            error_pct = abs((actual - pred) / pred) * 100
            errors.append(error_pct)
        else:
            errors.append(None)
    
    valid_errors = [e for e in errors if e is not None]
    
    if not valid_errors:
        return {
            "mean_error_pct": None,
            "max_error_pct": None,
            "errors": errors,
        }
    
    return {
        "mean_error_pct": sum(valid_errors) / len(valid_errors),
        "max_error_pct": max(valid_errors),
        "errors": errors,
    }


def verify_prediction(prediction_id: int) -> dict:
    """
    Verify a single prediction by fetching actual prices and calculating error.
    
    Args:
        prediction_id: ID of the prediction to verify
    
    Returns:
        Dict with verification result
    """
    # Fetch the prediction data
    with _db_connect() as conn:
        row = conn.execute(
            """
            SELECT id, coin, predictions_json, target_timestamps_json
            FROM prediction_history
            WHERE id = ?
            """,
            (prediction_id,)
        ).fetchone()
    
    if not row:
        return {"status": "error", "message": f"Prediction {prediction_id} not found"}
    
    try:
        predictions = json.loads(row["predictions_json"]) if row["predictions_json"] else []
        target_timestamps = json.loads(row["target_timestamps_json"]) if row["target_timestamps_json"] else []
    except json.JSONDecodeError as e:
        return {"status": "error", "message": f"JSON parse error: {e}"}
    
    if not predictions or not target_timestamps:
        return {"status": "error", "message": "Missing predictions or target timestamps"}
    
    coin = row["coin"]
    
    # Fetch actual prices from Binance
    actual_price_map = fetch_binance_historical_prices(coin, target_timestamps)
    
    # Build actual prices list in order
    actual_prices = [actual_price_map.get(ts) for ts in target_timestamps]
    predicted_prices = [p.get("predicted_price") for p in predictions]
    
    # Calculate error metrics
    metrics = calculate_error_metrics(predicted_prices, actual_prices)
    
    # Update the database
    verified_at = datetime.utcnow().isoformat() + "Z"
    actual_prices_json = json.dumps(actual_prices)
    
    with _db_connect() as conn:
        conn.execute(
            """
            UPDATE prediction_history
            SET actual_prices_json = ?,
                accuracy_verified_at = ?,
                mean_error_pct = ?
            WHERE id = ?
            """,
            (actual_prices_json, verified_at, metrics["mean_error_pct"], prediction_id)
        )
        conn.commit()
    
    logger.info(f"Verified prediction {prediction_id}: mean_error={metrics['mean_error_pct']:.2f}%" if metrics["mean_error_pct"] else f"Verified prediction {prediction_id}: no valid errors")
    
    return {
        "status": "success",
        "prediction_id": prediction_id,
        "coin": coin,
        "actual_prices": actual_prices,
        "mean_error_pct": metrics["mean_error_pct"],
        "max_error_pct": metrics["max_error_pct"],
    }


def verify_all_pending() -> dict:
    """
    Verify all pending predictions.
    
    Returns:
        Dict with summary of verification results
    """
    pending = get_pending_verifications()
    
    if not pending:
        logger.info("No pending predictions to verify")
        return {"status": "success", "verified_count": 0, "results": []}
    
    logger.info(f"Found {len(pending)} predictions to verify")
    
    results = []
    for pred in pending:
        result = verify_prediction(pred["id"])
        results.append(result)
    
    success_count = sum(1 for r in results if r.get("status") == "success")
    
    return {
        "status": "success",
        "verified_count": success_count,
        "total_pending": len(pending),
        "results": results,
    }
