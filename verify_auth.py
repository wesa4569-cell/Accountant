import requests
import sys

BASE_URL = "http://localhost:8000/api/auth"

def test_auth():
    # 1. Register
    import time
    email = f"test_user_{int(time.time())}@example.com"
    password = "securepassword123"
    try:
        register_resp = requests.post(f"{BASE_URL}/register", json={
            "email": email,
            "password": password,
            "full_name": "Test User",
            "role": "consultant"
        })
        if register_resp.status_code == 200:
            print("Registration: SUCCESS")
        elif register_resp.status_code == 400 and "already registered" in register_resp.text:
            print("Registration: USER ALREADY EXISTS (OK)")
        else:
            print(f"Registration: FAILED ({register_resp.status_code}) - {register_resp.text}")
            sys.exit(1)

        # 2. Login
        login_resp = requests.post(f"{BASE_URL}/token", data={
            "username": email,
            "password": password
        })
        if login_resp.status_code == 200:
            token = login_resp.json()["access_token"]
            print("Login: SUCCESS")
        else:
            print(f"Login: FAILED ({login_resp.status_code}) - {login_resp.text}")
            sys.exit(1)

        # 3. Get Me
        me_resp = requests.get(f"{BASE_URL}/me", headers={"Authorization": f"Bearer {token}"})
        if me_resp.status_code == 200:
            print(f"Get Me: SUCCESS (User: {me_resp.json()['email']})")
        else:
            print(f"Get Me: FAILED ({me_resp.status_code}) - {me_resp.text}")
            sys.exit(1)

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    test_auth()
