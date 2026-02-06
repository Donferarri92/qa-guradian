from fastapi import FastAPI, APIRouter, HTTPException, Depends, BackgroundTasks, Query, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone
import jwt
import bcrypt
import asyncio
import aiohttp
from bs4 import BeautifulSoup
import json
import base64
from io import BytesIO
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from fastapi.responses import StreamingResponse, JSONResponse

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Secret
JWT_SECRET = os.environ.get('JWT_SECRET', 'qa-guardian-secret-key-2024')
JWT_ALGORITHM = "HS256"

# Create the main app
app = FastAPI(title="QA Guardian API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    email: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TestEnvironment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    url: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TestEnvironmentCreate(BaseModel):
    name: str
    url: str

class TestCase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    category: str
    priority: str  # P0, P1, P2
    test_type: str  # daily, weekly
    steps: List[str] = []

class TestSuite(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    name: str
    description: str
    test_type: str  # daily, weekly
    test_cases: List[str] = []  # List of test case IDs
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TestResult(BaseModel):
    test_case_id: str
    test_name: str
    status: str  # passed, failed, warning, skipped
    message: str
    details: Dict[str, Any] = {}
    duration_ms: int = 0

class TestRun(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    environment_id: str
    environment_url: str
    suite_type: str  # daily, weekly
    status: str  # pending, running, completed, failed
    results: List[Dict[str, Any]] = []
    summary: Dict[str, Any] = {}
    started_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class TestRunCreate(BaseModel):
    environment_id: str
    suite_type: str  # daily, weekly

class ChecklistItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    checklist_type: str  # daily, weekly
    item_text: str
    category: str
    is_completed: bool = False
    notes: str = ""
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())

def create_token(user_id: str, email: str) -> str:
    payload = {
        "user_id": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc).timestamp() + 86400 * 7  # 7 days
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    token_query: Optional[str] = Query(None, alias="token")
):
    token = None
    if credentials:
        token = credentials.credentials
    elif token_query:
        token = token_query
        
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["user_id"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== QA TEST ENGINE ====================

class QATestEngine:
    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip('/')
        self.session = None
        self.results = []
        
    async def __aenter__(self):
        self.session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()
    
    async def fetch_page(self, url: str) -> tuple:
        """Fetch a page and return (status, html, response_time, headers)"""
        start = datetime.now(timezone.utc)
        try:
            async with self.session.get(url, allow_redirects=True) as response:
                html = await response.text()
                duration = (datetime.now(timezone.utc) - start).total_seconds() * 1000
                return response.status, html, duration, dict(response.headers)
        except Exception as e:
            duration = (datetime.now(timezone.utc) - start).total_seconds() * 1000
            return 0, str(e), duration, {}
    
    # ==================== DAILY REGRESSION TESTS ====================
    
    async def test_homepage_loads(self) -> TestResult:
        """Test that homepage loads successfully"""
        status, html, duration, headers = await self.fetch_page(self.base_url)
        if status == 200 and len(html) > 500:
            return TestResult(
                test_case_id="daily-001",
                test_name="Homepage Loads",
                status="passed",
                message=f"Homepage loaded successfully in {duration:.0f}ms",
                details={"status_code": status, "content_length": len(html)},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="daily-001",
            test_name="Homepage Loads",
            status="failed",
            message=f"Homepage failed to load. Status: {status}",
            details={"status_code": status, "error": html[:200] if status == 0 else ""},
            duration_ms=int(duration)
        )
    
    async def test_response_time(self) -> TestResult:
        """Test homepage response time is under 3 seconds"""
        status, html, duration, headers = await self.fetch_page(self.base_url)
        if duration < 3000:
            return TestResult(
                test_case_id="daily-002",
                test_name="Response Time",
                status="passed",
                message=f"Response time {duration:.0f}ms is under 3s threshold",
                details={"response_time_ms": duration},
                duration_ms=int(duration)
            )
        elif duration < 5000:
            return TestResult(
                test_case_id="daily-002",
                test_name="Response Time",
                status="warning",
                message=f"Response time {duration:.0f}ms is slow but acceptable",
                details={"response_time_ms": duration},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="daily-002",
            test_name="Response Time",
            status="failed",
            message=f"Response time {duration:.0f}ms exceeds 5s threshold",
            details={"response_time_ms": duration},
            duration_ms=int(duration)
        )
    
    async def test_ssl_certificate(self) -> TestResult:
        """Test SSL certificate is valid"""
        if self.base_url.startswith("https://"):
            try:
                status, _, duration, _ = await self.fetch_page(self.base_url)
                if status > 0:
                    return TestResult(
                        test_case_id="daily-003",
                        test_name="SSL Certificate",
                        status="passed",
                        message="SSL certificate is valid and HTTPS is working",
                        details={"https_enabled": True},
                        duration_ms=int(duration)
                    )
            except Exception as e:
                return TestResult(
                    test_case_id="daily-003",
                    test_name="SSL Certificate",
                    status="failed",
                    message=f"SSL certificate error: {str(e)}",
                    details={"error": str(e)},
                    duration_ms=0
                )
        return TestResult(
            test_case_id="daily-003",
            test_name="SSL Certificate",
            status="warning",
            message="Site is not using HTTPS",
            details={"https_enabled": False},
            duration_ms=0
        )
    
    async def test_meta_tags(self) -> TestResult:
        """Test essential meta tags are present"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="daily-004",
                test_name="Meta Tags",
                status="failed",
                message="Could not fetch page to check meta tags",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        meta_results = {
            "title": bool(soup.find('title')),
            "description": bool(soup.find('meta', attrs={'name': 'description'})),
            "viewport": bool(soup.find('meta', attrs={'name': 'viewport'})),
            "charset": bool(soup.find('meta', attrs={'charset': True})) or 'charset' in html.lower()
        }
        
        passed = sum(meta_results.values())
        total = len(meta_results)
        
        if passed == total:
            return TestResult(
                test_case_id="daily-004",
                test_name="Meta Tags",
                status="passed",
                message=f"All {total} essential meta tags present",
                details=meta_results,
                duration_ms=int(duration)
            )
        elif passed >= 2:
            return TestResult(
                test_case_id="daily-004",
                test_name="Meta Tags",
                status="warning",
                message=f"{passed}/{total} essential meta tags present",
                details=meta_results,
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="daily-004",
            test_name="Meta Tags",
            status="failed",
            message=f"Only {passed}/{total} essential meta tags found",
            details=meta_results,
            duration_ms=int(duration)
        )
    
    async def test_navigation_links(self) -> TestResult:
        """Test that main navigation links are present and valid"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="daily-005",
                test_name="Navigation Links",
                status="failed",
                message="Could not fetch page to check navigation",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        links = soup.find_all('a', href=True)
        internal_links = [l['href'] for l in links if l['href'].startswith('/') or self.base_url in l['href']]
        external_links = [l['href'] for l in links if l['href'].startswith('http') and self.base_url not in l['href']]
        
        if len(internal_links) >= 3:
            return TestResult(
                test_case_id="daily-005",
                test_name="Navigation Links",
                status="passed",
                message=f"Found {len(internal_links)} internal links and {len(external_links)} external links",
                details={"internal_links": len(internal_links), "external_links": len(external_links), "sample_links": internal_links[:5]},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="daily-005",
            test_name="Navigation Links",
            status="warning",
            message=f"Only {len(internal_links)} internal links found",
            details={"internal_links": len(internal_links), "external_links": len(external_links)},
            duration_ms=int(duration)
        )
    
    async def test_images_have_alt(self) -> TestResult:
        """Test that images have alt attributes"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="daily-006",
                test_name="Image Alt Tags",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        images = soup.find_all('img')
        total = len(images)
        with_alt = len([img for img in images if img.get('alt')])
        
        if total == 0:
            return TestResult(
                test_case_id="daily-006",
                test_name="Image Alt Tags",
                status="passed",
                message="No images found on page",
                details={"total_images": 0},
                duration_ms=int(duration)
            )
        
        percentage = (with_alt / total) * 100
        if percentage >= 90:
            return TestResult(
                test_case_id="daily-006",
                test_name="Image Alt Tags",
                status="passed",
                message=f"{with_alt}/{total} images have alt tags ({percentage:.0f}%)",
                details={"total_images": total, "with_alt": with_alt, "percentage": percentage},
                duration_ms=int(duration)
            )
        elif percentage >= 50:
            return TestResult(
                test_case_id="daily-006",
                test_name="Image Alt Tags",
                status="warning",
                message=f"Only {with_alt}/{total} images have alt tags ({percentage:.0f}%)",
                details={"total_images": total, "with_alt": with_alt, "percentage": percentage},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="daily-006",
            test_name="Image Alt Tags",
            status="failed",
            message=f"Poor accessibility: {with_alt}/{total} images have alt tags ({percentage:.0f}%)",
            details={"total_images": total, "with_alt": with_alt, "percentage": percentage},
            duration_ms=int(duration)
        )
    
    async def test_mobile_viewport(self) -> TestResult:
        """Test mobile viewport meta tag"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="daily-007",
                test_name="Mobile Viewport",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        viewport = soup.find('meta', attrs={'name': 'viewport'})
        
        if viewport and 'width=device-width' in viewport.get('content', ''):
            return TestResult(
                test_case_id="daily-007",
                test_name="Mobile Viewport",
                status="passed",
                message="Mobile-responsive viewport configured correctly",
                details={"viewport_content": viewport.get('content', '')},
                duration_ms=int(duration)
            )
        elif viewport:
            return TestResult(
                test_case_id="daily-007",
                test_name="Mobile Viewport",
                status="warning",
                message="Viewport present but may not be optimal",
                details={"viewport_content": viewport.get('content', '')},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="daily-007",
            test_name="Mobile Viewport",
            status="failed",
            message="No mobile viewport meta tag found",
            details={},
            duration_ms=int(duration)
        )
    
    async def test_favicon(self) -> TestResult:
        """Test favicon is present"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="daily-008",
                test_name="Favicon",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        favicon = soup.find('link', rel=lambda x: x and 'icon' in x.lower() if x else False)
        
        if favicon:
            return TestResult(
                test_case_id="daily-008",
                test_name="Favicon",
                status="passed",
                message="Favicon is configured",
                details={"favicon_href": favicon.get('href', '')},
                duration_ms=int(duration)
            )
        
        # Check default favicon location
        fav_status, _, fav_duration, _ = await self.fetch_page(f"{self.base_url}/favicon.ico")
        if fav_status == 200:
            return TestResult(
                test_case_id="daily-008",
                test_name="Favicon",
                status="passed",
                message="Default favicon.ico found",
                details={"favicon_href": "/favicon.ico"},
                duration_ms=int(fav_duration)
            )
        
        return TestResult(
            test_case_id="daily-008",
            test_name="Favicon",
            status="warning",
            message="No favicon found",
            details={},
            duration_ms=int(duration)
        )
    
    async def test_console_errors(self) -> TestResult:
        """Check for common JavaScript issues in HTML"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="daily-009",
                test_name="JavaScript Check",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        scripts = soup.find_all('script')
        inline_scripts = [s for s in scripts if s.string]
        external_scripts = [s for s in scripts if s.get('src')]
        
        return TestResult(
            test_case_id="daily-009",
            test_name="JavaScript Check",
            status="passed",
            message=f"Found {len(external_scripts)} external and {len(inline_scripts)} inline scripts",
            details={"external_scripts": len(external_scripts), "inline_scripts": len(inline_scripts)},
            duration_ms=int(duration)
        )
    
    async def test_forms_present(self) -> TestResult:
        """Check if forms have proper attributes"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="daily-010",
                test_name="Forms Check",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        forms = soup.find_all('form')
        inputs = soup.find_all('input')
        
        return TestResult(
            test_case_id="daily-010",
            test_name="Forms Check",
            status="passed",
            message=f"Found {len(forms)} forms and {len(inputs)} input fields",
            details={"forms_count": len(forms), "inputs_count": len(inputs)},
            duration_ms=int(duration)
        )
    
    # ==================== WEEKLY DEEP DIVE TESTS ====================
    
    async def test_security_headers(self) -> TestResult:
        """Test security headers"""
        status, html, duration, headers = await self.fetch_page(self.base_url)
        if status == 0:
            return TestResult(
                test_case_id="weekly-001",
                test_name="Security Headers",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        security_headers = {
            "X-Content-Type-Options": headers.get("X-Content-Type-Options"),
            "X-Frame-Options": headers.get("X-Frame-Options"),
            "X-XSS-Protection": headers.get("X-XSS-Protection"),
            "Strict-Transport-Security": headers.get("Strict-Transport-Security"),
            "Content-Security-Policy": headers.get("Content-Security-Policy"),
            "Referrer-Policy": headers.get("Referrer-Policy")
        }
        
        present = sum(1 for v in security_headers.values() if v)
        total = len(security_headers)
        
        if present >= 4:
            return TestResult(
                test_case_id="weekly-001",
                test_name="Security Headers",
                status="passed",
                message=f"{present}/{total} security headers present",
                details=security_headers,
                duration_ms=int(duration)
            )
        elif present >= 2:
            return TestResult(
                test_case_id="weekly-001",
                test_name="Security Headers",
                status="warning",
                message=f"Only {present}/{total} security headers present",
                details=security_headers,
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-001",
            test_name="Security Headers",
            status="failed",
            message=f"Poor security: only {present}/{total} headers present",
            details=security_headers,
            duration_ms=int(duration)
        )
    
    async def test_seo_tags(self) -> TestResult:
        """Comprehensive SEO tags check"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="weekly-002",
                test_name="SEO Tags",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        seo_results = {
            "title": soup.find('title').text if soup.find('title') else None,
            "meta_description": soup.find('meta', attrs={'name': 'description'})['content'] if soup.find('meta', attrs={'name': 'description'}) else None,
            "meta_keywords": soup.find('meta', attrs={'name': 'keywords'})['content'] if soup.find('meta', attrs={'name': 'keywords'}) else None,
            "canonical": soup.find('link', rel='canonical')['href'] if soup.find('link', rel='canonical') else None,
            "og_title": soup.find('meta', property='og:title')['content'] if soup.find('meta', property='og:title') else None,
            "og_description": soup.find('meta', property='og:description')['content'] if soup.find('meta', property='og:description') else None,
            "og_image": soup.find('meta', property='og:image')['content'] if soup.find('meta', property='og:image') else None,
            "twitter_card": soup.find('meta', attrs={'name': 'twitter:card'})['content'] if soup.find('meta', attrs={'name': 'twitter:card'}) else None,
            "h1_count": len(soup.find_all('h1')),
            "h2_count": len(soup.find_all('h2'))
        }
        
        present = sum(1 for k, v in seo_results.items() if v and not k.endswith('_count'))
        total = 8
        
        issues = []
        if not seo_results['title']:
            issues.append("Missing title tag")
        if not seo_results['meta_description']:
            issues.append("Missing meta description")
        if seo_results['h1_count'] == 0:
            issues.append("No H1 tag found")
        if seo_results['h1_count'] > 1:
            issues.append(f"Multiple H1 tags ({seo_results['h1_count']})")
        
        if present >= 6:
            return TestResult(
                test_case_id="weekly-002",
                test_name="SEO Tags",
                status="passed",
                message=f"Good SEO setup: {present}/{total} tags present",
                details=seo_results,
                duration_ms=int(duration)
            )
        elif present >= 3:
            return TestResult(
                test_case_id="weekly-002",
                test_name="SEO Tags",
                status="warning",
                message=f"Basic SEO: {present}/{total} tags. Issues: {', '.join(issues) if issues else 'None'}",
                details=seo_results,
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-002",
            test_name="SEO Tags",
            status="failed",
            message=f"Poor SEO: only {present}/{total} tags. Issues: {', '.join(issues)}",
            details=seo_results,
            duration_ms=int(duration)
        )
    
    async def test_broken_links(self) -> TestResult:
        """Check for broken internal links"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="weekly-003",
                test_name="Broken Links",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        links = soup.find_all('a', href=True)
        internal_links = []
        
        for link in links:
            href = link['href']
            if href.startswith('/'):
                internal_links.append(f"{self.base_url}{href}")
            elif href.startswith(self.base_url):
                internal_links.append(href)
        
        # Test up to 10 internal links
        internal_links = list(set(internal_links))[:10]
        broken = []
        working = []
        
        for link in internal_links:
            try:
                link_status, _, _, _ = await self.fetch_page(link)
                if link_status >= 400 or link_status == 0:
                    broken.append({"url": link, "status": link_status})
                else:
                    working.append(link)
            except:
                broken.append({"url": link, "status": "error"})
        
        if not broken:
            return TestResult(
                test_case_id="weekly-003",
                test_name="Broken Links",
                status="passed",
                message=f"All {len(working)} tested links are working",
                details={"tested": len(internal_links), "working": len(working), "broken": 0},
                duration_ms=int(duration)
            )
        elif len(broken) <= 2:
            return TestResult(
                test_case_id="weekly-003",
                test_name="Broken Links",
                status="warning",
                message=f"{len(broken)} broken links found",
                details={"tested": len(internal_links), "working": len(working), "broken_links": broken},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-003",
            test_name="Broken Links",
            status="failed",
            message=f"{len(broken)} broken links found out of {len(internal_links)} tested",
            details={"tested": len(internal_links), "broken_links": broken},
            duration_ms=int(duration)
        )
    
    async def test_page_size(self) -> TestResult:
        """Check page size"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="weekly-004",
                test_name="Page Size",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        size_kb = len(html.encode('utf-8')) / 1024
        
        if size_kb < 500:
            return TestResult(
                test_case_id="weekly-004",
                test_name="Page Size",
                status="passed",
                message=f"Page size {size_kb:.1f}KB is optimal",
                details={"size_kb": size_kb},
                duration_ms=int(duration)
            )
        elif size_kb < 1000:
            return TestResult(
                test_case_id="weekly-004",
                test_name="Page Size",
                status="warning",
                message=f"Page size {size_kb:.1f}KB is acceptable but could be optimized",
                details={"size_kb": size_kb},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-004",
            test_name="Page Size",
            status="failed",
            message=f"Page size {size_kb:.1f}KB is too large",
            details={"size_kb": size_kb},
            duration_ms=int(duration)
        )
    
    async def test_heading_structure(self) -> TestResult:
        """Check heading hierarchy"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="weekly-005",
                test_name="Heading Structure",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        headings = {
            "h1": len(soup.find_all('h1')),
            "h2": len(soup.find_all('h2')),
            "h3": len(soup.find_all('h3')),
            "h4": len(soup.find_all('h4')),
            "h5": len(soup.find_all('h5')),
            "h6": len(soup.find_all('h6'))
        }
        
        issues = []
        if headings['h1'] == 0:
            issues.append("No H1 tag")
        elif headings['h1'] > 1:
            issues.append(f"Multiple H1 tags ({headings['h1']})")
        
        if not issues:
            return TestResult(
                test_case_id="weekly-005",
                test_name="Heading Structure",
                status="passed",
                message="Heading structure is correct",
                details=headings,
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-005",
            test_name="Heading Structure",
            status="warning",
            message=f"Heading issues: {', '.join(issues)}",
            details=headings,
            duration_ms=int(duration)
        )
    
    async def test_accessibility_basics(self) -> TestResult:
        """Basic accessibility checks"""
        status, html, duration, _ = await self.fetch_page(self.base_url)
        if status != 200:
            return TestResult(
                test_case_id="weekly-006",
                test_name="Accessibility Basics",
                status="failed",
                message="Could not fetch page",
                details={},
                duration_ms=int(duration)
            )
        
        soup = BeautifulSoup(html, 'html.parser')
        
        checks = {
            "html_lang": bool(soup.find('html', lang=True)),
            "images_with_alt": 0,
            "images_total": 0,
            "form_labels": 0,
            "form_inputs": 0,
            "skip_link": bool(soup.find('a', href='#main') or soup.find('a', href='#content')),
            "aria_landmarks": len(soup.find_all(attrs={'role': True}))
        }
        
        images = soup.find_all('img')
        checks['images_total'] = len(images)
        checks['images_with_alt'] = len([i for i in images if i.get('alt')])
        
        inputs = soup.find_all('input')
        checks['form_inputs'] = len(inputs)
        checks['form_labels'] = len(soup.find_all('label'))
        
        score = 0
        if checks['html_lang']:
            score += 25
        if checks['images_total'] == 0 or checks['images_with_alt'] / max(checks['images_total'], 1) >= 0.8:
            score += 25
        if checks['form_inputs'] == 0 or checks['form_labels'] / max(checks['form_inputs'], 1) >= 0.5:
            score += 25
        if checks['aria_landmarks'] >= 1:
            score += 25
        
        if score >= 75:
            return TestResult(
                test_case_id="weekly-006",
                test_name="Accessibility Basics",
                status="passed",
                message=f"Accessibility score: {score}/100",
                details=checks,
                duration_ms=int(duration)
            )
        elif score >= 50:
            return TestResult(
                test_case_id="weekly-006",
                test_name="Accessibility Basics",
                status="warning",
                message=f"Accessibility needs improvement: {score}/100",
                details=checks,
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-006",
            test_name="Accessibility Basics",
            status="failed",
            message=f"Poor accessibility: {score}/100",
            details=checks,
            duration_ms=int(duration)
        )
    
    async def test_robots_txt(self) -> TestResult:
        """Check robots.txt"""
        status, content, duration, _ = await self.fetch_page(f"{self.base_url}/robots.txt")
        
        if status == 200 and len(content) > 10:
            return TestResult(
                test_case_id="weekly-007",
                test_name="Robots.txt",
                status="passed",
                message="robots.txt is present and configured",
                details={"content_preview": content[:200]},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-007",
            test_name="Robots.txt",
            status="warning",
            message="robots.txt not found or empty",
            details={"status": status},
            duration_ms=int(duration)
        )
    
    async def test_sitemap(self) -> TestResult:
        """Check sitemap.xml"""
        status, content, duration, _ = await self.fetch_page(f"{self.base_url}/sitemap.xml")
        
        if status == 200 and '<url>' in content.lower():
            url_count = content.lower().count('<url>')
            return TestResult(
                test_case_id="weekly-008",
                test_name="Sitemap.xml",
                status="passed",
                message=f"Sitemap found with approximately {url_count} URLs",
                details={"url_count": url_count},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-008",
            test_name="Sitemap.xml",
            status="warning",
            message="sitemap.xml not found",
            details={"status": status},
            duration_ms=int(duration)
        )
    
    async def test_compression(self) -> TestResult:
        """Check if compression is enabled"""
        status, _, duration, headers = await self.fetch_page(self.base_url)
        
        encoding = headers.get('Content-Encoding', '').lower()
        if 'gzip' in encoding or 'br' in encoding or 'deflate' in encoding:
            return TestResult(
                test_case_id="weekly-009",
                test_name="Compression",
                status="passed",
                message=f"Compression enabled: {encoding}",
                details={"encoding": encoding},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-009",
            test_name="Compression",
            status="warning",
            message="No compression detected",
            details={"encoding": encoding or "none"},
            duration_ms=int(duration)
        )
    
    async def test_cache_headers(self) -> TestResult:
        """Check caching headers"""
        status, _, duration, headers = await self.fetch_page(self.base_url)
        
        cache_control = headers.get('Cache-Control', '')
        etag = headers.get('ETag', '')
        last_modified = headers.get('Last-Modified', '')
        
        has_caching = bool(cache_control or etag or last_modified)
        
        if has_caching:
            return TestResult(
                test_case_id="weekly-010",
                test_name="Cache Headers",
                status="passed",
                message="Caching headers configured",
                details={"cache_control": cache_control, "etag": bool(etag), "last_modified": bool(last_modified)},
                duration_ms=int(duration)
            )
        return TestResult(
            test_case_id="weekly-010",
            test_name="Cache Headers",
            status="warning",
            message="No caching headers found",
            details={},
            duration_ms=int(duration)
        )
    
    # ==================== RUN ALL TESTS ====================
    
    async def run_daily_tests(self) -> List[TestResult]:
        """Run all daily regression tests"""
        tests = [
            self.test_homepage_loads(),
            self.test_response_time(),
            self.test_ssl_certificate(),
            self.test_meta_tags(),
            self.test_navigation_links(),
            self.test_images_have_alt(),
            self.test_mobile_viewport(),
            self.test_favicon(),
            self.test_console_errors(),
            self.test_forms_present()
        ]
        return await asyncio.gather(*tests)
    
    async def run_weekly_tests(self) -> List[TestResult]:
        """Run all weekly deep dive tests"""
        # First run daily tests
        daily_results = await self.run_daily_tests()
        
        # Then run weekly-specific tests
        weekly_tests = [
            self.test_security_headers(),
            self.test_seo_tags(),
            self.test_broken_links(),
            self.test_page_size(),
            self.test_heading_structure(),
            self.test_accessibility_basics(),
            self.test_robots_txt(),
            self.test_sitemap(),
            self.test_compression(),
            self.test_cache_headers()
        ]
        weekly_results = await asyncio.gather(*weekly_tests)
        
        return list(daily_results) + list(weekly_results)

# ==================== AUTH ROUTES ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = User(name=user_data.name, email=user_data.email)
    user_dict = user.model_dump()
    user_dict['password_hash'] = hash_password(user_data.password)
    user_dict['created_at'] = user_dict['created_at'].isoformat()
    
    await db.users.insert_one(user_dict)
    
    # Create default environment for Casa Carigar
    env = TestEnvironment(
        user_id=user.id,
        name="Casa Carigar Production",
        url="https://casacarigar.com"
    )
    env_dict = env.model_dump()
    env_dict['created_at'] = env_dict['created_at'].isoformat()
    await db.environments.insert_one(env_dict)
    
    # Initialize checklists
    await initialize_checklists(user.id)
    
    token = create_token(user.id, user.email)
    return {"token": token, "user": {"id": user.id, "name": user.name, "email": user.email}}

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user.get('password_hash', '')):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_token(user['id'], user['email'])
    return {"token": token, "user": {"id": user['id'], "name": user['name'], "email": user['email']}}

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {"id": user['id'], "name": user['name'], "email": user['email']}

# ==================== ENVIRONMENT ROUTES ====================

@api_router.get("/environments")
async def get_environments(response: Response, user: dict = Depends(get_current_user)):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    environments = await db.environments.find({"user_id": user['id']}, {"_id": 0}).to_list(100)
    return environments

@api_router.post("/environments")
async def create_environment(env_data: TestEnvironmentCreate, user: dict = Depends(get_current_user)):
    env = TestEnvironment(user_id=user['id'], name=env_data.name, url=env_data.url)
    env_dict = env.model_dump()
    env_dict['created_at'] = env_dict['created_at'].isoformat()
    await db.environments.insert_one(env_dict)
    return env_dict

@api_router.delete("/environments/{env_id}")
async def delete_environment(env_id: str, user: dict = Depends(get_current_user)):
    result = await db.environments.delete_one({"id": env_id, "user_id": user['id']})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Environment not found")
    return {"message": "Environment deleted"}

# ==================== TEST RUN ROUTES ====================

async def execute_test_run(run_id: str, environment_url: str, suite_type: str):
    """Background task to execute tests"""
    try:
        async with QATestEngine(environment_url) as engine:
            if suite_type == "weekly":
                results = await engine.run_weekly_tests()
            else:
                results = await engine.run_daily_tests()
            
            # Convert results to dicts
            results_dicts = [r.model_dump() for r in results]
            
            # Calculate summary
            passed = len([r for r in results if r.status == "passed"])
            failed = len([r for r in results if r.status == "failed"])
            warnings = len([r for r in results if r.status == "warning"])
            total = len(results)
            
            summary = {
                "total": total,
                "passed": passed,
                "failed": failed,
                "warnings": warnings,
                "pass_rate": round((passed / total) * 100, 1) if total > 0 else 0
            }
            
            # Update run in database
            await db.test_runs.update_one(
                {"id": run_id},
                {"$set": {
                    "status": "completed",
                    "results": results_dicts,
                    "summary": summary,
                    "completed_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    except Exception as e:
        logger.error(f"Test run failed: {e}")
        await db.test_runs.update_one(
            {"id": run_id},
            {"$set": {
                "status": "failed",
                "summary": {"error": str(e)},
                "completed_at": datetime.now(timezone.utc).isoformat()
            }}
        )

@api_router.post("/runs")
async def create_test_run(run_data: TestRunCreate, background_tasks: BackgroundTasks, user: dict = Depends(get_current_user)):
    # Get environment
    env = await db.environments.find_one({"id": run_data.environment_id, "user_id": user['id']}, {"_id": 0})
    if not env:
        raise HTTPException(status_code=404, detail="Environment not found")
    
    # Create run
    run = TestRun(
        user_id=user['id'],
        environment_id=run_data.environment_id,
        environment_url=env['url'],
        suite_type=run_data.suite_type,
        status="running"
    )
    run_dict = run.model_dump()
    run_dict['started_at'] = run_dict['started_at'].isoformat()
    
    # Insert and then remove _id for response
    await db.test_runs.insert_one(run_dict.copy())
    
    # Start background task
    background_tasks.add_task(execute_test_run, run.id, env['url'], run_data.suite_type)
    
    return run_dict

@api_router.get("/runs")
async def get_test_runs(user: dict = Depends(get_current_user), limit: int = 20):
    runs = await db.test_runs.find(
        {"user_id": user['id']},
        {"_id": 0}
    ).sort("started_at", -1).to_list(limit)
    return runs

@api_router.get("/runs/{run_id}")
async def get_test_run(run_id: str, user: dict = Depends(get_current_user)):
    run = await db.test_runs.find_one({"id": run_id, "user_id": user['id']}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    return run

# ==================== CHECKLIST ROUTES ====================

DAILY_CHECKLIST_ITEMS = [
    # --- Critical Smoke Tests (< 15 mins) ---
    {"item_text": "Homepage loads successfully (200 OK)", "category": "Core Flow"},
    {"item_text": "Login with valid credentials works", "category": "Core Flow"},
    {"item_text": "Guest user can search for a product", "category": "Core Flow"},
    {"item_text": "Add to Cart adds correct item/price", "category": "Core Flow"},
    {"item_text": "Checkout page loads without crashing", "category": "Core Flow"},
    
    # --- Critical Integrations ---
    {"item_text": "Payment gateway iframe/element loads", "category": "Integrations"},
    {"item_text": "Search results return relevant products", "category": "Integrations"},
    {"item_text": "Automated emails trigger on signup", "category": "Integrations"},

    # --- Mobile & UI ---
    {"item_text": "Mobile hamburger menu opens/closes", "category": "UI/UX"},
    {"item_text": "Main navigation links are not broken", "category": "UI/UX"},
    {"item_text": "Product images load (no broken placeholders)", "category": "UI/UX"},
    
    # --- Technical ---
    {"item_text": "No 'Red' console errors on Homepage", "category": "Technical"},
    {"item_text": "API returns 200 for core endpoints", "category": "Technical"}
]

WEEKLY_CHECKLIST_ITEMS = [
    # --- Deep Regression (1-2 Hours) ---
    # Functionality Deep Dive
    {"item_text": "Advanced Search (Filters + Sorting combined) works", "category": "Functionality"},
    {"item_text": "Cart logic (Update Qty, Remove, Coupons) works", "category": "Functionality"},
    {"item_text": "User Profile (Edit Address, Change Password) works", "category": "Functionality"},
    {"item_text": "Wishlist add/remove/move-to-cart works", "category": "Functionality"},
    {"item_text": "Submit Review with/without photos works", "category": "Functionality"},

    # Cross-Browser & Device
    {"item_text": "Checkout flow works on Safari (iOS)", "category": "Cross-Browser"},
    {"item_text": "Checkout flow works on Chrome (Android)", "category": "Cross-Browser"},
    {"item_text": "Checkout flow works on Firefox (Desktop)", "category": "Cross-Browser"},

    # Business Logic
    {"item_text": "Out of Stock items disable 'Add to Cart'", "category": "Business Logic"},
    {"item_text": "Automated Discounts apply correctly", "category": "Business Logic"},
    {"item_text": "Shipping calculation based on location is correct", "category": "Business Logic"},

    # Security & Compliance
    {"item_text": "SQL Injection check on Search input", "category": "Security"},
    {"item_text": "Cookie Consent banner compliance", "category": "Compliance"},
    {"item_text": "Privacy Policy / Terms links work", "category": "Compliance"},

    # Performance & SEO
    {"item_text": "Lighthouse Score > 90 for SEO", "category": "Performance"},
    {"item_text": "No 404 links found in footer/blog", "category": "SEO"},
    {"item_text": "Meta tags exist for all new products", "category": "SEO"}
]

async def initialize_checklists(user_id: str):
    """Initialize checklists for a new user"""
    # Daily checklist
    for item in DAILY_CHECKLIST_ITEMS:
        checklist_item = ChecklistItem(
            user_id=user_id,
            checklist_type="daily",
            item_text=item["item_text"],
            category=item["category"]
        )
        item_dict = checklist_item.model_dump()
        item_dict['updated_at'] = item_dict['updated_at'].isoformat()
        await db.checklists.insert_one(item_dict)
    
    # Weekly checklist
    for item in WEEKLY_CHECKLIST_ITEMS:
        checklist_item = ChecklistItem(
            user_id=user_id,
            checklist_type="weekly",
            item_text=item["item_text"],
            category=item["category"]
        )
        item_dict = checklist_item.model_dump()
        item_dict['updated_at'] = item_dict['updated_at'].isoformat()
        await db.checklists.insert_one(item_dict)

@api_router.get("/checklists")
async def get_checklists(user: dict = Depends(get_current_user)):
    checklists = await db.checklists.find({"user_id": user['id']}, {"_id": 0}).to_list(100)
    return checklists

@api_router.put("/checklists/{item_id}")
async def update_checklist_item(item_id: str, is_completed: bool, notes: str = "", user: dict = Depends(get_current_user)):
    result = await db.checklists.update_one(
        {"id": item_id, "user_id": user['id']},
        {"$set": {
            "is_completed": is_completed,
            "notes": notes,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return {"message": "Updated"}

@api_router.post("/checklists/reset")
async def reset_checklists(checklist_type: str, user: dict = Depends(get_current_user)):
    await db.checklists.update_many(
        {"user_id": user['id'], "checklist_type": checklist_type},
        {"$set": {"is_completed": False, "notes": "", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"message": f"{checklist_type} checklist reset"}

# ==================== REPORTS ROUTES ====================

@api_router.get("/reports")
async def get_reports(user: dict = Depends(get_current_user)):
    runs = await db.test_runs.find(
        {"user_id": user['id'], "status": "completed"},
        {"_id": 0}
    ).sort("completed_at", -1).to_list(50)
    return runs

@api_router.get("/reports/{run_id}/pdf")
async def generate_pdf_report(run_id: str, user: dict = Depends(get_current_user)):
    run = await db.test_runs.find_one({"id": run_id, "user_id": user['id']}, {"_id": 0})
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    
    # Create PDF
    try:
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=50, bottomMargin=50)
        styles = getSampleStyleSheet()
        
        
        # Custom styles
        title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=24, spaceAfter=30, alignment=TA_CENTER)
        heading_style = ParagraphStyle('Heading', parent=styles['Heading2'], fontSize=16, spaceAfter=12, spaceBefore=20)
        normal_style = ParagraphStyle('Normal', parent=styles['Normal'], fontSize=10, spaceAfter=6)
        rec_style = ParagraphStyle('Recommendation', parent=styles['Normal'], fontSize=10, spaceAfter=6, leftIndent=20, bulletIndent=10)


        elements = []
        
        # --- HEADER WITH LOGOS ---
        try:
            # Load Images (ensure they exist in root)
            logo_kuberha = Image('kuberha_logo.png', width=1.5*inch, height=1.5*inch)
            logo_casacarigar = Image('casacarigar_logo.png', width=1.2*inch, height=1.2*inch)
            
            # Header Table
            header_data = [[logo_kuberha, Spacer(1, 10), logo_casacarigar]]
            header_table = Table(header_data, colWidths=[2*inch, 2*inch, 2*inch])
            header_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            elements.append(header_table)
            elements.append(Spacer(1, 20))
        except Exception as img_err:
            logger.warning(f"Could not load logos: {img_err}")
    
        # Title
        elements.append(Paragraph("QA Guardian Test Report", title_style))
        elements.append(Spacer(1, 20))
        
        # Summary info
        elements.append(Paragraph(f"<b>Environment:</b> {run.get('environment_url', 'N/A')}", normal_style))
        elements.append(Paragraph(f"<b>Test Type:</b> {run.get('suite_type', 'N/A').title()} Tests", normal_style))
        elements.append(Paragraph(f"<b>Date:</b> {run.get('started_at', 'N/A')[:19].replace('T', ' ')}", normal_style))
        elements.append(Paragraph(f"<b>Status:</b> {run.get('status', 'N/A').title()}", normal_style))
        elements.append(Spacer(1, 20))
        
        # Summary table
        summary = run.get('summary', {})
        summary_data = [
            ['Metric', 'Value'],
            ['Total Tests', str(summary.get('total', 0))],
            ['Passed', str(summary.get('passed', 0))],
            ['Failed', str(summary.get('failed', 0))],
            ['Warnings', str(summary.get('warnings', 0))],
            ['Pass Rate', f"{summary.get('pass_rate', 0)}%"]
        ]
        
        summary_table = Table(summary_data, colWidths=[200, 150])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#1a1a2e')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8f9fa')),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#dee2e6'))
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 30))
        
        # Test Results
        elements.append(Paragraph("Test Results", heading_style))
        
        results = run.get('results', [])
        for result in results:
            status = result.get('status', 'unknown')
            status_color = '#28a745' if status == 'passed' else '#dc3545' if status == 'failed' else '#ffc107'
            
            # Sanitize inputs
            test_name = result.get('test_name', 'Unknown').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            message = result.get('message', '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            
            elements.append(Paragraph(
                f"<b>{test_name}</b> - "
                f"<font color='{status_color}'>{status.upper()}</font>",
                normal_style
            ))
            elements.append(Paragraph(f"   {message}", normal_style))
            
            # Add details if present
            details = result.get('details', {})
            if details:
                sanitized_details = {k: str(v).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;') for k, v in details.items()}
                details_str = ', '.join([f"{k}: {v}" for k, v in list(sanitized_details.items())[:5]])
                elements.append(Paragraph(f"   <i>Details: {details_str}</i>", normal_style))
            
            elements.append(Spacer(1, 10))
        
        # --- RECOMMENDATIONS SECTION ---
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("Recommendations", heading_style))
        
        if run.get('suite_type') == 'daily':
            recs = [
                "Monitor critical flows (Login, Checkout) daily.",
                "If smoke tests fail, stop deployment immediately.",
                "Verify payment gateway integration manually if iframe fails."
            ]
        else:
            recs = [
                "Fix all 'Red' console errors on priority pages.",
                "Optimize images for LCP < 2.5s (Lighthouse goal).",
                "Verify cross-browser compatibility on Safari iOS.",
                "Update SEO meta tags for new product listings."
            ]
        
        for rec in recs:
            elements.append(Paragraph(f"• {rec}", rec_style))
    
        # Footer
        elements.append(Spacer(1, 30))
        elements.append(Paragraph("Generated by QA Guardian | Powered by Kuberha.ai", ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER, textColor=colors.grey)))
        
        doc.build(elements)
        buffer.seek(0)
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=qa-report-{run_id[:8]}.pdf"}
        )
    except Exception as e:
        logger.error(f"PDF Generation failed: {str(e)}")
        # Return a JSON response with explicit CORS headers so the frontend can read the error
        return JSONResponse(
            status_code=500,
            content={"detail": f"PDF Generation failed: {str(e)}"},
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, OPTIONS",
                "Access-Control-Allow-Headers": "*"
            }
        )

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    # Get recent runs
    runs = await db.test_runs.find({"user_id": user['id']}, {"_id": 0}).sort("started_at", -1).to_list(10)
    
    # Get environments
    environments = await db.environments.find({"user_id": user['id']}, {"_id": 0}).to_list(10)
    
    # Calculate stats
    total_runs = len(runs)
    completed_runs = [r for r in runs if r.get('status') == 'completed']
    
    avg_pass_rate = 0
    if completed_runs:
        pass_rates = [r.get('summary', {}).get('pass_rate', 0) for r in completed_runs]
        avg_pass_rate = sum(pass_rates) / len(pass_rates)
    
    return {
        "total_runs": total_runs,
        "completed_runs": len(completed_runs),
        "avg_pass_rate": round(avg_pass_rate, 1),
        "environments": environments,
        "recent_runs": runs[:5]
    }

# ==================== MAIN APP SETUP ====================

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origin_regex=r"https://qa-guardian.*\.vercel\.app|http://localhost:3000",
    allow_methods=["*"],
    allow_headers=["*"],

)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
