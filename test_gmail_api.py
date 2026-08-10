import asyncio
import httpx
import base64
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os
from dotenv import load_dotenv

load_dotenv("backend/.env")

async def test():
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    refresh_token = os.getenv("GMAIL_REFRESH_TOKEN")

    print(f"Client ID: {client_id}")
    print(f"Refresh Token: {refresh_token[:10]}...")

    async with httpx.AsyncClient() as client:
        print("1. Exchanging refresh token...")
        token_resp = await client.post(
            "https://oauth2.googleapis.com/token",
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token"
            }
        )
        if token_resp.status_code != 200:
            print("Failed to get access token:", token_resp.text)
            return
            
        access_token = token_resp.json()["access_token"]
        print("Got access token!")

        print("2. Sending test email...")
        msg = MIMEMultipart()
        msg["Subject"] = "Test from HTTP API"
        msg["From"] = "okewunmimojolaoluwa@gmail.com"
        msg["To"] = "okewunmimojolaoluwa@gmail.com"
        msg.attach(MIMEText("This is a test message via HTTP API.", "plain"))

        raw_msg = base64.urlsafe_b64encode(msg.as_bytes()).decode()

        send_resp = await client.post(
            "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
            headers={
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json"
            },
            json={"raw": raw_msg}
        )
        
        print(f"Status: {send_resp.status_code}")
        print(f"Response: {send_resp.text}")

if __name__ == "__main__":
    asyncio.run(test())
