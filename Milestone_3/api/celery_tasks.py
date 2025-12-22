"""
Celery Tasks for Scheduled Fine-Tuning
=======================================

This module defines Celery tasks for periodic model fine-tuning.
Uses Redis as the message broker.

Setup:
    1. Install Redis: brew install redis && brew services start redis
    2. Install Celery: pip install celery redis
    3. Start worker: celery -A celery_tasks worker --loglevel=info
    4. Start beat (scheduler): celery -A celery_tasks beat --loglevel=info
"""

from celery import Celery
from celery.schedules import crontab
import logging

# Configure Celery
app = Celery(
    'crypto_fine_tuning',
    broker='redis://localhost:6379/0',
    backend='redis://localhost:6379/0'
)

# Celery configuration
app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=3600,  # 1 hour max per task
    worker_prefetch_multiplier=1,
)

# Beat schedule - runs fine-tuning at specified intervals
app.conf.beat_schedule = {
    # Bitcoin & Binancecoin: Every 6 hours
    'fine-tune-bitcoin-6h': {
        'task': 'celery_tasks.fine_tune_coin',
        'schedule': crontab(minute=0, hour='*/6'),
        'args': ('bitcoin',)
    },
    'fine-tune-binancecoin-6h': {
        'task': 'celery_tasks.fine_tune_coin',
        'schedule': crontab(minute=15, hour='*/6'),
        'args': ('binancecoin',)
    },
    # Ethereum: Every 12 hours
    'fine-tune-ethereum-12h': {
        'task': 'celery_tasks.fine_tune_coin',
        'schedule': crontab(minute=30, hour='0,12'),
        'args': ('ethereum',)
    },
    # Solana & Cardano: Once daily
    'fine-tune-solana-daily': {
        'task': 'celery_tasks.fine_tune_coin',
        'schedule': crontab(minute=0, hour=2),
        'args': ('solana',)
    },
    'fine-tune-cardano-daily': {
        'task': 'celery_tasks.fine_tune_coin',
        'schedule': crontab(minute=30, hour=2),
        'args': ('cardano',)
    },
}

logger = logging.getLogger(__name__)


@app.task(bind=True, name='celery_tasks.fine_tune_coin')
def fine_tune_coin(self, coin: str):
    """Fine-tune model for a specific coin."""
    from fine_tuning_service import fine_tuning_service
    
    logger.info(f"Starting fine-tuning task for {coin}")
    
    try:
        result = fine_tuning_service.run_fine_tuning(coin)
        logger.info(f"Fine-tuning completed for {coin}: {result}")
        return {"coin": coin, "status": "success", "result": result}
    except Exception as e:
        logger.error(f"Fine-tuning failed for {coin}: {e}")
        return {"coin": coin, "status": "error", "error": str(e)}


@app.task(bind=True, name='celery_tasks.fine_tune_all')
def fine_tune_all(self):
    """Fine-tune all coins."""
    from fine_tuning_service import fine_tuning_service
    
    logger.info("Starting fine-tuning for all coins")
    
    try:
        results = fine_tuning_service.run_all()
        logger.info(f"Fine-tuning completed for all coins")
        return {"status": "success", "results": results}
    except Exception as e:
        logger.error(f"Fine-tuning failed: {e}")
        return {"status": "error", "error": str(e)}


# Manual trigger endpoint
@app.task(name='celery_tasks.trigger_fine_tuning')
def trigger_fine_tuning(coin: str = None):
    """
    Manually trigger fine-tuning.
    
    Args:
        coin: Specific coin to fine-tune, or None for all coins
    """
    if coin:
        return fine_tune_coin.delay(coin)
    else:
        return fine_tune_all.delay()
