#!/bin/sh
# Lets the backend URL be changed with an environment variable, no rebuild needed.
cat > /usr/share/nginx/html/config.js <<CONFIG
window.__CONFIG__ = { API_URL: "${API_URL:-http://localhost:8080}" };
CONFIG
