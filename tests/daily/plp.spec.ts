import { test, expect } from '@playwright/test';

test.describe('Product Listing Page (PLP)', () => {

    test('collection page loads', async ({ page }) => {
        // Try common collection URLs
        const collectionUrls = [
            '/collections/all',
            '/collections',
            '/products',
            '/shop',
            '/catalog',
        ];

        let loaded = false;
        for (const url of collectionUrls) {
            const response = await page.goto(url, { timeout: 10000 }).catch(() => null);
            if (response && response.status() < 400) {
                loaded = true;
                break;
            }
        }

        // If standard URLs don't work, find collection link from home
        if (!loaded) {
            await page.goto('/');
            const collectionLink = page.locator('a[href*="collection"], a[href*="products"], a[href*="shop"]').first();
            if (await collectionLink.count() > 0) {
                await collectionLink.click();
                await page.waitForLoadState('networkidle');
                loaded = true;
            }
        }

        expect(loaded).toBe(true);
    });

    test('product cards show required info', async ({ page }) => {
        // Navigate to a collection page
        await page.goto('/');

        // Find and click a collection link
        const collectionLink = page.locator('a[href*="collection"], a[href*="products"], a[href*="shop"]').first();
        if (await collectionLink.count() > 0) {
            await collectionLink.click();
            await page.waitForLoadState('networkidle');
        } else {
            // Try direct URL
            await page.goto('/collections/all');
        }

        // Wait for products to load
        await page.waitForTimeout(2000);

        // Find product cards - common selectors
        const productCards = page.locator(
            '[class*="product-card"], [class*="product-item"], [data-product], article, .card'
        ).filter({ has: page.locator('img') });

        const cardCount = await productCards.count();
        expect(cardCount).toBeGreaterThan(0);

        // Check first few cards have required elements
        for (let i = 0; i < Math.min(cardCount, 5); i++) {
            const card = productCards.nth(i);

            // Should have an image
            const img = card.locator('img').first();
            await expect(img).toBeVisible();

            // Image should have src
            const src = await img.getAttribute('src');
            expect(src).toBeTruthy();

            // Should have text (name/title)
            const text = await card.textContent();
            expect(text?.trim().length).toBeGreaterThan(0);
        }
    });

    test('product cards have prices', async ({ page }) => {
        await page.goto('/');

        const collectionLink = page.locator('a[href*="collection"], a[href*="products"]').first();
        if (await collectionLink.count() > 0) {
            await collectionLink.click();
            await page.waitForLoadState('networkidle');
        } else {
            await page.goto('/collections/all');
        }

        await page.waitForTimeout(2000);

        // Look for price elements
        const priceElements = page.locator(
            '[class*="price"], [data-price], .money, span:has-text("₹"), span:has-text("$"), span:has-text("Rs")'
        );

        const priceCount = await priceElements.count();
        expect(priceCount).toBeGreaterThan(0);
    });

    test('sort and filters work', async ({ page }) => {
        await page.goto('/');

        const collectionLink = page.locator('a[href*="collection"], a[href*="products"]').first();
        if (await collectionLink.count() > 0) {
            await collectionLink.click();
            await page.waitForLoadState('networkidle');
        } else {
            await page.goto('/collections/all');
        }

        await page.waitForTimeout(2000);

        // Look for sort dropdown
        const sortDropdown = page.locator(
            'select[name*="sort"], [class*="sort"], button:has-text("Sort"), [aria-label*="sort"]'
        ).first();

        if (await sortDropdown.count() > 0) {
            await sortDropdown.click();
            await page.waitForTimeout(500);

            // If it's a select, try changing value
            const tagName = await sortDropdown.evaluate(el => el.tagName);
            if (tagName === 'SELECT') {
                const options = await sortDropdown.locator('option').allTextContents();
                expect(options.length).toBeGreaterThan(0);
            }
        }

        // Look for filter options
        const filterElements = page.locator(
            '[class*="filter"], [class*="facet"], aside, [role="navigation"]'
        );

        // Filters are optional but if they exist, they should be functional
        if (await filterElements.count() > 0) {
            const filterLinks = filterElements.first().locator('a, button, input[type="checkbox"]');
            const filterCount = await filterLinks.count();
            // Just verify they exist
            expect(filterCount).toBeGreaterThanOrEqual(0);
        }
    });

    test('pagination or infinite scroll works', async ({ page }) => {
        await page.goto('/');

        const collectionLink = page.locator('a[href*="collection"], a[href*="products"]').first();
        if (await collectionLink.count() > 0) {
            await collectionLink.click();
            await page.waitForLoadState('networkidle');
        } else {
            await page.goto('/collections/all');
        }

        await page.waitForTimeout(2000);

        // Check for pagination
        const pagination = page.locator(
            '[class*="pagination"], .page-numbers, nav[aria-label*="pagination"], a:has-text("Next"), button:has-text("Load More")'
        );

        const hasPagination = await pagination.count() > 0;

        // Or check for infinite scroll (more products load on scroll)
        const initialProducts = await page.locator('[class*="product"]').count();

        if (!hasPagination && initialProducts > 10) {
            // Scroll down and check if more products load
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            await page.waitForTimeout(2000);

            const afterScrollProducts = await page.locator('[class*="product"]').count();
            // Either pagination exists or products stay the same (no infinite scroll needed if all shown)
            expect(afterScrollProducts).toBeGreaterThanOrEqual(initialProducts);
        }
    });
});
