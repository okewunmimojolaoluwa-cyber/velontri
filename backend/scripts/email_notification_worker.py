"""
Background worker that sends email notifications for all new notifications.
Polls the notifications table every 10 seconds and sends emails for unprocessed notifications.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add parent directory to path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from sqlalchemy import text as _text
from shared.database import get_supabase_session_factory
from shared.email_notifications import send_notification_email
from shared.logging import get_logger

logger = get_logger(__name__)


async def process_notifications():
    """Poll for new notifications and send emails."""
    session_factory = get_supabase_session_factory()
    
    # Track processed notification IDs to avoid duplicates
    processed_ids = set()
    
    while True:
        try:
            async with session_factory() as session:
                # Get unprocessed notifications from the last hour
                rows = (await session.execute(_text("""
                    SELECT 
                        n.id,
                        n.user_id as recipient_user_id,
                        n.recipient_user_id as alt_recipient_id,
                        COALESCE(n.title, 'Notification') as title,
                        COALESCE(n.message, '') as message,
                        n.action_url,
                        u.email,
                        u.full_name
                    FROM notifications n
                    LEFT JOIN users u ON (
                        CAST(u.id AS TEXT) = CAST(n.user_id AS TEXT) OR 
                        CAST(u.id AS TEXT) = CAST(n.recipient_user_id AS TEXT)
                    )
                    WHERE n.created_at > NOW() - INTERVAL '1 hour'
                    AND u.email IS NOT NULL
                    AND u.email != ''
                    ORDER BY n.created_at DESC
                    LIMIT 50
                """))).mappings().all()
                
                for row in rows:
                    notif_id = str(row['id'])
                    
                    # Skip if already processed
                    if notif_id in processed_ids:
                        continue
                    
                    email = row.get('email')
                    if not email:
                        processed_ids.add(notif_id)
                        continue
                    
                    full_name = row.get('full_name') or 'Velontri User'
                    title = row.get('title') or 'Notification'
                    message = row.get('message') or ''
                    action_url = row.get('action_url')
                    
                    try:
                        await send_notification_email(
                            recipient_email=email,
                            recipient_name=full_name,
                            notification_title=title,
                            notification_message=message,
                            action_url=action_url,
                        )
                        logger.info(f"Sent email notification to {email} for notification {notif_id}")
                        processed_ids.add(notif_id)
                    except Exception as e:
                        logger.error(f"Failed to send email for notification {notif_id}: {e}")
                        # Don't mark as processed so we can retry
                
                # Clear old processed IDs (keep last 1000)
                if len(processed_ids) > 1000:
                    processed_ids.clear()
        
        except Exception as e:
            logger.error(f"Error processing notifications: {e}")
        
        # Wait 10 seconds before next poll
        await asyncio.sleep(10)


async def main():
    """Main entry point."""
    logger.info("Starting email notification worker...")
    logger.info("Polling for new notifications every 10 seconds...")
    
    try:
        await process_notifications()
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
    except Exception as e:
        logger.error(f"Worker crashed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
