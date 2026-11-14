#!/usr/bin/env bash
set -e
cd client
npm ci
npm run build
cd ../server
pip install -r requirements.txt
