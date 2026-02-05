# QA Guardian

Automated QA Testing Platform for E-commerce Websites

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis
- Docker (optional, for containerized deployment)

### Local Development

```bash
# Clone and install dependencies
cd qa-guardian
npm install

# Set up environment variables
cp backend/.env.example backend/.env
# Edit backend/.env with your database and Redis URLs

# Set up database
cd backend
npx prisma migrate deploy
npx prisma db seed
cd ..

# Start all services
npm run dev
```

This starts:
- Backend API on http://localhost:3001
- Frontend on http://localhost:3000

### Default Login
After seeding, you can login with:
- Email: `admin@qabot.local`
- Password: `admin123`

## Project Structure

```
qa-guardian/
├── backend/          # Node.js/Express API
│   ├── src/          # Application code
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic
│   │   └── middleware/
│   └── prisma/       # Database schema & migrations
├── frontend/         # Next.js dashboard
│   └── src/
│       ├── app/      # App router pages
│       ├── components/
│       └── lib/
├── tests/            # Playwright test suites
│   ├── daily/        # Daily regression tests
│   └── weekly/       # Weekly deep dive tests
└── infra/            # Deployment configuration
    ├── Dockerfile
    ├── docker-compose.yml
    └── fly.toml
```

## Features

### Daily Regression Testing
Runs every morning to catch critical issues:
- Home page functionality
- Product Listing Pages (PLP)
- Product Detail Pages (PDP)
- Cart operations
- Checkout flow
- Search functionality
- Basic performance checks

### Weekly Deep Dive Testing
Comprehensive weekly analysis:
- Lighthouse/Core Web Vitals
- Security header validation
- SEO & indexability checks
- Image quality analysis
- Cross-browser compatibility
- Resilience & edge cases

### Dashboard
- Real-time test run monitoring
- Historical trends & comparisons
- PDF/JSON report generation
- Manual checklist management
- Environment configuration

## Deployment

### Fly.io (Recommended)

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login and deploy
fly auth login
fly launch --config infra/fly.toml
fly secrets set DATABASE_URL="..."
fly secrets set REDIS_URL="..."
fly secrets set JWT_SECRET="..."
fly deploy
```

### Docker

```bash
docker-compose -f infra/docker-compose.yml up -d
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `POST /api/auth/login` | User login |
| `GET /api/runs` | List test runs |
| `POST /api/runs` | Create new test run |
| `GET /api/suites` | List test suites |
| `GET /api/reports` | List generated reports |
| `GET /api/checklists` | List manual checklists |

## Configuration

### Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/qabot

# Redis (for job queue)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# Email alerts (optional)
SMTP_HOST=smtp.example.com
SMTP_USER=user
SMTP_PASS=pass
ALERT_EMAIL=qa@example.com

# S3 for screenshots (optional)
S3_BUCKET=qa-screenshots
S3_REGION=us-east-1
```

## Running Tests Against Your Site

1. Go to **Settings** → Add your environment (staging/production URL)
2. Navigate to **Dashboard** → Click "Run Daily Regression"
3. View results in real-time on the **Runs** page
4. Generate and share reports from the **Reports** page

## License

MIT
