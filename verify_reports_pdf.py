
import requests
import json
import time
import random
import string

BASE_URL = "https://qa-guardian-api.vercel.app/api"

def random_string(length=10):
    return ''.join(random.choices(string.ascii_letters + string.digits, k=length))

def run_verification():
    print("🚀 Starting Reports Page Verification")
    
    # 1. Login (or Register if needed, but let's try login first with known user if possible, else register)
    email = f"test_reports_{random_string()}@example.com"
    password = "password123"
    
    print(f"1. Registering user: {email}")
    reg_res = requests.post(f"{BASE_URL}/auth/register", json={
        "name": "Reports Tester",
        "email": email,
        "password": password
    })
    
    # 2. Login
    print("2. Logging in...")
    login_res = requests.post(f"{BASE_URL}/auth/login", json={
        "email": email,
        "password": password
    })
    token = login_res.json()['token']
    headers = {"Authorization": f"Bearer {token}"}
    print("✅ Login successful")

    # 3. Create a Dummy Run (to ensure we have a report)
    print("3. Creating a dummy run to generate a report...")
    env_res = requests.get(f"{BASE_URL}/environments", headers=headers)
    env_id = env_res.json()[0]['id']
    
    run_res = requests.post(f"{BASE_URL}/runs", json={
        "environment_id": env_id,
        "suite_type": "daily"
    }, headers=headers)
    run_id_created = run_res.json()['id']
    print(f"✅ Created Run: {run_id_created}")
    time.sleep(2) # Wait for generic

    # 4. Fetch Reports List (Mimic ReportsPage.js)
    print("4. Fetching Reports List /api/reports ...")
    # ReportsPage.js calls axios.get(`${API}/reports`) without explicit headers? 
    # Let's try WITHOUT headers first to see if it works (maybe cookie based? No, JWT)
    # The frontend likely has an interceptor. But let's assume it sends headers.
    
    reports_res = requests.get(f"{BASE_URL}/reports", headers=headers)
    if reports_res.status_code != 200:
        print(f"❌ Failed to fetch reports: {reports_res.status_code} {reports_res.text}")
        return

    reports = reports_res.json()
    if not reports:
        print("❌ Report list is empty!")
        return
        
    print(f"✅ Found {len(reports)} reports")
    target_report = reports[0]
    run_id = target_report['id']
    print(f"Target Report ID: {run_id}")

    # 5. Download PDF (Mimic ReportsPage.js fixed logic)
    # URL: `${API}/reports/${runId}/pdf?token=${token}`
    # Headers: Authorization: Bearer token
    print("5. Attempting PDF Download...")
    
    pdf_url = f"{BASE_URL}/reports/{run_id}/pdf?token={token}"
    print(f"URL: {pdf_url}")
    
    # We send BOTH query param AND header (as per my fix)
    pdf_res = requests.get(pdf_url, headers=headers)
    
    if pdf_res.status_code == 200:
        print("✅ PDF Download Success!")
        print(f"Content-Type: {pdf_res.headers.get('content-type')}")
        print(f"Size: {len(pdf_res.content)} bytes")
    else:
        print(f"❌ PDF Download Failed: {pdf_res.status_code}")
        print(pdf_res.text)

if __name__ == "__main__":
    run_verification()
