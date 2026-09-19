#!/usr/bin/env python3
"""
QA Guardian Backend API Test Suite
Tests all endpoints for user registration, login, test runs, environments, checklists, and reports
"""

import requests
import sys
import json
from datetime import datetime
import time

class QAGuardianAPITester:
    def __init__(self, base_url="https://qa-guardian-test.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_id = None
        self.environment_id = None
        self.test_run_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, message="", details=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: {message}")
        else:
            print(f"❌ {name}: {message}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "message": message,
            "details": details or {}
        })

    def make_request(self, method, endpoint, data=None, params=None, expect_status=200):
        """Make HTTP request with proper headers"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, params=params, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, params=params, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            success = response.status_code == expect_status
            response_data = {}
            
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text[:200]}

            return success, response.status_code, response_data

        except Exception as e:
            return False, 0, {"error": str(e)}

    def test_user_registration(self):
        """Test user registration"""
        timestamp = int(time.time())
        test_user = {
            "name": f"Test User {timestamp}",
            "email": f"test{timestamp}@casacarigar.com",
            "password": "Test123!"
        }
        
        success, status, data = self.make_request('POST', 'auth/register', test_user, expect_status=200)
        
        if success and 'token' in data:
            self.token = data['token']
            self.user_id = data['user']['id']
            self.log_test("User Registration", True, f"User registered successfully with ID: {self.user_id}")
            return True
        else:
            self.log_test("User Registration", False, f"Status: {status}, Response: {data}")
            return False

    def test_user_login(self):
        """Test user login with provided credentials"""
        credentials = {
            "email": "test@casacarigar.com",
            "password": "Test123!"
        }
        
        success, status, data = self.make_request('POST', 'auth/login', credentials, expect_status=200)
        
        if success and 'token' in data:
            self.token = data['token']
            self.user_id = data['user']['id']
            self.log_test("User Login", True, f"Login successful for user: {data['user']['email']}")
            return True
        else:
            self.log_test("User Login", False, f"Status: {status}, Response: {data}")
            return False

    def test_get_user_profile(self):
        """Test getting current user profile"""
        success, status, data = self.make_request('GET', 'auth/me')
        
        if success and 'id' in data:
            self.log_test("Get User Profile", True, f"Profile retrieved for: {data.get('name', 'Unknown')}")
            return True
        else:
            self.log_test("Get User Profile", False, f"Status: {status}, Response: {data}")
            return False

    def test_get_environments(self):
        """Test getting test environments"""
        success, status, data = self.make_request('GET', 'environments')
        
        if success and isinstance(data, list):
            if len(data) > 0:
                self.environment_id = data[0]['id']
                self.log_test("Get Environments", True, f"Found {len(data)} environments")
            else:
                self.log_test("Get Environments", True, "No environments found (expected for new user)")
            return True
        else:
            self.log_test("Get Environments", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_environment(self):
        """Test creating a new test environment"""
        env_data = {
            "name": "Test Environment",
            "url": "https://casacarigar.com"
        }
        
        success, status, data = self.make_request('POST', 'environments', env_data, expect_status=200)
        
        if success and 'id' in data:
            self.environment_id = data['id']
            self.log_test("Create Environment", True, f"Environment created with ID: {self.environment_id}")
            return True
        else:
            self.log_test("Create Environment", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_daily_test_run(self):
        """Test creating a daily test run"""
        if not self.environment_id:
            self.log_test("Create Daily Test Run", False, "No environment ID available")
            return False
            
        run_data = {
            "environment_id": self.environment_id,
            "suite_type": "daily"
        }
        
        success, status, data = self.make_request('POST', 'runs', run_data, expect_status=200)
        
        if success and 'id' in data:
            self.test_run_id = data['id']
            self.log_test("Create Daily Test Run", True, f"Daily test run created with ID: {self.test_run_id}")
            return True
        else:
            self.log_test("Create Daily Test Run", False, f"Status: {status}, Response: {data}")
            return False

    def test_create_weekly_test_run(self):
        """Test creating a weekly test run"""
        if not self.environment_id:
            self.log_test("Create Weekly Test Run", False, "No environment ID available")
            return False
            
        run_data = {
            "environment_id": self.environment_id,
            "suite_type": "weekly"
        }
        
        success, status, data = self.make_request('POST', 'runs', run_data, expect_status=200)
        
        if success and 'id' in data:
            weekly_run_id = data['id']
            self.log_test("Create Weekly Test Run", True, f"Weekly test run created with ID: {weekly_run_id}")
            return True
        else:
            self.log_test("Create Weekly Test Run", False, f"Status: {status}, Response: {data}")
            return False

    def test_get_test_runs(self):
        """Test getting list of test runs"""
        success, status, data = self.make_request('GET', 'runs')
        
        if success and isinstance(data, list):
            self.log_test("Get Test Runs", True, f"Retrieved {len(data)} test runs")
            return True
        else:
            self.log_test("Get Test Runs", False, f"Status: {status}, Response: {data}")
            return False

    def test_get_test_run_detail(self):
        """Test getting specific test run details"""
        if not self.test_run_id:
            self.log_test("Get Test Run Detail", False, "No test run ID available")
            return False
            
        success, status, data = self.make_request('GET', f'runs/{self.test_run_id}')
        
        if success and 'id' in data:
            self.log_test("Get Test Run Detail", True, f"Retrieved details for run: {data['status']}")
            return True
        else:
            self.log_test("Get Test Run Detail", False, f"Status: {status}, Response: {data}")
            return False

    def test_get_checklists(self):
        """Test getting checklists"""
        success, status, data = self.make_request('GET', 'checklists')
        
        if success and isinstance(data, list):
            self.log_test("Get Checklists", True, f"Retrieved {len(data)} checklist items")
            return True
        else:
            self.log_test("Get Checklists", False, f"Status: {status}, Response: {data}")
            return False

    def test_update_checklist_item(self):
        """Test updating a checklist item"""
        # First get checklists to find an item to update
        success, status, data = self.make_request('GET', 'checklists')
        
        if not success or not data:
            self.log_test("Update Checklist Item", False, "No checklist items found")
            return False
            
        item_id = data[0]['id']
        params = {"is_completed": True, "notes": "Test update"}
        
        success, status, response = self.make_request('PUT', f'checklists/{item_id}', params=params)
        
        if success:
            self.log_test("Update Checklist Item", True, f"Updated checklist item {item_id}")
            return True
        else:
            self.log_test("Update Checklist Item", False, f"Status: {status}, Response: {response}")
            return False

    def test_reset_checklists(self):
        """Test resetting checklists"""
        params = {"checklist_type": "daily"}
        success, status, data = self.make_request('POST', 'checklists/reset', params=params)
        
        if success:
            self.log_test("Reset Checklists", True, "Daily checklist reset successfully")
            return True
        else:
            self.log_test("Reset Checklists", False, f"Status: {status}, Response: {data}")
            return False

    def test_get_reports(self):
        """Test getting reports"""
        success, status, data = self.make_request('GET', 'reports')
        
        if success and isinstance(data, list):
            self.log_test("Get Reports", True, f"Retrieved {len(data)} reports")
            return True
        else:
            self.log_test("Get Reports", False, f"Status: {status}, Response: {data}")
            return False

    def test_generate_pdf_report(self):
        """Test PDF report generation"""
        if not self.test_run_id:
            self.log_test("Generate PDF Report", False, "No test run ID available")
            return False
            
        # Wait a bit for test run to potentially complete
        time.sleep(5)
        
        try:
            url = f"{self.api_url}/reports/{self.test_run_id}/pdf"
            headers = {'Authorization': f'Bearer {self.token}'}
            response = requests.get(url, headers=headers, timeout=30)
            
            if response.status_code == 200 and response.headers.get('content-type') == 'application/pdf':
                self.log_test("Generate PDF Report", True, f"PDF generated successfully ({len(response.content)} bytes)")
                return True
            else:
                self.log_test("Generate PDF Report", False, f"Status: {response.status_code}, Content-Type: {response.headers.get('content-type')}")
                return False
        except Exception as e:
            self.log_test("Generate PDF Report", False, f"Error: {str(e)}")
            return False

    def test_dashboard_stats(self):
        """Test dashboard statistics endpoint"""
        success, status, data = self.make_request('GET', 'dashboard/stats')
        
        if success and 'total_runs' in data:
            self.log_test("Dashboard Stats", True, f"Stats retrieved: {data['total_runs']} total runs, {data['avg_pass_rate']}% avg pass rate")
            return True
        else:
            self.log_test("Dashboard Stats", False, f"Status: {status}, Response: {data}")
            return False

    def test_delete_environment(self):
        """Test deleting an environment (cleanup)"""
        if not self.environment_id:
            self.log_test("Delete Environment", True, "No environment to delete (skipped)")
            return True
            
        success, status, data = self.make_request('DELETE', f'environments/{self.environment_id}')
        
        if success:
            self.log_test("Delete Environment", True, "Environment deleted successfully")
            return True
        else:
            self.log_test("Delete Environment", False, f"Status: {status}, Response: {data}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting QA Guardian API Tests")
        print(f"📍 Base URL: {self.base_url}")
        print(f"🔗 API URL: {self.api_url}")
        print("=" * 60)
        
        # Authentication Tests
        print("\n🔐 Authentication Tests")
        if not self.test_user_registration():
            # If registration fails, try login with existing credentials
            print("Registration failed, trying login with existing credentials...")
            if not self.test_user_login():
                print("❌ Both registration and login failed. Stopping tests.")
                return False
        
        self.test_get_user_profile()
        
        # Environment Tests
        print("\n🌍 Environment Tests")
        self.test_get_environments()
        if not self.environment_id:
            self.test_create_environment()
        
        # Test Run Tests
        print("\n🧪 Test Run Tests")
        self.test_create_daily_test_run()
        self.test_create_weekly_test_run()
        self.test_get_test_runs()
        self.test_get_test_run_detail()
        
        # Checklist Tests
        print("\n📋 Checklist Tests")
        self.test_get_checklists()
        self.test_update_checklist_item()
        self.test_reset_checklists()
        
        # Report Tests
        print("\n📊 Report Tests")
        self.test_get_reports()
        self.test_generate_pdf_report()
        
        # Dashboard Tests
        print("\n📈 Dashboard Tests")
        self.test_dashboard_stats()
        
        # Cleanup
        print("\n🧹 Cleanup Tests")
        # Note: Not deleting environment as it might be needed for frontend tests
        
        # Print Summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return True
        else:
            print(f"⚠️  {self.tests_run - self.tests_passed} tests failed")
            return False

def main():
    tester = QAGuardianAPITester()
    success = tester.run_all_tests()
    
    # Save detailed results
    with open('/app/backend_test_results.json', 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "total_tests": tester.tests_run,
            "passed_tests": tester.tests_passed,
            "success_rate": (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0,
            "results": tester.test_results
        }, f, indent=2)
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())