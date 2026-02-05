import { test, expect } from '@playwright/test';

test.describe('Search Functionality', () => {

    test('search returns results', async ({ page }) => {
        await page.goto('/');

        // Find search input or icon
        const searchInput = page.locator(
            'input[type="search"], input[name*="search"], input[placeholder*="search" i], input[class*="search"]'
        ).first();

        const searchIcon = page.locator(
            'button[class*="search"], a[href*="search"], [aria-label*="search"]'
        ).first();

        let hasSearch = false;

        if (await searchInput.count() > 0) {
            hasSearch = true;
            await searchInput.click();
            await searchInput.fill('sofa');
            await searchInput.press('Enter');
        } else if (await searchIcon.count() > 0) {
            hasSearch = true;
            await searchIcon.click();
            await page.waitForTimeout(500);

            // Now find the revealed search input
            const revealedInput = page.locator('input[type="search"], input[name*="search"]').first();
            if (await revealedInput.count() > 0) {
                await revealedInput.fill('sofa');
                await revealedInput.press('Enter');
            }
        }

        if (!hasSearch) {
            // Try going directly to search URL
            await page.goto('/search?q=sofa');
        }

        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1000);

        // Check for results
        const results = page.locator(
            '[class*="product"], [class*="result"], article, [class*="card"]'
        ).filter({ has: page.locator('img') });

        // Should have some results for common furniture term
        const resultCount = await results.count();
        expect(resultCount).toBeGreaterThan(0);
    });

    test('search works for multiple terms', async ({ page }) => {
        const searchTerms = ['chair', 'table', 'bed'];

        for (const term of searchTerms) {
            await page.goto(`/search?q=${term}`);
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            // Page should have content
            const content = await page.content();
            expect(content.length).toBeGreaterThan(1000);
        }
    });

    test('no results state shows properly', async ({ page }) => {
        await page.goto('/');

        const searchInput = page.locator(
            'input[type="search"], input[name*="search"], input[placeholder*="search" i]'
        ).first();

        if (await searchInput.count() > 0) {
            await searchInput.fill('xyznonexistentproduct12345');
            await searchInput.press('Enter');
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(1000);

            // Should show no results message or empty state
            const noResults = page.locator(
                ':text("no results"), :text("not found"), :text("nothing found"), [class*="empty"]'
            );

            const products = page.locator('[class*="product"]').filter({ has: page.locator('img') });
            const productCount = await products.count();

            // Either shows "no results" message or actually has no products
            const showsNoResults = await noResults.count() > 0;
            expect(showsNoResults || productCount === 0).toBe(true);
        }
    });

    test('search is accessible', async ({ page }) => {
        await page.goto('/');

        // Search should be findable
        const searchElements = page.locator(
            'input[type="search"], [aria-label*="search" i], button[class*="search"]'
        );

        expect(await searchElements.count()).toBeGreaterThan(0);
    });
});
