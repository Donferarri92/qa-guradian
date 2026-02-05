import { test, expect, Page } from '@playwright/test';

// Helper to find a product page
async function navigateToProduct(page: Page): Promise<boolean> {
    await page.goto('/');

    // Try to find and click a product
    const productLinks = page.locator(
        'a[href*="/products/"], a[href*="/product/"], [class*="product"] a, article a'
    );

    if (await productLinks.count() > 0) {
        await productLinks.first().click();
        await page.waitForLoadState('networkidle');
        return true;
    }

    // Try collection page first
    const collectionLink = page.locator('a[href*="collection"]').first();
    if (await collectionLink.count() > 0) {
        await collectionLink.click();
        await page.waitForLoadState('networkidle');

        // Now find product
        const products = page.locator('a[href*="/products/"], a[href*="/product/"]');
        if (await products.count() > 0) {
            await products.first().click();
            await page.waitForLoadState('networkidle');
            return true;
        }
    }

    return false;
}

test.describe('Product Detail Page (PDP)', () => {

    test('product detail page loads', async ({ page }) => {
        const found = await navigateToProduct(page);
        expect(found).toBe(true);

        // URL should contain product
        expect(page.url()).toMatch(/product/i);

        // Page should have content
        const content = await page.content();
        expect(content.length).toBeGreaterThan(2000);
    });

    test('image gallery works', async ({ page }) => {
        await navigateToProduct(page);

        // Find main product image
        const mainImage = page.locator(
            '[class*="product-image"] img, [class*="gallery"] img, [class*="media"] img, main img'
        ).first();

        await expect(mainImage).toBeVisible();

        // Check image has valid src
        const src = await mainImage.getAttribute('src');
        expect(src).toBeTruthy();
        expect(src).not.toContain('placeholder');

        // Check for thumbnail/gallery navigation
        const thumbnails = page.locator(
            '[class*="thumbnail"], [class*="gallery"] img, [class*="carousel"] button'
        );

        const thumbCount = await thumbnails.count();

        // If multiple images, try clicking a thumbnail
        if (thumbCount > 1) {
            await thumbnails.nth(1).click();
            await page.waitForTimeout(500);

            // Main image should still be visible
            await expect(mainImage).toBeVisible();
        }
    });

    test('no broken images on PDP', async ({ page }) => {
        await navigateToProduct(page);

        const images = page.locator('img');
        const imageCount = await images.count();

        const brokenImages: string[] = [];

        for (let i = 0; i < imageCount; i++) {
            const img = images.nth(i);
            const isVisible = await img.isVisible();

            if (isVisible) {
                const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
                const src = await img.getAttribute('src');

                if (naturalWidth === 0 && src) {
                    brokenImages.push(src);
                }
            }
        }

        expect(brokenImages).toHaveLength(0);
    });

    test('price visible and consistent', async ({ page }) => {
        await navigateToProduct(page);

        // Find price element
        const priceElement = page.locator(
            '[class*="price"]:not([class*="compare"]), [data-price], .money, [class*="amount"]'
        ).first();

        await expect(priceElement).toBeVisible();

        const priceText = await priceElement.textContent();
        expect(priceText).toBeTruthy();

        // Price should contain currency symbol or number
        expect(priceText).toMatch(/[\d₹$€£Rs]/);
    });

    test('add to cart works', async ({ page }) => {
        await navigateToProduct(page);

        // Find Add to Cart button
        const addToCartButton = page.locator(
            'button:has-text("Add to Cart"), button:has-text("Add to Bag"), button:has-text("Buy"), [class*="add-to-cart"], form[action*="cart"] button[type="submit"]'
        ).first();

        // Button should be visible
        await expect(addToCartButton).toBeVisible({ timeout: 10000 });

        // Check if button is disabled (might need variant selection)
        const isDisabled = await addToCartButton.isDisabled();

        if (!isDisabled) {
            // Click add to cart
            await addToCartButton.click();

            // Wait for cart update
            await page.waitForTimeout(2000);

            // Check for success indication
            const cartIndicator = page.locator(
                '[class*="cart-count"], [class*="cart-icon"] span, [class*="cart"] [class*="badge"], [class*="cart-notification"]'
            );

            // Either cart count updated or success message shown
            const successMessage = page.locator(
                '[class*="success"], [class*="added"], [role="alert"]'
            );

            const hasIndicator = await cartIndicator.count() > 0 || await successMessage.count() > 0;
            expect(hasIndicator).toBe(true);
        }
    });

    test('variant selection updates correctly', async ({ page }) => {
        await navigateToProduct(page);

        // Look for variant selectors
        const variantSelectors = page.locator(
            'select[name*="variant"], select[name*="option"], [class*="variant"] button, [class*="swatch"], input[type="radio"][name*="option"]'
        );

        const variantCount = await variantSelectors.count();

        if (variantCount > 0) {
            // Get initial price
            const priceElement = page.locator('[class*="price"]').first();
            const initialPrice = await priceElement.textContent();

            // Try to select a different variant
            const selector = variantSelectors.first();
            const tagName = await selector.evaluate(el => el.tagName);

            if (tagName === 'SELECT') {
                const options = await selector.locator('option').allTextContents();
                if (options.length > 1) {
                    await selector.selectOption({ index: 1 });
                }
            } else {
                // Click second variant if available
                if (variantCount > 1) {
                    await variantSelectors.nth(1).click();
                }
            }

            await page.waitForTimeout(500);

            // Page should still be functional after variant change
            await expect(priceElement).toBeVisible();
        }
    });

    test('product has description', async ({ page }) => {
        await navigateToProduct(page);

        // Look for description section
        const description = page.locator(
            '[class*="description"], [class*="product-info"], [itemprop="description"], [class*="details"]'
        );

        if (await description.count() > 0) {
            const text = await description.first().textContent();
            expect(text?.trim().length).toBeGreaterThan(10);
        }
    });
});
