# QA Guardian - Product Requirements Document

## Overview
QA Guardian is an automated QA testing platform designed for e-commerce websites. It runs daily regression tests and weekly deep-dive analyses to catch issues before customers do.

## Target Website
- **Primary Target**: https://casacarigar.com (Casa Carigar - Indian Craft E-commerce)

## Core Features Implemented

### 1. Authentication System
- User registration and login
- JWT-based authentication
- Secure password hashing with bcrypt

### 2. Test Environments
- Add/remove test environments (URLs to test)
- Default environment: Casa Carigar Production

### 3. Automated Testing Suites

#### Daily Regression Tests (10 tests)
| Test | Description | Priority |
|------|-------------|----------|
| Homepage Loads | Verify homepage returns 200 status | P0 |
| Response Time | Check page loads under 3 seconds | P0 |
| SSL Certificate | Verify HTTPS is working | P0 |
| Meta Tags | Check title, description, viewport, charset | P1 |
| Navigation Links | Verify internal links are present | P1 |
| Image Alt Tags | Check accessibility of images | P1 |
| Mobile Viewport | Verify responsive design meta tag | P1 |
| Favicon | Check favicon exists | P2 |
| JavaScript Check | Count scripts on page | P2 |
| Forms Check | Verify forms and inputs | P2 |

#### Weekly Deep Dive Tests (10 additional tests)
| Test | Description | Priority |
|------|-------------|----------|
| Security Headers | Check X-Content-Type-Options, X-Frame-Options, etc. | P0 |
| SEO Tags | Comprehensive SEO audit (OG tags, H1 structure) | P0 |
| Broken Links | Test all internal links | P0 |
| Page Size | Verify page is under 500KB | P1 |
| Heading Structure | Check H1/H2/H3 hierarchy | P1 |
| Accessibility Basics | HTML lang, ARIA landmarks, labels | P1 |
| Robots.txt | Verify robots.txt exists | P2 |
| Sitemap.xml | Check sitemap is present | P2 |
| Compression | Verify gzip/br compression | P2 |
| Cache Headers | Check caching configuration | P2 |

### 4. Manual Checklists

#### Daily Checklist (14 items)
- Homepage loads without errors
- All main navigation links work
- Product images load correctly
- Add to cart functionality works
- Cart displays correct items and prices
- Checkout process initiates correctly
- Search functionality returns results
- Mobile menu opens and closes
- Contact forms are accessible
- Footer links are functional
- No console errors on page load
- Page load time is acceptable (<3s)
- SSL certificate is valid
- Cookie consent appears if required

#### Weekly Checklist (16 items)
- Run Lighthouse performance audit
- Check Core Web Vitals scores
- Verify all product pages load
- Test complete checkout flow
- Verify payment gateway connection
- Check SEO meta tags on all pages
- Verify sitemap.xml is updated
- Check robots.txt configuration
- Test all form submissions
- Verify email notifications work
- Check security headers
- Test on Chrome, Firefox, Safari
- Test on mobile devices
- Check image optimization
- Verify 404 page works
- Test accessibility with screen reader

### 5. PDF Report Generation
- Comprehensive test reports in PDF format
- Summary of passed/failed/warning tests
- Detailed test results with timing
- Downloadable from Reports page

## Tech Stack
- **Backend**: FastAPI (Python)
- **Frontend**: React.js with Tailwind CSS
- **Database**: MongoDB
- **Testing Engine**: aiohttp + BeautifulSoup

## API Endpoints
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/register | Create new user |
| POST | /api/auth/login | Login user |
| GET | /api/auth/me | Get current user |
| GET | /api/environments | List environments |
| POST | /api/environments | Add environment |
| DELETE | /api/environments/{id} | Remove environment |
| POST | /api/runs | Start test run |
| GET | /api/runs | List all runs |
| GET | /api/runs/{id} | Get run details |
| GET | /api/checklists | Get checklists |
| PUT | /api/checklists/{id} | Update checklist item |
| POST | /api/checklists/reset | Reset checklist |
| GET | /api/reports | List completed reports |
| GET | /api/reports/{id}/pdf | Download PDF report |
| GET | /api/dashboard/stats | Get dashboard statistics |

## What's Been Implemented (Feb 5, 2026)
- ✅ Complete authentication system
- ✅ Dashboard with stats and quick actions
- ✅ Daily regression test suite (10 tests)
- ✅ Weekly deep dive test suite (20 tests)
- ✅ Manual checklists with categories
- ✅ Test runs with real-time status updates
- ✅ PDF report generation
- ✅ Environment management
- ✅ Modern dark theme UI

## Test Results Summary (casacarigar.com)
- **Pass Rate**: 60%
- **Passed**: 6 tests
- **Failed**: 2 tests
- **Warnings**: 2 tests

### Key Findings
- Homepage loads in ~800ms (Good)
- SSL certificate valid (Good)
- Missing keywords meta tag (Warning)
- No internal navigation links detected (Warning - likely JS-rendered)
- Security headers partially configured

## Future Enhancements (Backlog)
- P1: Email/Slack notifications for failed tests
- P1: Scheduled automated test runs
- P2: Cross-browser testing integration
- P2: Screenshot comparison testing
- P2: Team collaboration features
- P3: Custom test case creation
- P3: Integration with CI/CD pipelines

## User Personas
1. **QA Engineer**: Runs daily/weekly tests, reviews reports
2. **Team Lead**: Views dashboard stats, monitors quality trends
3. **Developer**: Checks specific test failures, fixes issues
