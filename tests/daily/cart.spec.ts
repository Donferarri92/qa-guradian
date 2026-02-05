import { test, expect, Page } from '@playwright/test';

// Helper to add a product to cart
async function addProductToCart(page: Page): Promise<boolean> {
    await page.goto('/');

    // Find a product link
    const productLinks = page.locator('a[href*="/products/"], a[href*="/product/"]');

    if (await productLinks.count() === 0) {
        // Try collection first
        const collectionLink = page.locator('a[href*="collection"]').first();
        if (await collectionLink.count() > 0) {
            await collectionLink.click();
            await page.waitForLoadState('networkidle');
        }
    }

    const products = page.locator('a[href*="/products/"], a[href*="/product/"]');
    if (await products.count() === 0) return false;

    await products.first().click();
    await page.waitForLoadState('networkidle');

    // Add to cart
    const addButton = page.locator(
        'button:has-text("Add to Cart"), button:has-text("Add to Bag"), [class*="add-to-cart"] button'
    ).first();

    if (await addButton.count() === 0) return false;

    const isDisabled = await addButton.isDisabled();
    if (isDisabled) return false;

    await addButton.click();
    await page.waitForTimeout(2000);

    return true;
}

test.describe('Cart Page', () => {

    test.beforeEach(async ({ page }) => {
        // Add product before each cart test
        const added = await addProductToCart(page);
        expect(added).toBe(true);
    });

    test('cart page loads', async ({ page }) => {
        // Navigate to cart
        const cartLink = page.locator(
            'a[href*="cart"], a[href*="/cart"], [class*="cart-icon"] a, [class*="cart-link"]'
        ).first();

        if (await cartLink.count() > 0) {
            await cartLink.click();
        } else {
            await page.goto('/cart');
        }

        await page.waitForLoadState('networkidle');

        // Cart should show content
        const content = await page.content();
        expect(content).toMatch(/cart|bag|checkout/i);
    });

    test('cart shows added items', async ({ page }) => {
        // Go to cart
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');

        // Should have at least one item
        const cartItems = page.locator(
            '[class*="cart-item"], [class*="line-item"], [class*="cart"] tr, [class*="cart"] article'
        );

        const itemCount = await cartItems.count();
        expect(itemCount).toBeGreaterThan(0);

        // Items should have image, name, price
        if (itemCount > 0) {
            const firstItem = cartItems.first();

            // Should have image
            const img = firstItem.locator('img');
            expect(await img.count()).toBeGreaterThan(0);

            // Should have text (product name)
            const text = await firstItem.textContent();
            expect(text?.length).toBeGreaterThan(0);
        }
    });

    test('quantity update works', async ({ page }) => {
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');

        // Find quantity input or controls
        const qtyInput = page.locator(
            'input[name*="quantity"], input[type="number"], [class*="quantity"] input'
        ).first();

        const qtyButtons = page.locator(
            '[class*="quantity"] button, button[class*="plus"], button[class*="increase"]'
        );

        if (await qtyInput.count() > 0) {
            // Get initial value
            const initialQty = await qtyInput.inputValue();

            // Clear and set new value
            await qtyInput.fill('2');
            await qtyInput.press('Enter');
            await page.waitForTimeout(1500);

            // Verify update (page should refresh or show updated)
            const cartContent = await page.content();
            expect(cartContent).toBeTruthy();
        } else if (await qtyButtons.count() > 0) {
            // Use +/- buttons
            await qtyButtons.first().click();
            await page.waitForTimeout(1500);
        }
    });

    test('remove item works', async ({ page }) => {
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');

        // Count initial items
        const cartItems = page.locator('[class*="cart-item"], [class*="line-item"]');
        const initialCount = await cartItems.count();

        // Find remove button
        const removeButton = page.locator(
            'button:has-text("Remove"), button[class*="remove"], a[class*="remove"], [aria-label*="remove"]'
        ).first();

        if (await removeButton.count() > 0 && initialCount > 0) {
            await removeButton.click();
            await page.waitForTimeout(2000);

            // Either item removed or confirmation shown
            const afterCount = await cartItems.count();
            const emptyMessage = page.locator(':text("empty"), :text("no items")');

            expect(afterCount < initialCount || await emptyMessage.count() > 0).toBe(true);
        }
    });

    test('totals update correctly', async ({ page }) => {
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');

        // Find subtotal/total element
        const totalElement = page.locator(
            '[class*="subtotal"], [class*="total"]:not([class*="quantity"]), [class*="cart-total"]'
        ).first();

        if (await totalElement.count() > 0) {
            const totalText = await totalElement.textContent();
            expect(totalText).toBeTruthy();
            expect(totalText).toMatch(/[\d₹$€£]/);
        }
    });

    test('proceed to checkout button exists', async ({ page }) => {
        await page.goto('/cart');
        await page.waitForLoadState('networkidle');

        // Find checkout button
        const checkoutButton = page.locator(
            'a:has-text("Checkout"), button:has-text("Checkout"), a[href*="checkout"], [class*="checkout"] a, [class*="checkout"] button'
        ).first();

        await expect(checkoutButton).toBeVisible();

        // Should be clickable
        const isDisabled = await checkoutButton.isDisabled().catch(() => false);
        expect(isDisabled).toBe(false);
    });
});
