#!/usr/bin/env python3
"""
Manual Fine-Tuning Runner
=========================

Run fine-tuning manually for testing or one-off updates.

Usage:
    python run_fine_tuning.py              # Fine-tune all coins
    python run_fine_tuning.py bitcoin      # Fine-tune specific coin
    python run_fine_tuning.py --status     # Show last fine-tuning status
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fine_tuning_service import fine_tuning_service, FINE_TUNING_CONFIG, COINS
from datetime import datetime


def print_header(title: str):
    print("\n" + "=" * 60)
    print(f"   {title}")
    print("=" * 60)


def print_config():
    """Print current fine-tuning configuration."""
    print_header("FINE-TUNING CONFIGURATION")
    print(f"\n{'Coin':<15} {'Enabled':<10} {'Frequency':<12} {'Epochs':<8} {'Priority':<10}")
    print("-" * 60)
    
    for coin, config in FINE_TUNING_CONFIG.items():
        enabled = "✅" if config.get("enabled") else "❌"
        freq = f"{config.get('frequency_hours', 24)}h"
        epochs = config.get("epochs", 2)
        priority = config.get("priority", "MEDIUM")
        
        print(f"{coin:<15} {enabled:<10} {freq:<12} {epochs:<8} {priority:<10}")


def run_fine_tuning(coin: str = None):
    """Run fine-tuning for one or all coins."""
    print_header(f"FINE-TUNING: {coin.upper() if coin else 'ALL COINS'}")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    if coin:
        result = fine_tuning_service.run_fine_tuning(coin)
        print_results({coin: result})
    else:
        results = fine_tuning_service.run_all()
        print_results(results)
        
    print(f"\nCompleted at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


def print_results(results: dict):
    """Print fine-tuning results in a nice format."""
    print("\n" + "-" * 60)
    
    for coin, result in results.items():
        print(f"\n📊 {coin.upper()}")
        
        if isinstance(result, dict):
            for horizon, data in result.items():
                if isinstance(data, dict):
                    status = data.get("status", "unknown")
                    icon = "✅" if status == "success" else ("⚠️" if status == "no_improvement" else "❌")
                    
                    old_mae = data.get("old_mae", 0)
                    new_mae = data.get("new_mae", 0)
                    improvement = data.get("improvement", 0)
                    
                    print(f"   {horizon}: {icon} {status}")
                    if old_mae > 0:
                        print(f"       MAE: {old_mae:.4f} → {new_mae:.4f} ({'+' if improvement < 0 else ''}{-improvement:.4f})")
                else:
                    print(f"   {horizon}: {data}")


def main():
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        
        if arg == "--help" or arg == "-h":
            print(__doc__)
            return
            
        if arg == "--config":
            print_config()
            return
            
        if arg == "--status":
            print_header("LAST FINE-TUNING STATUS")
            for coin, last_run in fine_tuning_service.last_fine_tune.items():
                print(f"  {coin}: {last_run}")
            if not fine_tuning_service.last_fine_tune:
                print("  No fine-tuning runs recorded in this session.")
            return
            
        if arg in COINS:
            run_fine_tuning(arg)
            return
            
        print(f"Unknown coin: {arg}")
        print(f"Available coins: {', '.join(COINS.keys())}")
        return
        
    # Default: run all
    print_config()
    run_fine_tuning()


if __name__ == "__main__":
    main()
