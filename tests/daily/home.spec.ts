import { test, expect, Page } from '@playwright/test';

// Helper to collect console errors
async function collectConsoleErrors(page: Page): Promise<string[]> {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error') {
            errors.push(msg.text());
        }
    });
    return errors;
}

test.describe('Home Page', () => {
    test('home page loads correctly', async ({ page }) => {
        const errors = await collectConsoleErrors(page);

        const response = await page.goto('/');

        // Check response is successful
        expect(response?.status()).toBeLessThan(400);

        // Page should not be blank
        const body = await page.locator('body');
        await expect(body).toBeVisible();

        // Should have content
        const content = await page.content();
        expect(content.length).toBeGreaterThan(1000);

        // Check for critical console errors
        const criticalErrors = errors.filter(e =>
            !e.includes('favicon') &&
            !e.includes('third-party') &&
            !e.includes('analytics')
        );
        expect(criticalErrors).toHaveLength(0);
    });

    test('header navigation works', async ({ page }) => {
        await page.goto('/');

        // Header should be visible
        const header = page.locator('header').first();
        await expect(header).toBeVisible();

        // Logo should be present and clickable
        const logo = header.locator('a').first();
        await expect(logo).toBeVisible();

        // Navigation links should exist
        const navLinks = header.locator('nav a, a[href*="collection"], a[href*="products"]');
        const linkCount = await navLinks.count();
        expect(linkCount).toBeGreaterThan(0);

        // Test clicking a nav link
        if (linkCount > 0) {
            const firstLink = navLinks.first();
            const href = await firstLink.getAttribute('href');

            if (href && !href.startsWith('http') && !href.startsWith('mailto')) {
                await firstLink.click();
                await page.waitForLoadState('networkidle');
                expect(page.url()).not.toBe('/');
            }
        }
    });

    test('footer links are valid', async ({ page }) => {
        await page.goto('/');

        // Footer should exist
        const footer = page.locator('footer').first();
        await expect(footer).toBeVisible();

        // Get all footer links
        const footerLinks = footer.locator('a');
        const linkCount = await footerLinks.count();

        // Check that footer has links
        expect(linkCount).toBeGreaterThan(0);

        // Verify links have href attributes
        for (let i = 0; i < Math.min(linkCount, 10); i++) {
            const link = footerLinks.nth(i);
            const href = await link.getAttribute('href');
            expect(href).toBeTruthy();
        }
    });

    test('page has proper meta tags', async ({ page }) => {
        await page.goto('/');

        // Check title
        const title = await page.title();
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(5);

        // Check meta description
        const metaDesc = page.locator('meta[name="description"]');
        const descCount = await metaDesc.count();
        if (descCount > 0) {
            const content = await metaDesc.getAttribute('content');
            expect(content).toBeTruthy();
        }
    });
});
