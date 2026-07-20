#!/usr/bin/env python3
"""Check Redis for lockouts."""
import redis

try:
    r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)
    r.ping()
    print("Redis connected successfully")
    
    # Check for any lockout keys
    user_id = "34b1401f-6d07-41be-bdf5-eb4fbcb77ea0"
    
    # Check failed attempts
    failed_key = f"auth:failed_attempts:{user_id}"
    failed = r.get(failed_key)
    print(f"Failed attempts: {failed}")
    
    # Check lockout
    lockout_key = f"auth:lockout:{user_id}"
    lockout = r.get(lockout_key)
    print(f"Lockout TTL: {lockout}")
    
    # List all auth keys
    print("\nAll auth keys:")
    for key in r.scan_iter(match="auth:*"):
        print(f"  {key}")
        
except Exception as e:
    print(f"Redis error: {e}")
