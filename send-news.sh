#!/bin/bash

# Simple script to send news notification
FLAG_FILE="/tmp/news-notification.flag"
NEWS_FILE="/tmp/latest-news.txt"

# Check if flag exists
if [ -f "$FLAG_FILE" ]; then
    # Remove flag
    rm "$FLAG_FILE"
    
    # Check if news file exists
    if [ -f "$NEWS_FILE" ]; then
        # Read news content
        NEWS_CONTENT=$(cat "$NEWS_FILE")
        
        # Send via openclaw CLI
        openclaw message send --channel whatsapp --target "+64220621342" -m "$NEWS_CONTENT" --json > /tmp/news-send.log 2>&1 &
        
        echo "Notification sent"
    else
        echo "No news file found"
    fi
fi