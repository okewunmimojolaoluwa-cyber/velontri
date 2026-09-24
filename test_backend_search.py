import requests

# Test the backend search
print("Testing backend search for 'south africa'...")

try:
    response = requests.get("https://velontri.onrender.com/api/v1/search?q=south+africa")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"Error: {e}")

# Also test Nigeria which should work
print("\nTesting backend search for 'nigeria'...")
try:
    response = requests.get("https://velontri.onrender.com/api/v1/search?q=nigeria")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.text[:500]}")
except Exception as e:
    print(f"Error: {e}")
