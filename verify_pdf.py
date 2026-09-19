
import requests
import json
import time
import random
import string

BASE_URL = "https://qa-guardian-api.vercel.app/api"

def random_string(length=10):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def run_verification():
    print("🚀 Starting PDF Verification on Live Env")
    
    # 1. Register
    email = f"test_{random_string()}@example.com"
    password = "password123"
    print(f"1. Registering user: {email}")
    
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "PDF Tester",
        "email": email,
        "password": password
    })
    
    if reg_res.status_code != 200:
        print(f"❌ Registration failed: {reg_res.text}")
        return

    # 2. Login
    print("2. Logging in...")
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    
    if login_res.status_code != 200:
        print(f"❌ Login failed: {login_res.text}")
        return
        
    token = login_res.json()['token']
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful, token received.")

    # 3. Get Environment
    print("3. Fetching environments...")
    env_res = requests.get(f"{BASE_URL}/environments", headers=headers)
    envs = env_res.json()
    
    if not envs:
        print("❌ No environments found")
        return
        
    env_id = envs[0]['id']
    print(f"✅ Using Environment: {env_id}")

    # 4. Create Run
    print("4. Starting Test Run...")
    run_res = requests.post(f"{BASE_URL}/runs", json={
        "environment_id": env_id,
        "suite_type": "daily"
    }, headers=headers)
    
    if run_res.status_code != 200:
        print(f"❌ Failed to start run: {run_res.text}")
        return
        
    run_id = run_res.json()['id']
    print(f"✅ Run started: {run_id}")
    
    # Wait a moment for run to initialize
    time.sleep(2)

    # 5. Download PDF (Using Query Param method)
    print("5. Attempting PDF Download (Query Param method)...")
    pdf_url = f"{BASE_URL}/reports/{run_id}/pdf?token={token}"
    
    # Note: We purposely DON'T send headers here to test the query param fallback mechanism
    # logic which mimics the browser opening a new tab
    pdf_res = requests.get(pdf_url)
    
    if pdf_res.status_code == 200 and pdf_res.headers['content-type'] == 'application/pdf':
        filename = f"verification_{run_id}.pdf"
        with open(filename, 'wb') as f:
            f.write(pdf_res.content)
        print(f"✅ PDF Downloaded Successfully! Saved to {filename}")
        print(f"Filesize: {len(pdf_res.content)} bytes")
    else:
        print(f"❌ PDF Download Failed: {pdf_res.status_code}")
        print(pdf_res.text)

if __name__ == "__main__":
    run_verification()
