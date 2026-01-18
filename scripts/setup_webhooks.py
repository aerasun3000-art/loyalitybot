#!/usr/bin/env python3
"""
Script to setup Telegram webhooks for Cloudflare Workers
This script configures webhooks for all bots pointing to Cloudflare Workers endpoints
"""

import os
import requests
import sys
from dotenv import load_dotenv

load_dotenv()

# Cloudflare Workers URLs (you'll get these after deploying)
# Format: https://<worker-name>.<account-subdomain>.workers.dev
CLOUDFLARE_WORKER_URLS = {
    'client': os.getenv('CLOUDFLARE_CLIENT_WEBHOOK_URL', ''),
    'partner': os.getenv('CLOUDFLARE_PARTNER_WEBHOOK_URL', ''),
    'admin': os.getenv('CLOUDFLARE_ADMIN_WEBHOOK_URL', ''),
}

# Bot tokens
TOKENS = {
    'client': os.getenv('TOKEN_CLIENT'),
    'partner': os.getenv('TOKEN_PARTNER'),
    'admin': os.getenv('ADMIN_BOT_TOKEN'),
}

# Optional: Secret tokens for webhook validation
WEBHOOK_SECRET_TOKENS = {
    'client': os.getenv('WEBHOOK_SECRET_TOKEN_CLIENT', ''),
    'partner': os.getenv('WEBHOOK_SECRET_TOKEN_PARTNER', ''),
    'admin': os.getenv('WEBHOOK_SECRET_TOKEN_ADMIN', ''),
}


def get_webhook_info(token):
    """Get current webhook info"""
    url = f"https://api.telegram.org/bot{token}/getWebhookInfo"
    response = requests.get(url)
    return response.json()


def delete_webhook(token):
    """Delete existing webhook"""
    url = f"https://api.telegram.org/bot{token}/deleteWebhook"
    response = requests.post(url, json={'drop_pending_updates': True})
    return response.json()


def set_webhook(token, webhook_url, secret_token=None):
    """Set webhook URL"""
    url = f"https://api.telegram.org/bot{token}/setWebhook"
    payload = {'url': webhook_url}
    
    if secret_token:
        payload['secret_token'] = secret_token
    
    response = requests.post(url, json=payload)
    return response.json()


def setup_webhook(bot_name, token, webhook_url, secret_token=None):
    """Setup webhook for a specific bot"""
    print(f"\n{'='*60}")
    print(f"Setting up webhook for {bot_name.upper()} bot")
    print(f"{'='*60}")
    
    if not token:
        print(f"❌ ERROR: TOKEN_{bot_name.upper()} not found in environment")
        return False
    
    if not webhook_url:
        print(f"❌ ERROR: Cloudflare webhook URL for {bot_name} not found")
        print(f"   Set CLOUDFLARE_{bot_name.upper()}_WEBHOOK_URL in .env")
        return False
    
    # Get current webhook info
    print(f"\n📋 Current webhook info:")
    current_info = get_webhook_info(token)
    if current_info.get('ok'):
        info = current_info.get('result', {})
        print(f"   URL: {info.get('url', 'Not set')}")
        print(f"   Pending updates: {info.get('pending_update_count', 0)}")
    
    # Delete existing webhook if needed
    if info.get('url'):
        print(f"\n🗑️  Deleting existing webhook...")
        delete_result = delete_webhook(token)
        if delete_result.get('ok'):
            print(f"   ✅ Webhook deleted")
        else:
            print(f"   ⚠️  Warning: {delete_result.get('description', 'Unknown error')}")
    
    # Set new webhook
    print(f"\n🔗 Setting new webhook...")
    print(f"   URL: {webhook_url}")
    if secret_token:
        print(f"   Secret token: {secret_token[:10]}...")
    
    set_result = set_webhook(token, webhook_url, secret_token)
    
    if set_result.get('ok'):
        print(f"   ✅ Webhook set successfully!")
        
        # Verify
        verify_info = get_webhook_info(token)
        if verify_info.get('ok'):
            verified_url = verify_info.get('result', {}).get('url', '')
            if verified_url == webhook_url:
                print(f"   ✅ Verified: Webhook is active")
                return True
            else:
                print(f"   ⚠️  Warning: URL mismatch")
                print(f"      Expected: {webhook_url}")
                print(f"      Got: {verified_url}")
                return False
        return True
    else:
        print(f"   ❌ ERROR: {set_result.get('description', 'Unknown error')}")
        return False


def main():
    """Main function"""
    print("🚀 Telegram Webhook Setup for Cloudflare Workers")
    print("=" * 60)
    
    # Check if all required environment variables are set
    missing_vars = []
    for bot_name in ['client', 'partner', 'admin']:
        if not TOKENS.get(bot_name):
            missing_vars.append(f'TOKEN_{bot_name.upper()}')
    
    if missing_vars:
        print(f"\n❌ Missing required environment variables:")
        for var in missing_vars:
            print(f"   - {var}")
        print("\nPlease set these variables in your .env file")
        sys.exit(1)
    
    # Setup webhooks for each bot
    results = {}
    
    for bot_name in ['client', 'partner', 'admin']:
        token = TOKENS.get(bot_name)
        webhook_url = CLOUDFLARE_WORKER_URLS.get(bot_name)
        secret_token = WEBHOOK_SECRET_TOKENS.get(bot_name) or None
        
        if webhook_url:
            results[bot_name] = setup_webhook(bot_name, token, webhook_url, secret_token)
        else:
            print(f"\n⚠️  Skipping {bot_name} bot: webhook URL not configured")
            results[bot_name] = None
    
    # Summary
    print(f"\n{'='*60}")
    print("📊 SUMMARY")
    print(f"{'='*60}")
    
    for bot_name, success in results.items():
        if success is True:
            print(f"✅ {bot_name.upper()}: Webhook configured")
        elif success is False:
            print(f"❌ {bot_name.upper()}: Failed to configure webhook")
        else:
            print(f"⏭️  {bot_name.upper()}: Skipped (URL not configured)")
    
    # Final status
    all_success = all(success for success in results.values() if success is not None)
    
    if all_success:
        print(f"\n✅ All configured webhooks set successfully!")
        print(f"\n⚠️  Remember to:")
        print(f"   1. Test each webhook by sending a message to the bot")
        print(f"   2. Monitor logs in Cloudflare Dashboard")
        print(f"   3. Stop long polling processes on Fly.io after verification")
        return 0
    else:
        print(f"\n⚠️  Some webhooks failed to configure. Check errors above.")
        return 1


if __name__ == '__main__':
    sys.exit(main())
