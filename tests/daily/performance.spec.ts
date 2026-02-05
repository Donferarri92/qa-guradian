import { test, expect } from '@playwright/test';

test.describe('Performance & Reliability', () => {

    test('page load within threshold', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/', { waitUntil: 'domcontentloaded' });

        const loadTime = Date.now() - startTime;

        // Page should load within 5 seconds (DOM content)
        expect(loadTime).toBeLessThan(5000);

        // Wait for network idle
        await page.waitForLoadState('networkidle');

        const fullLoadTime = Date.now() - startTime;

        // Full page should load within 10 seconds
        expect(fullLoadTime).toBeLessThan(10000);
    });

    test('no critical console errors', async ({ page }) => {
        const errors: string[] = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                const text = msg.text();
                // Filter out common non-critical errors
                if (
                    !text.includes('favicon') &&
                    !text.includes('Failed to load resource: net::ERR_BLOCKED_BY_CLIENT') &&
                    !text.includes('analytics') &&
                    !text.includes('gtm') &&
                    !text.includes('facebook') &&
                    !text.includes('hotjar')
                ) {
                    errors.push(text);
                }
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Navigate to a few key pages
        const pages = ['/collections/all', '/cart'];
        for (const url of pages) {
            await page.goto(url).catch(() => { });
            await page.waitForTimeout(1000);
        }

        // Filter critical errors
        const criticalErrors = errors.filter(e =>
            e.includes('TypeError') ||
            e.includes('ReferenceError') ||
            e.includes('SyntaxError') ||
            e.includes('Uncaught')
        );

        expect(criticalErrors).toHaveLength(0);
    });

    test('no failed network requests for assets', async ({ page }) => {
        const failedRequests: string[] = [];

        page.on('response', response => {
            const status = response.status();
            const url = response.url();

            // Check for 4xx/5xx errors on important resources
            if (status >= 400) {
                const isAsset = url.match(/\.(js|css|png|jpg|jpeg|gif|svg|webp|woff|woff2)$/i);
                const isApi = url.includes('/api/') || url.includes('graphql');

                if (isAsset || isApi) {
                    failedRequests.push(`${status}: ${url}`);
                }
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Allow some failures (third-party, etc) but not many
        expect(failedRequests.length).toBeLessThan(5);
    });

    test('images load properly', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const images = page.locator('img');
        const imageCount = await images.count();

        let brokenCount = 0;
        const brokenImages: string[] = [];

        for (let i = 0; i < Math.min(imageCount, 20); i++) {
            const img = images.nth(i);
            const isVisible = await img.isVisible();

            if (isVisible) {
                const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
                const src = await img.getAttribute('src');

                if (naturalWidth === 0 && src && !src.includes('data:')) {
                    brokenCount++;
                    brokenImages.push(src);
                }
            }
        }

        // No broken images allowed
        expect(brokenCount).toBe(0);
    });

    test('site is responsive', async ({ page }) => {
        // Test desktop
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.goto('/');
        await expect(page.locator('body')).toBeVisible();

        // Test tablet
        await page.setViewportSize({ width: 768, height: 1024 });
        await page.waitForTimeout(500);
        await expect(page.locator('body')).toBeVisible();

        // Test mobile
        await page.setViewportSize({ width: 375, height: 667 });
        await page.waitForTimeout(500);
        await expect(page.locator('body')).toBeVisible();

        // Content should still be accessible
        const content = await page.content();
        expect(content.length).toBeGreaterThan(1000);
    });

    test('basic availability check', async ({ page }) => {
        const response = await page.goto('/');

        // Site should be up
        expect(response).not.toBeNull();
        expect(response?.status()).toBeLessThan(500);
    });
});
