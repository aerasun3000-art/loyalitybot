#!/bin/bash
# Start script for Render deployment

# Activate virtual environment if it exists
if [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Install dependencies
pip install -r requirements.txt

# Start the server
python3 -m uvicorn secure_api:app --host 0.0.0.0 --port ${PORT:-10000}


