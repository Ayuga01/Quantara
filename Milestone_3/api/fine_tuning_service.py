"""
Scheduled Fine-Tuning Service
==============================

This module provides automated model fine-tuning for cryptocurrency price prediction.
It fetches recent data from Binance, fine-tunes models, validates improvements,
and deploys updated models.

Features:
- Per-coin configurable fine-tuning frequency
- Validation before deployment (prevents bad updates)
- Logging and monitoring
- Automatic scaler updates for new price ranges
"""

import os
import sys
import numpy as np
import pandas as pd
import requests
import time
import logging
import joblib
from datetime import datetime, timedelta
from typing import Dict, Optional, Tuple
from sklearn.preprocessing import MinMaxScaler

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'
import tensorflow as tf

# ===== CONFIGURATION =====
BASE_DIR = "/Users/ayushgupta/Desktop/ML-Driven-Web-Platform-for-Cryptocurrency-Price-Forecasting_November_Batch-5_2025"
MODEL_DIR = f"{BASE_DIR}/Milestone_2/models"
DATA_DIR = f"{BASE_DIR}/Milestone_1/data"
LOG_DIR = f"{BASE_DIR}/Milestone_3/api/logs"

# Create log directory
os.makedirs(LOG_DIR, exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(f"{LOG_DIR}/fine_tuning.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("FineTuning")

# Coin mapping
COINS = {
    "bitcoin": "BTCUSDT",
    "ethereum": "ETHUSDT",
    "binancecoin": "BNBUSDT",
    "cardano": "ADAUSDT",
    "solana": "SOLUSDT"
}

# Fine-tuning configuration
FINE_TUNING_CONFIG = {
    "bitcoin": {
        "enabled": True,
        "frequency_hours": 6,
        "epochs": 3,
        "batch_size": 32,
        "learning_rate": 0.0001,
        "min_improvement": 0.0,  # Allow any improvement for struggling models
        "priority": "HIGH"
    },
    "binancecoin": {
        "enabled": True,
        "frequency_hours": 6,
        "epochs": 3,
        "batch_size": 32,
        "learning_rate": 0.0001,
        "min_improvement": 0.0,
        "priority": "HIGH"
    },
    "ethereum": {
        "enabled": True,
        "frequency_hours": 12,
        "epochs": 2,
        "batch_size": 32,
        "learning_rate": 0.00005,
        "min_improvement": 0.01,
        "priority": "MEDIUM"
    },
    "solana": {
        "enabled": True,
        "frequency_hours": 24,
        "epochs": 1,
        "batch_size": 32,
        "learning_rate": 0.00005,
        "min_improvement": 0.01,
        "priority": "LOW"
    },
    "cardano": {
        "enabled": True,
        "frequency_hours": 24,
        "epochs": 1,
        "batch_size": 32,
        "learning_rate": 0.00005,
        "min_improvement": 0.01,
        "priority": "LOW"
    }
}

HORIZONS = ["1h", "24h"]
SEQ_LEN = 48

FEATURE_COLS = [
    "open", "high", "low", "volume",
    "return_1h", "volatility_24h",
    "ma_24", "ma_168", "ma_ratio",
    "vol_change", "missing_flag"
]


class FineTuningService:
    """Service for fine-tuning cryptocurrency prediction models."""
    
    def __init__(self):
        self.last_fine_tune: Dict[str, datetime] = {}
        
    def fetch_recent_data(self, coin: str, hours: int = 168) -> Optional[pd.DataFrame]:
        """
        Fetch recent klines from Binance API.
        
        Args:
            coin: Coin name (e.g., 'bitcoin')
            hours: Number of hours of data to fetch
            
        Returns:
            DataFrame with OHLCV data or None on error
        """
        symbol = COINS.get(coin)
        if not symbol:
            logger.error(f"Unknown coin: {coin}")
            return None
            
        url = "https://api.binance.com/api/v3/klines"
        
        try:
            # Fetch data in chunks
            all_data = []
            end_time = int(datetime.utcnow().timestamp() * 1000)
            start_time = end_time - (hours * 60 * 60 * 1000)
            
            current = start_time
            while current < end_time:
                params = {
                    "symbol": symbol,
                    "interval": "1h",
                    "startTime": current,
                    "endTime": end_time,
                    "limit": 1000
                }
                
                response = requests.get(url, params=params, timeout=10)
                response.raise_for_status()
                data = response.json()
                
                if not data:
                    break
                    
                all_data.extend(data)
                current = data[-1][0] + 1
                time.sleep(0.1)  # Rate limiting
                
            if not all_data:
                logger.warning(f"No data fetched for {coin}")
                return None
                
            df = pd.DataFrame(all_data, columns=[
                "open_time", "open", "high", "low", "close", "volume",
                "close_time", "quote_asset_volume", "num_trades",
                "taker_buy_base", "taker_buy_quote", "ignore"
            ])
            
            df["open_time"] = pd.to_datetime(df["open_time"], unit="ms")
            df = df[["open_time", "open", "high", "low", "close", "volume"]]
            
            for col in ["open", "high", "low", "close", "volume"]:
                df[col] = pd.to_numeric(df[col], errors='coerce')
                
            df = df.sort_values("open_time").reset_index(drop=True)
            
            logger.info(f"Fetched {len(df)} rows for {coin}")
            return df
            
        except Exception as e:
            logger.error(f"Error fetching data for {coin}: {e}")
            return None
            
    def compute_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Compute technical features from OHLCV data."""
        df = df.copy()
        
        # Fill missing values
        for col in ["open", "high", "low", "close", "volume"]:
            df[col] = df[col].ffill().bfill()
            
        df["missing_flag"] = 0
        df["return_1h"] = df["close"].pct_change(1).fillna(0)
        df["volatility_24h"] = df["return_1h"].rolling(24, min_periods=1).std().fillna(0)
        df["ma_24"] = df["close"].rolling(24, min_periods=1).mean()
        df["ma_168"] = df["close"].rolling(168, min_periods=1).mean()
        df["ma_ratio"] = (df["ma_24"] / df["ma_168"].replace(0, np.nan)).fillna(1.0)
        df["vol_change"] = df["volume"].pct_change(1).fillna(0).clip(-10, 10)
        
        df["ma_24"] = df["ma_24"].ffill().bfill()
        df["ma_168"] = df["ma_168"].ffill().bfill()
        
        return df.dropna()
        
    def create_sequences(self, df: pd.DataFrame, horizon: int) -> Tuple[np.ndarray, np.ndarray]:
        """Create sequences for training."""
        X, y = [], []
        
        for i in range(SEQ_LEN, len(df) - horizon):
            X.append(df[FEATURE_COLS].iloc[i - SEQ_LEN:i].values)
            y.append(df["close_scaled"].iloc[i + horizon])
            
        return np.array(X), np.array(y)
        
    def fine_tune_model(
        self,
        coin: str,
        horizon: str,
        X_new: np.ndarray,
        y_new: np.ndarray
    ) -> Tuple[bool, float, float]:
        """
        Fine-tune a model with new data.
        
        Returns:
            Tuple of (success, old_mae, new_mae)
        """
        config = FINE_TUNING_CONFIG.get(coin, {})
        if not config.get("enabled", True):
            logger.info(f"Fine-tuning disabled for {coin}")
            return False, 0.0, 0.0
            
        model_path = f"{MODEL_DIR}/{coin}/{horizon}/final_lstm_{coin}_{horizon}.keras"
        
        if not os.path.exists(model_path):
            logger.error(f"Model not found: {model_path}")
            return False, 0.0, 0.0
            
        try:
            # Load model
            model = tf.keras.models.load_model(model_path)
            
            # Split new data into train/val for this fine-tuning session
            split_idx = int(len(X_new) * 0.8)
            X_train, X_val = X_new[:split_idx], X_new[split_idx:]
            y_train, y_val = y_new[:split_idx], y_new[split_idx:]
            
            # Evaluate current performance
            old_loss, old_mae = model.evaluate(X_val, y_val, verbose=0)
            
            # Fine-tune
            model.compile(
                optimizer=tf.keras.optimizers.Adam(learning_rate=config.get("learning_rate", 0.0001)),
                loss="mse",
                metrics=["mae"]
            )
            
            model.fit(
                X_train, y_train,
                validation_data=(X_val, y_val),
                epochs=config.get("epochs", 2),
                batch_size=config.get("batch_size", 32),
                verbose=0
            )
            
            # Evaluate new performance
            new_loss, new_mae = model.evaluate(X_val, y_val, verbose=0)
            
            # Check improvement
            improvement = old_mae - new_mae
            min_improvement = config.get("min_improvement", 0.01)
            
            if improvement >= min_improvement or new_mae <= old_mae:
                # Save updated model
                model.save(model_path)
                logger.info(f"✅ {coin}/{horizon}: MAE {old_mae:.4f} → {new_mae:.4f} (improved by {improvement:.4f})")
                return True, old_mae, new_mae
            else:
                logger.info(f"⚠️ {coin}/{horizon}: MAE {old_mae:.4f} → {new_mae:.4f} (not enough improvement)")
                return False, old_mae, new_mae
                
        except Exception as e:
            logger.error(f"Error fine-tuning {coin}/{horizon}: {e}")
            return False, 0.0, 0.0
            
    def update_scalers(self, coin: str, df: pd.DataFrame) -> bool:
        """
        Update scalers if new data extends the price range.
        """
        scaler_dir = f"{DATA_DIR}/scaled/{coin}"
        
        try:
            # Load existing scalers
            feature_scaler_path = f"{scaler_dir}/feature_scaler.pkl"
            price_scaler_path = f"{scaler_dir}/price_scaler.pkl"
            
            feature_scaler = joblib.load(feature_scaler_path)
            price_scaler = joblib.load(price_scaler_path)
            
            # Check if new data extends the range
            old_price_min = price_scaler.data_min_[0]
            old_price_max = price_scaler.data_max_[0]
            new_price_min = df["close"].min()
            new_price_max = df["close"].max()
            
            if new_price_min < old_price_min or new_price_max > old_price_max:
                logger.info(f"Updating scalers for {coin}: price range [{old_price_min:.2f}, {old_price_max:.2f}] → [{min(old_price_min, new_price_min):.2f}, {max(old_price_max, new_price_max):.2f}]")
                
                # Partial fit isn't available for MinMaxScaler, so we need to refit
                # We combine old range with new range
                price_scaler.data_min_[0] = min(old_price_min, new_price_min)
                price_scaler.data_max_[0] = max(old_price_max, new_price_max)
                price_scaler.data_range_[0] = price_scaler.data_max_[0] - price_scaler.data_min_[0]
                price_scaler.scale_[0] = 1.0 / price_scaler.data_range_[0] if price_scaler.data_range_[0] != 0 else 1.0
                
                joblib.dump(price_scaler, price_scaler_path)
                return True
                
            return False
            
        except Exception as e:
            logger.error(f"Error updating scalers for {coin}: {e}")
            return False
            
    def run_fine_tuning(self, coin: str) -> Dict:
        """
        Run fine-tuning for a specific coin.
        
        Returns:
            Dict with results for each horizon
        """
        logger.info(f"Starting fine-tuning for {coin}")
        
        config = FINE_TUNING_CONFIG.get(coin, {})
        if not config.get("enabled", True):
            return {"status": "disabled"}
            
        results = {}
        
        # Fetch recent data (7 days)
        df = self.fetch_recent_data(coin, hours=168)
        if df is None or len(df) < SEQ_LEN + 24:
            return {"status": "error", "message": "Insufficient data"}
            
        # Compute features
        df = self.compute_features(df)
        
        # Update scalers if needed
        self.update_scalers(coin, df)
        
        # Load scalers
        scaler_dir = f"{DATA_DIR}/scaled/{coin}"
        try:
            feature_scaler = joblib.load(f"{scaler_dir}/feature_scaler.pkl")
            price_scaler = joblib.load(f"{scaler_dir}/price_scaler.pkl")
        except Exception as e:
            logger.error(f"Error loading scalers for {coin}: {e}")
            return {"status": "error", "message": str(e)}
            
        # Scale features
        df[FEATURE_COLS] = feature_scaler.transform(df[FEATURE_COLS])
        df["close_scaled"] = price_scaler.transform(df[["close"]])
        
        # Fine-tune each horizon
        for horizon in HORIZONS:
            h = 1 if horizon == "1h" else 24
            
            X, y = self.create_sequences(df, h)
            if len(X) < 50:
                results[horizon] = {"status": "skipped", "message": "Insufficient sequences"}
                continue
                
            success, old_mae, new_mae = self.fine_tune_model(coin, horizon, X, y)
            results[horizon] = {
                "status": "success" if success else "no_improvement",
                "old_mae": float(old_mae),
                "new_mae": float(new_mae),
                "improvement": float(old_mae - new_mae)
            }
            
        self.last_fine_tune[coin] = datetime.utcnow()
        
        return results
        
    def run_all(self) -> Dict:
        """Run fine-tuning for all enabled coins."""
        results = {}
        
        for coin in COINS.keys():
            try:
                results[coin] = self.run_fine_tuning(coin)
            except Exception as e:
                logger.error(f"Error processing {coin}: {e}")
                results[coin] = {"status": "error", "message": str(e)}
                
        return results
        
    def should_fine_tune(self, coin: str) -> bool:
        """Check if it's time to fine-tune a coin."""
        config = FINE_TUNING_CONFIG.get(coin, {})
        if not config.get("enabled", True):
            return False
            
        last_run = self.last_fine_tune.get(coin)
        if last_run is None:
            return True
            
        frequency_hours = config.get("frequency_hours", 24)
        next_run = last_run + timedelta(hours=frequency_hours)
        
        return datetime.utcnow() >= next_run


# Global service instance
fine_tuning_service = FineTuningService()


def run_scheduled_fine_tuning():
    """Entry point for scheduled fine-tuning."""
    logger.info("=" * 60)
    logger.info("SCHEDULED FINE-TUNING STARTED")
    logger.info("=" * 60)
    
    for coin in COINS.keys():
        if fine_tuning_service.should_fine_tune(coin):
            try:
                result = fine_tuning_service.run_fine_tuning(coin)
                logger.info(f"{coin}: {result}")
            except Exception as e:
                logger.error(f"Error fine-tuning {coin}: {e}")
        else:
            logger.info(f"{coin}: Skipping (not due yet)")
            
    logger.info("=" * 60)
    logger.info("SCHEDULED FINE-TUNING COMPLETED")
    logger.info("=" * 60)


if __name__ == "__main__":
    # Run fine-tuning for all coins
    if len(sys.argv) > 1 and sys.argv[1] == "--coin":
        # Fine-tune specific coin
        coin = sys.argv[2] if len(sys.argv) > 2 else None
        if coin:
            result = fine_tuning_service.run_fine_tuning(coin)
            print(f"\n{coin}: {result}")
        else:
            print("Usage: python fine_tuning_service.py --coin <coin_name>")
    else:
        # Fine-tune all coins
        results = fine_tuning_service.run_all()
        print("\n" + "=" * 60)
        print("FINE-TUNING RESULTS")
        print("=" * 60)
        for coin, result in results.items():
            print(f"\n{coin}:")
            for key, value in result.items():
                print(f"  {key}: {value}")
