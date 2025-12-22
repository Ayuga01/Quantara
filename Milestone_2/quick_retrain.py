#!/usr/bin/env python3
"""Quick re-training script for all cryptocurrency models."""

import os
import sys
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, regularizers
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau
import joblib

# Suppress TF warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

# Base paths
BASE_DIR = "/Users/ayushgupta/Desktop/ML-Driven-Web-Platform-for-Cryptocurrency-Price-Forecasting_November_Batch-5_2025"
DATA_DIR = f"{BASE_DIR}/Milestone_1/data"
MODEL_DIR = f"{BASE_DIR}/Milestone_2/models"

# Coins to train
COINS = ["bitcoin", "ethereum", "solana", "cardano", "binancecoin"]
HORIZONS = ["1h", "24h"]

# Model hyperparameters
LSTM_UNITS = 64
DROPOUT_RATE = 0.3
L2_REG = 0.001
LEARNING_RATE = 0.001
BATCH_SIZE = 32
EPOCHS = 50  # Reduced for faster training
PATIENCE = 10

def build_model(seq_len, n_features):
    """Build improved LSTM model."""
    model = keras.Sequential([
        layers.Input(shape=(seq_len, n_features)),
        layers.LSTM(LSTM_UNITS, return_sequences=True, 
                    kernel_regularizer=regularizers.l2(L2_REG)),
        layers.Dropout(DROPOUT_RATE),
        layers.LSTM(LSTM_UNITS // 2, return_sequences=False,
                    kernel_regularizer=regularizers.l2(L2_REG)),
        layers.Dropout(DROPOUT_RATE),
        layers.Dense(32, activation='relu',
                     kernel_regularizer=regularizers.l2(L2_REG)),
        layers.Dense(1, activation='sigmoid')  # Output scaled 0-1
    ])
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=LEARNING_RATE),
        loss='mse',
        metrics=['mae']
    )
    return model

def train_model(coin, horizon):
    """Train model for a specific coin and horizon."""
    seq_path = f"{DATA_DIR}/sequences/{coin}/{horizon}"
    
    # Load data
    try:
        X_train = np.load(f"{seq_path}/X_train.npy")
        y_train = np.load(f"{seq_path}/y_train.npy")
        X_val = np.load(f"{seq_path}/X_val.npy")
        y_val = np.load(f"{seq_path}/y_val.npy")
    except FileNotFoundError as e:
        print(f"  ❌ Data not found: {e}")
        return False
    
    print(f"  Data: X_train={X_train.shape}, y_train={y_train.shape}")
    
    seq_len, n_features = X_train.shape[1], X_train.shape[2]
    
    # Build model
    model = build_model(seq_len, n_features)
    
    # Callbacks
    callbacks = [
        EarlyStopping(monitor='val_loss', patience=PATIENCE, restore_best_weights=True, verbose=0),
        ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-6, verbose=0)
    ]
    
    # Train
    print(f"  Training for {EPOCHS} epochs...")
    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=EPOCHS,
        batch_size=BATCH_SIZE,
        callbacks=callbacks,
        verbose=0
    )
    
    # Evaluate
    val_loss, val_mae = model.evaluate(X_val, y_val, verbose=0)
    print(f"  Final: val_loss={val_loss:.6f}, val_mae={val_mae:.6f}")
    
    # Save model
    model_path = f"{MODEL_DIR}/{coin}/{horizon}/final_lstm_{coin}_{horizon}.keras"
    model.save(model_path)
    print(f"  ✅ Saved: {model_path}")
    
    return True

def main():
    print("=" * 60)
    print("LSTM Model Re-training Script")
    print("=" * 60)
    
    total = len(COINS) * len(HORIZONS)
    done = 0
    failed = 0
    
    for coin in COINS:
        for horizon in HORIZONS:
            print(f"\n[{done+1}/{total}] Training {coin} - {horizon}")
            success = train_model(coin, horizon)
            if success:
                done += 1
            else:
                failed += 1
    
    print("\n" + "=" * 60)
    print(f"Complete! Trained: {done}, Failed: {failed}")
    print("=" * 60)

if __name__ == "__main__":
    main()
