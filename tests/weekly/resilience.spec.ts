import { test, expect, Page } from '@playwright/test';

// Helper to add product to cart
async function addToCart(page: Page): Promise<boolean> {
    await page.goto('/');

    const productLink = page.locator('a[href*="/products/"]').first();
    if (await productLink.count() === 0) {
        const collectionLink = page.locator('a[href*="collection"]').first();
        if (await collectionLink.count() > 0) {
            await collectionLink.click();
            await page.waitForLoadState('networkidle');
        }
    }

    const products = page.locator('a[href*="/products/"]');
    if (await products.count() === 0) return false;

    await products.first().click();
    await page.waitForLoadState('networkidle');

    const addButton = page.locator(
        'button:has-text("Add to Cart"), button:has-text("Add to Bag")'
    ).first();

    if (await addButton.count() === 0 || await addButton.isDisabled()) return false;

    await addButton.click();
    await page.waitForTimeout(2000);
    return true;
}

test.describe('Resilience & Edge Cases', () => {

    test('high quantity handling', async ({ page }) => {
        await addToCart(page);
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');

        const qtyInput = page.locator(
            'input[name*="quantity"], input[type="number"]'
        ).first();

        if (await qtyInput.count() > 0) {
            // Try to set very high quantity
            await qtyInput.fill('999');
            await qtyInput.press('Enter');
            await page.waitForTimeout(2000);

            // Should either accept, show limit, or show error
            const errorMessage = page.locator('[class*="error"], [class*="warning"]');
            const hasError = await errorMessage.count() > 0;

            // Page should still be functional
            const cartContent = await page.content();
            expect(cartContent.length).toBeGreaterThan(1000);

            console.log('High quantity test:', hasError ? 'Shows limit/error' : 'Allowed');
        }
    });

    test('slow network checkout', async ({ page, context }) => {
        // Simulate slow network
        await context.route('**/*', async route => {
            await new Promise(r => setTimeout(r, 100)); // 100ms delay per request
            await route.continue();
        });

        await addToCart(page);
        await page.goto('/cart');

        const checkoutButton = page.locator(
            'a:has-text("Checkout"), button:has-text("Checkout")'
        ).first();

        if (await checkoutButton.count() > 0) {
            await checkoutButton.click();
            await page.waitForLoadState('networkidle', { timeout: 60000 });

            // Checkout should still work on slow network
            expect(page.url()).toMatch(/checkout|order/i);
        }
    });

    test('refresh mid-checkout recovery', async ({ page }) => {
        // This tests if cart/checkout state persists after refresh
        await addToCart(page);
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');

        // Get initial cart state
        const initialItems = await page.locator('[class*="cart-item"], [class*="line-item"]').count();

        // Refresh
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Cart should still have items
        const afterItems = await page.locator('[class*="cart-item"], [class*="line-item"]').count();

        expect(afterItems).toBe(initialItems);
        console.log(`Cart items preserved: ${initialItems} -> ${afterItems}`);
    });

    test('back button through checkout', async ({ page }) => {
        await addToCart(page);
        await page.goto('/cart');

        const checkoutButton = page.locator('a:has-text("Checkout")').first();
        if (await checkoutButton.count() > 0) {
            await checkoutButton.click();
            await page.waitForLoadState('networkidle');

            // Go back
            await page.goBack();
            await page.waitForLoadState('networkidle');

            // Should be back on cart
            expect(page.url()).toMatch(/cart/i);

            // Cart should still work
            const cartItems = await page.locator('[class*="cart-item"]').count();
            expect(cartItems).toBeGreaterThan(0);
        }
    });

    test('error pages graceful', async ({ page }) => {
        // Test 404 page
        const response = await page.goto('/this-page-does-not-exist-12345');

        expect(response?.status()).toBe(404);

        // Should show friendly error page, not blank
        const content = await page.content();
        expect(content.length).toBeGreaterThan(500);

        // Should have navigation back to home
        const homeLink = page.locator('a[href="/"], a:has-text("Home"), a:has-text("Continue Shopping")');
        const hasHomeLink = await homeLink.count() > 0;
        expect(hasHomeLink).toBe(true);
    });

    test('rapid add to cart', async ({ page }) => {
        await page.goto('/');

        const productLink = page.locator('a[href*="/products/"]').first();
        if (await productLink.count() > 0) {
            await productLink.click();
            await page.waitForLoadState('networkidle');

            const addButton = page.locator('button:has-text("Add to Cart")').first();

            if (await addButton.count() > 0 && !(await addButton.isDisabled())) {
                // Click rapidly multiple times
                await addButton.click();
                await addButton.click();
                await addButton.click();

                await page.waitForTimeout(3000);

                // Page should still be functional
                await expect(page.locator('body')).toBeVisible();

                // Go to cart and verify
                await page.goto('/cart');
                const cartItems = await page.locator('[class*="cart-item"]').count();

                console.log(`Rapid add result: ${cartItems} items in cart`);
                expect(cartItems).toBeGreaterThan(0);
            }
        }
    });

    test('form validation edge cases', async ({ page }) => {
        await addToCart(page);
        await page.goto('/cart');

        const checkoutButton = page.locator('a:has-text("Checkout")').first();
        if (await checkoutButton.count() > 0) {
            await checkoutButton.click();
            await page.waitForLoadState('networkidle');

            // Try invalid email
            const emailInput = page.locator('input[type="email"]').first();
            if (await emailInput.count() > 0) {
                await emailInput.fill('not-an-email');
                await emailInput.blur();
                await page.waitForTimeout(500);

                // Should show validation error
                const hasError = await page.locator('[class*="error"], [aria-invalid="true"]').count() > 0;
                console.log('Email validation:', hasError ? 'Shows error' : 'No error shown');
            }

            // Try special characters in name
            const nameInput = page.locator('input[name*="name"]').first();
            if (await nameInput.count() > 0) {
                await nameInput.fill('<script>alert("xss")</script>');
                await nameInput.blur();
                await page.waitForTimeout(500);

                // Should either sanitize or reject
                const value = await nameInput.inputValue();
                const isXSS = value.includes('<script>');
                console.log('XSS in name:', isXSS ? 'Not sanitized' : 'Handled');
            }
        }
    });

    test('empty cart behavior', async ({ page }) => {
        // Clear any existing cart by going directly to cart
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');

        // Remove all items if any
        const removeButtons = await page.locator('button:has-text("Remove"), [class*="remove"]').all();
        for (const btn of removeButtons) {
            await btn.click();
            await page.waitForTimeout(500);
        }

        // Reload to see empty state
        await page.reload();
        await page.waitForLoadState('networkidle');

        // Should show empty cart message or redirect to continue shopping
        const emptyMessage = page.locator(':text("empty"), :text("no items")');
        const continueLink = page.locator('a:has-text("Continue"), a:has-text("Shop")');

        const hasEmptyState = await emptyMessage.count() > 0 || await continueLink.count() > 0;
        expect(hasEmptyState).toBe(true);
    });
});
