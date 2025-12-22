#!/bin/bash
#
# Start Fine-Tuning Services
# ===========================
#
# This script starts all components needed for scheduled fine-tuning:
# 1. Redis (message broker)
# 2. Celery Worker (executes tasks)
# 3. Celery Beat (scheduler)
#
# Usage:
#   ./start_fine_tuning.sh        # Start all services
#   ./start_fine_tuning.sh worker # Start only worker
#   ./start_fine_tuning.sh beat   # Start only beat
#   ./start_fine_tuning.sh stop   # Stop all services
#

cd "$(dirname "$0")"

# Activate virtual environment
source ../../../.venv/bin/activate

case "$1" in
    worker)
        echo "Starting Celery Worker..."
        celery -A celery_tasks worker --loglevel=info
        ;;
    beat)
        echo "Starting Celery Beat (Scheduler)..."
        celery -A celery_tasks beat --loglevel=info
        ;;
    stop)
        echo "Stopping Celery services..."
        pkill -f "celery -A celery_tasks"
        echo "Stopped."
        ;;
    status)
        echo "Checking Celery processes..."
        ps aux | grep "celery" | grep -v grep
        ;;
    *)
        echo "=========================================="
        echo "   Scheduled Fine-Tuning Service"
        echo "=========================================="
        echo ""
        echo "Starting services in background..."
        
        # Check if Redis is running
        if ! pgrep -x "redis-server" > /dev/null; then
            echo "⚠️  Redis not running. Please start Redis first:"
            echo "   brew services start redis"
            echo "   OR: redis-server &"
            exit 1
        fi
        echo "✅ Redis is running"
        
        # Start worker in background
        echo "Starting Celery Worker..."
        celery -A celery_tasks worker --loglevel=info --detach --pidfile=celery_worker.pid --logfile=logs/celery_worker.log
        
        # Start beat in background
        echo "Starting Celery Beat..."
        celery -A celery_tasks beat --loglevel=info --detach --pidfile=celery_beat.pid --logfile=logs/celery_beat.log
        
        echo ""
        echo "✅ Fine-tuning services started!"
        echo ""
        echo "Schedule:"
        echo "  Bitcoin & Binancecoin: Every 6 hours"
        echo "  Ethereum: Every 12 hours"
        echo "  Solana & Cardano: Once daily"
        echo ""
        echo "Logs: ./logs/"
        echo ""
        echo "To stop: ./start_fine_tuning.sh stop"
        ;;
esac
