import { PrismaClient, Role, TestSuiteType, TestCaseType, Severity } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Seeding database...');

    // Create admin user
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
        where: { email: 'admin@qa-guardian.com' },
        update: {},
        create: {
            email: 'admin@qa-guardian.com',
            passwordHash: adminPasswordHash,
            role: Role.ADMIN,
            name: 'Admin User',
        },
    });
    console.log('✓ Created admin user:', admin.email);

    // Create production environment
    const prodEnv = await prisma.environment.upsert({
        where: { id: 'prod-env' },
        update: {},
        create: {
            id: 'prod-env',
            name: 'Production',
            baseUrl: 'https://casacarigar.com',
            isProduction: true,
        },
    });
    console.log('✓ Created environment:', prodEnv.name);

    // Create Daily Regression Suite
    const dailySuite = await prisma.testSuite.upsert({
        where: { id: 'daily-regression' },
        update: {},
        create: {
            id: 'daily-regression',
            name: 'Daily Regression',
            description: 'Critical journey tests run daily to ensure core functionality',
            type: TestSuiteType.DAILY,
            schedule: '0 7 * * *', // 7 AM daily
            enabled: true,
        },
    });
    console.log('✓ Created suite:', dailySuite.name);

    // Daily test cases
    const dailyTests = [
        { name: 'Home Page Loads', file: 'daily/home.spec.ts', test: 'home page loads correctly', severity: Severity.P0 },
        { name: 'Header Navigation', file: 'daily/home.spec.ts', test: 'header navigation works', severity: Severity.P0 },
        { name: 'Footer Links', file: 'daily/home.spec.ts', test: 'footer links are valid', severity: Severity.P1 },
        { name: 'Collection Page Loads', file: 'daily/plp.spec.ts', test: 'collection page loads', severity: Severity.P0 },
        { name: 'Product Cards Display', file: 'daily/plp.spec.ts', test: 'product cards show required info', severity: Severity.P0 },
        { name: 'Sort and Filters', file: 'daily/plp.spec.ts', test: 'sort and filters work', severity: Severity.P1 },
        { name: 'Product Detail Page Loads', file: 'daily/pdp.spec.ts', test: 'product detail page loads', severity: Severity.P0 },
        { name: 'Image Gallery', file: 'daily/pdp.spec.ts', test: 'image gallery works', severity: Severity.P0 },
        { name: 'Add to Cart', file: 'daily/pdp.spec.ts', test: 'add to cart works', severity: Severity.P0 },
        { name: 'Cart Page Loads', file: 'daily/cart.spec.ts', test: 'cart page loads', severity: Severity.P0 },
        { name: 'Cart Quantity Update', file: 'daily/cart.spec.ts', test: 'quantity update works', severity: Severity.P1 },
        { name: 'Cart Remove Item', file: 'daily/cart.spec.ts', test: 'remove item works', severity: Severity.P1 },
        { name: 'Checkout Form', file: 'daily/checkout.spec.ts', test: 'checkout form validation', severity: Severity.P0 },
        { name: 'Payment Step Reachable', file: 'daily/checkout.spec.ts', test: 'payment step reachable', severity: Severity.P0 },
        { name: 'Search Functionality', file: 'daily/search.spec.ts', test: 'search returns results', severity: Severity.P0 },
        { name: 'No Console Errors', file: 'daily/performance.spec.ts', test: 'no critical console errors', severity: Severity.P1 },
        { name: 'Page Load Performance', file: 'daily/performance.spec.ts', test: 'page load within threshold', severity: Severity.P1 },
    ];

    for (let i = 0; i < dailyTests.length; i++) {
        const test = dailyTests[i];
        await prisma.testCase.upsert({
            where: { id: `daily-test-${i + 1}` },
            update: {},
            create: {
                id: `daily-test-${i + 1}`,
                suiteId: dailySuite.id,
                name: test.name,
                type: TestCaseType.AUTOMATED,
                severity: test.severity,
                playwrightFile: test.file,
                playwrightTest: test.test,
                order: i,
            },
        });
    }
    console.log(`✓ Created ${dailyTests.length} daily test cases`);

    // Create Weekly Deep Dive Suite
    const weeklySuite = await prisma.testSuite.upsert({
        where: { id: 'weekly-deep-dive' },
        update: {},
        create: {
            id: 'weekly-deep-dive',
            name: 'Weekly Deep Dive',
            description: 'Comprehensive tests including performance, security, SEO, and image quality',
            type: TestSuiteType.WEEKLY,
            schedule: '0 10 * * 0', // 10 AM Sunday
            enabled: true,
        },
    });
    console.log('✓ Created suite:', weeklySuite.name);

    // Weekly test cases
    const weeklyTests = [
        { name: 'Lighthouse Performance', file: 'weekly/lighthouse.spec.ts', test: 'lighthouse performance audit', severity: Severity.P0 },
        { name: 'Core Web Vitals', file: 'weekly/lighthouse.spec.ts', test: 'core web vitals meet thresholds', severity: Severity.P0 },
        { name: 'Security Headers', file: 'weekly/security.spec.ts', test: 'security headers present', severity: Severity.P0 },
        { name: 'TLS Configuration', file: 'weekly/security.spec.ts', test: 'TLS configuration valid', severity: Severity.P1 },
        { name: 'SEO Meta Tags', file: 'weekly/seo.spec.ts', test: 'SEO meta tags present', severity: Severity.P1 },
        { name: 'Sitemap Accessible', file: 'weekly/seo.spec.ts', test: 'sitemap accessible', severity: Severity.P1 },
        { name: 'Robots.txt Valid', file: 'weekly/seo.spec.ts', test: 'robots.txt valid', severity: Severity.P2 },
        { name: 'Structured Data', file: 'weekly/seo.spec.ts', test: 'structured data present', severity: Severity.P2 },
        { name: 'Analytics Events', file: 'weekly/analytics.spec.ts', test: 'analytics events firing', severity: Severity.P1 },
        { name: 'Image Quality Report', file: 'weekly/images.spec.ts', test: 'image quality analysis', severity: Severity.P0 },
        { name: 'Missing Images Check', file: 'weekly/images.spec.ts', test: 'no missing images', severity: Severity.P0 },
        { name: 'High Quantity Cart', file: 'weekly/resilience.spec.ts', test: 'high quantity handling', severity: Severity.P1 },
        { name: 'Slow Network Checkout', file: 'weekly/resilience.spec.ts', test: 'slow network checkout', severity: Severity.P1 },
        { name: 'Error Pages', file: 'weekly/resilience.spec.ts', test: 'error pages graceful', severity: Severity.P2 },
        { name: 'Chrome Desktop', file: 'weekly/cross-browser.spec.ts', test: 'chrome desktop smoke', severity: Severity.P0 },
        { name: 'Firefox Desktop', file: 'weekly/cross-browser.spec.ts', test: 'firefox desktop smoke', severity: Severity.P1 },
        { name: 'Mobile Chrome', file: 'weekly/cross-browser.spec.ts', test: 'mobile chrome smoke', severity: Severity.P0 },
        { name: 'Mobile Safari', file: 'weekly/cross-browser.spec.ts', test: 'mobile safari smoke', severity: Severity.P1 },
    ];

    for (let i = 0; i < weeklyTests.length; i++) {
        const test = weeklyTests[i];
        await prisma.testCase.upsert({
            where: { id: `weekly-test-${i + 1}` },
            update: {},
            create: {
                id: `weekly-test-${i + 1}`,
                suiteId: weeklySuite.id,
                name: test.name,
                type: TestCaseType.AUTOMATED,
                severity: test.severity,
                playwrightFile: test.file,
                playwrightTest: test.test,
                order: i,
            },
        });
    }
    console.log(`✓ Created ${weeklyTests.length} weekly test cases`);

    // Create default checklists
    const dailyChecklist = await prisma.checklist.upsert({
        where: { id: 'daily-checklist' },
        update: {},
        create: {
            id: 'daily-checklist',
            name: 'Daily Regression Checklist',
            description: 'Manual verification checklist for daily regression',
            type: TestSuiteType.DAILY,
            isDefault: true,
        },
    });

    const dailyChecklistItems = [
        'Home page loads without blank screens',
        'Header navigation links functional',
        'Footer links (no broken links)',
        'Collection/category pages load',
        'Product cards display: image, name, price',
        'Sort and filters work',
        'PDP image gallery loads',
        'Price visible and consistent',
        'Add to cart functional',
        'Cart page loads, qty update works',
        'Checkout form validation passes',
        'Payment step reachable',
        'Search returns results',
        'No critical console errors',
    ];

    for (let i = 0; i < dailyChecklistItems.length; i++) {
        await prisma.checklistItem.upsert({
            where: { id: `daily-item-${i + 1}` },
            update: {},
            create: {
                id: `daily-item-${i + 1}`,
                checklistId: dailyChecklist.id,
                text: dailyChecklistItems[i],
                order: i,
            },
        });
    }
    console.log(`✓ Created daily checklist with ${dailyChecklistItems.length} items`);

    const weeklyChecklist = await prisma.checklist.upsert({
        where: { id: 'weekly-checklist' },
        update: {},
        create: {
            id: 'weekly-checklist',
            name: 'Weekly Deep Dive Checklist',
            description: 'Manual verification checklist for weekly deep dive',
            type: TestSuiteType.WEEKLY,
            isDefault: true,
        },
    });

    const weeklyChecklistItems = [
        'Lighthouse score ≥ 50 (mobile)',
        'LCP < 4s, CLS < 0.25, INP < 500ms',
        'All security headers present',
        'No mixed content warnings',
        'SEO meta tags on all pages',
        'Sitemap accessible',
        'Analytics events firing correctly',
        'Image quality report generated',
        'Cross-browser tests pass',
        'Error pages graceful',
    ];

    for (let i = 0; i < weeklyChecklistItems.length; i++) {
        await prisma.checklistItem.upsert({
            where: { id: `weekly-item-${i + 1}` },
            update: {},
            create: {
                id: `weekly-item-${i + 1}`,
                checklistId: weeklyChecklist.id,
                text: weeklyChecklistItems[i],
                order: i,
            },
        });
    }
    console.log(`✓ Created weekly checklist with ${weeklyChecklistItems.length} items`);

    console.log('✅ Seeding completed!');
}

main()
    .catch((e) => {
        console.error('❌ Seeding error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
