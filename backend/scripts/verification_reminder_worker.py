"""
Background worker that sends daily verification reminders to unverified sellers.
Runs once per day at 10:00 AM WAT (West Africa Time).
"""
import asyncio
import os
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Add parent directory to path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv(ROOT / '.env')

from sqlalchemy import text as _text
from shared.database import get_supabase_session_factory
from shared.logging import get_logger
from shared.email_notifications import send_notification_email

logger = get_logger(__name__)


async def send_verification_reminders():
    """Send verification reminders to all unverified sellers."""
    session_factory = get_supabase_session_factory()
    
    try:
        async with session_factory() as session:
            # Get all users who are not verified and haven't been notified today
            unverified_users = (await session.execute(_text("""
                SELECT 
                    CAST(u.id AS TEXT) as user_id,
                    u.email,
                    u.full_name,
                    u.seller_verification_status,
                    COALESCE(u.last_verification_reminder, '1970-01-01'::timestamp) as last_reminded
                FROM users u
                WHERE u.seller_verification_status IN ('not_verified', 'pending', 'rejected')
                AND u.email IS NOT NULL
                AND u.email != ''
                AND (
                    u.last_verification_reminder IS NULL 
                    OR u.last_verification_reminder < NOW() - INTERVAL '23 hours'
                )
                LIMIT 500
            """))).mappings().all()
            
            notification_count = 0
            email_count = 0
            
            for user in unverified_users:
                user_id = user['user_id']
                email = user['email']
                full_name = user['full_name'] or 'Seller'
                status = user['seller_verification_status'] or 'not_verified'
                
                # Determine message based on status
                if status == 'rejected':
                    title = "Resubmit Your Verification"
                    message = "Your previous verification was rejected. Please review the feedback and resubmit with the required documents."
                    email_subject = "Velontri: Resubmit Your Verification"
                    email_message = "Your previous verification was rejected. Please review the feedback and resubmit with the required documents to start selling on Velontri."
                elif status == 'pending':
                    title = "Verification Under Review"
                    message = "Your verification is being reviewed. This usually takes 24-48 hours. We'll notify you once it's complete."
                    email_subject = "Velontri: Verification Under Review"
                    email_message = "Your seller verification is currently being reviewed by our team. This process typically takes 24-48 hours. We'll notify you as soon as it's complete!"
                    # Send notification for pending too - users want updates
                else:  # not_verified
                    title = "Complete Your Seller Verification"
                    message = "Get verified to build trust with buyers! Verified sellers get 3× more inquiries. It only takes 5 minutes."
                    email_subject = "Velontri: Complete Your Seller Verification"
                    email_message = "Get verified to build trust with buyers! Verified sellers get 3× more inquiries and sell faster. The verification process only takes 5 minutes. Complete it now to unlock your full selling potential!"
                
                action_url = "https://velontri.pxxl.click/dashboard/verification"
                
                try:
                    # Create web notification in database
                    await session.execute(_text("""
                        INSERT INTO notifications (
                            user_id,
                            recipient_user_id,
                            notification_type,
                            title,
                            message,
                            action_url,
                            related_resource_type,
                            is_read,
                            created_at
                        ) VALUES (
                            :user_id,
                            :user_id,
                            'verification_reminder',
                            :title,
                            :message,
                            :action_url,
                            'verification',
                            FALSE,
                            NOW()
                        )
                    """), {
                        'user_id': user_id,
                        'title': title,
                        'message': message,
                        'action_url': '/dashboard/verification',
                    })
                    
                    notification_count += 1
                    
                    # Send email notification
                    email_success, email_error = await send_notification_email(
                        to_email=email,
                        subject=email_subject,
                        title=title,
                        message=email_message,
                        action_url=action_url,
                        notification_type="alert" if status == 'rejected' else "info"
                    )
                    
                    if email_success:
                        email_count += 1
                        logger.info(f"Sent email reminder to {email} (status: {status})")
                    else:
                        logger.warning(f"Web notification sent but email failed for {email}: {email_error}")
                    
                    # Update last reminder timestamp
                    await session.execute(_text("""
                        UPDATE users 
                        SET last_verification_reminder = NOW()
                        WHERE CAST(id AS TEXT) = :user_id
                    """), {'user_id': user_id})
                    
                    await session.commit()
                    logger.info(f"Sent verification reminder to {email} (status: {status})")
                    
                except Exception as e:
                    logger.error(f"Failed to send reminder to {user_id}: {e}")
                    await session.rollback()
            
            logger.info(f"Sent {notification_count} web notifications and {email_count} email reminders")
            return notification_count
            
    except Exception as e:
        logger.error(f"Error in verification reminder worker: {e}")
        return 0


async def run_daily_schedule():
    """Run the reminder task once per day at 10:00 AM WAT."""
    logger.info("Verification reminder worker started")
    logger.info("Will send reminders daily at 10:00 AM WAT")
    
    while True:
        try:
            now = datetime.now(timezone.utc)
            # WAT is UTC+1
            wat_now = now + timedelta(hours=1)
            
            # Calculate next 10:00 AM WAT
            next_run = wat_now.replace(hour=10, minute=0, second=0, microsecond=0)
            
            # If we've passed 10 AM today, schedule for tomorrow
            if wat_now >= next_run:
                next_run += timedelta(days=1)
            
            # Convert back to UTC for sleeping
            next_run_utc = next_run - timedelta(hours=1)
            sleep_seconds = (next_run_utc - now).total_seconds()
            
            logger.info(f"Next reminder run scheduled for {next_run.strftime('%Y-%m-%d %H:%M WAT')}")
            logger.info(f"Sleeping for {sleep_seconds / 3600:.1f} hours...")
            
            await asyncio.sleep(sleep_seconds)
            
            # Send reminders
            logger.info("Starting verification reminder batch...")
            count = await send_verification_reminders()
            logger.info(f"Completed: sent {count} reminders")
            
        except Exception as e:
            logger.error(f"Error in daily schedule loop: {e}")
            # Sleep for 1 hour before retrying on error
            await asyncio.sleep(3600)


async def main():
    """Main entry point."""
    logger.info("=" * 60)
    logger.info("VERIFICATION REMINDER WORKER")
    logger.info("=" * 60)
    
    try:
        await run_daily_schedule()
    except KeyboardInterrupt:
        logger.info("Worker stopped by user")
    except Exception as e:
        logger.error(f"Worker crashed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
