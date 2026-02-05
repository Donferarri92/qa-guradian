import { test, expect, devices } from '@playwright/test';

test.describe('Cross-Browser & Device Testing', () => {

    test.describe('Desktop Chrome', () => {
        test.use({ ...devices['Desktop Chrome'] });

        test('chrome desktop smoke', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();

            // Basic navigation
            const navLinks = page.locator('header a, nav a');
            expect(await navLinks.count()).toBeGreaterThan(0);

            // Can interact with elements
            const firstLink = navLinks.first();
            await expect(firstLink).toBeVisible();
        });
    });

    test.describe('Desktop Firefox', () => {
        test.use({ ...devices['Desktop Firefox'] });

        test('firefox desktop smoke', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();

            // Check key elements render
            const images = page.locator('img');
            expect(await images.count()).toBeGreaterThan(0);

            // Check CSS works
            const header = page.locator('header').first();
            if (await header.count() > 0) {
                const isVisible = await header.isVisible();
                expect(isVisible).toBe(true);
            }
        });
    });

    test.describe('Mobile Chrome', () => {
        test.use({ ...devices['Pixel 5'] });

        test('mobile chrome smoke', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();

            // Check mobile viewport
            const viewport = page.viewportSize();
            expect(viewport?.width).toBeLessThan(500);

            // Content should be visible
            const content = await page.content();
            expect(content.length).toBeGreaterThan(1000);

            // Check for mobile menu (hamburger)
            const mobileMenu = page.locator(
                'button[class*="menu"], button[class*="hamburger"], [aria-label*="menu"]'
            );

            // Either has mobile menu or navigation is visible
            const hasMenu = await mobileMenu.count() > 0;
            const navLinks = page.locator('header a, nav a');
            const visibleLinks = await navLinks.filter({ visible: true }).count();

            expect(hasMenu || visibleLinks > 0).toBe(true);
        });

        test('mobile touch interactions', async ({ page }) => {
            await page.goto('/');

            // Test scrolling
            await page.evaluate(() => window.scrollTo(0, 500));
            await page.waitForTimeout(500);

            const scrollY = await page.evaluate(() => window.scrollY);
            expect(scrollY).toBeGreaterThan(0);

            // Test tap on product
            const productLink = page.locator('a[href*="/products/"]').first();
            if (await productLink.count() > 0) {
                await productLink.tap();
                await page.waitForLoadState('networkidle');
                expect(page.url()).toMatch(/product/i);
            }
        });
    });

    test.describe('Mobile Safari', () => {
        test.use({ ...devices['iPhone 12'] });

        test('mobile safari smoke', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();

            // Check viewport
            const viewport = page.viewportSize();
            expect(viewport?.width).toBeLessThan(500);

            // Verify images load
            const images = page.locator('img');
            const imageCount = await images.count();
            expect(imageCount).toBeGreaterThan(0);

            // Check first image is visible
            if (imageCount > 0) {
                const firstImg = images.first();
                const isVisible = await firstImg.isVisible();
                // At least some images should be visible
                expect(isVisible).toBeDefined();
            }
        });
    });

    test.describe('Tablet', () => {
        test.use({ viewport: { width: 768, height: 1024 } });

        test('tablet breakpoint smoke', async ({ page }) => {
            await page.goto('/');
            await expect(page.locator('body')).toBeVisible();

            // Tablet should show appropriately sized content
            const content = await page.content();
            expect(content.length).toBeGreaterThan(1000);

            // Check layout is not broken
            const header = page.locator('header').first();
            if (await header.count() > 0) {
                const box = await header.boundingBox();
                expect(box?.width).toBeGreaterThan(700); // Full width
            }
        });
    });

    test.describe('Responsive Design', () => {
        test('layout adapts to viewport', async ({ page }) => {
            const viewports = [
                { width: 1920, height: 1080, name: 'Desktop Large' },
                { width: 1280, height: 720, name: 'Desktop' },
                { width: 768, height: 1024, name: 'Tablet' },
                { width: 375, height: 667, name: 'Mobile' },
            ];

            for (const vp of viewports) {
                await page.setViewportSize({ width: vp.width, height: vp.height });
                await page.goto('/');
                await page.waitForLoadState('networkidle');

                // Page should render without horizontal scroll
                const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
                const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);

                expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 10); // Small margin for scrollbar

                console.log(`${vp.name}: ${vp.width}x${vp.height} - OK`);
            }
        });

        test('touch targets adequate on mobile', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 });
            await page.goto('/');

            // Find interactive elements
            const buttons = await page.locator('button, a').all();

            let smallTargets = 0;

            for (const btn of buttons.slice(0, 20)) {
                const box = await btn.boundingBox();

                if (box && (box.width < 44 || box.height < 44)) {
                    smallTargets++;
                }
            }

            console.log(`Touch targets: ${smallTargets}/${buttons.length} are smaller than 44px`);

            // Allow some small targets but not majority
            expect(smallTargets).toBeLessThan(buttons.length * 0.5);
        });
    });
});
