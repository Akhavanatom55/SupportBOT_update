#!/bin/sh
set -eu

mkdir -p /data

echo "[SupportBOT] Starting unified Bale + Web Admin service..."
exec npm start
