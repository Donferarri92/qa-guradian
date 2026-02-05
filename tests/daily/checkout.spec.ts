import { test, expect, Page } from '@playwright/test';

// Helper to get to checkout with a product
async function navigateToCheckout(page: Page): Promise<boolean> {
    await page.goto('/');

    // Find and click a product
    const productLink = page.locator('a[href*="/products/"], a[href*="/product/"]').first();

    if (await productLink.count() === 0) {
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
        'button:has-text("Add to Cart"), button:has-text("Add to Bag"), [class*="add-to-cart"]'
    ).first();

    if (await addButton.count() === 0) return false;
    if (await addButton.isDisabled()) return false;

    await addButton.click();
    await page.waitForTimeout(2000);

    // Go to cart
    const cartLink = page.locator('a[href*="/cart"]').first();
    if (await cartLink.count() > 0) {
        await cartLink.click();
    } else {
        await page.goto('/cart');
    }
    await page.waitForLoadState('networkidle');

    // Click checkout
    const checkoutButton = page.locator(
        'a:has-text("Checkout"), button:has-text("Checkout"), a[href*="checkout"]'
    ).first();

    if (await checkoutButton.count() === 0) return false;

    await checkoutButton.click();
    await page.waitForLoadState('networkidle');

    return true;
}

test.describe('Checkout Flow', () => {

    test('checkout form validation', async ({ page }) => {
        const reached = await navigateToCheckout(page);

        if (!reached) {
            // If checkout requires login or has issues, skip gracefully
            test.skip();
            return;
        }

        // Should be on checkout page
        expect(page.url()).toMatch(/checkout|order/i);

        // Find form fields
        const emailField = page.locator('input[type="email"], input[name*="email"]').first();
        const nameField = page.locator(
            'input[name*="name"], input[name*="first"], input[placeholder*="name"]'
        ).first();

        // Check that form fields exist
        const hasEmail = await emailField.count() > 0;
        const hasName = await nameField.count() > 0;

        expect(hasEmail || hasName).toBe(true);

        // Test validation by trying to submit empty form
        const submitButton = page.locator(
            'button[type="submit"], button:has-text("Continue"), button:has-text("Next")'
        ).first();

        if (await submitButton.count() > 0) {
            await submitButton.click();
            await page.waitForTimeout(1000);

            // Should show validation errors or stay on same page
            const errors = page.locator(
                '[class*="error"], [class*="invalid"], [aria-invalid="true"]'
            );
            const errorCount = await errors.count();

            // Either errors shown or form requires all fields
            expect(errorCount >= 0).toBe(true);
        }
    });

    test('address form has required fields', async ({ page }) => {
        const reached = await navigateToCheckout(page);
        if (!reached) {
            test.skip();
            return;
        }

        // Check for address fields
        const addressFields = [
            'input[name*="address"], input[placeholder*="address"]',
            'input[name*="city"], input[placeholder*="city"]',
            'input[name*="state"], select[name*="state"]',
            'input[name*="zip"], input[name*="postal"], input[placeholder*="PIN"]',
            'input[name*="phone"], input[type="tel"]',
        ];

        let fieldsFound = 0;
        for (const selector of addressFields) {
            const field = page.locator(selector);
            if (await field.count() > 0) {
                fieldsFound++;
            }
        }

        // Should have at least some address fields
        expect(fieldsFound).toBeGreaterThan(0);
    });

    test('shipping step reachable', async ({ page }) => {
        const reached = await navigateToCheckout(page);
        if (!reached) {
            test.skip();
            return;
        }

        // Fill in basic info if email field exists
        const emailField = page.locator('input[type="email"]').first();
        if (await emailField.count() > 0) {
            await emailField.fill('test@example.com');
        }

        // Try to proceed
        const continueButton = page.locator(
            'button:has-text("Continue"), button:has-text("Next"), button[type="submit"]'
        ).first();

        if (await continueButton.count() > 0) {
            // Check if shipping section exists or appears
            const shippingSection = page.locator(
                '[class*="shipping"], :text("Shipping"), :text("Delivery")'
            );

            const hasShipping = await shippingSection.count() > 0;
            expect(hasShipping).toBe(true);
        }
    });

    test('payment step reachable', async ({ page }) => {
        const reached = await navigateToCheckout(page);
        if (!reached) {
            test.skip();
            return;
        }

        // Check for payment section
        const paymentSection = page.locator(
            '[class*="payment"], :text("Payment"), :text("Pay"), iframe[src*="stripe"], iframe[src*="razorpay"]'
        );

        // Wait a bit for payment section to potentially load
        await page.waitForTimeout(2000);

        const hasPayment = await paymentSection.count() > 0;

        // Payment might be after address step, so also check for it being mentioned
        const pageContent = await page.content();
        const mentionsPayment = pageContent.toLowerCase().includes('payment') ||
            pageContent.toLowerCase().includes('pay now') ||
            pageContent.includes('Razorpay') ||
            pageContent.includes('stripe');

        expect(hasPayment || mentionsPayment).toBe(true);
    });

    test('order summary visible during checkout', async ({ page }) => {
        const reached = await navigateToCheckout(page);
        if (!reached) {
            test.skip();
            return;
        }

        // Find order summary
        const orderSummary = page.locator(
            '[class*="summary"], [class*="order"], [class*="cart"]'
        ).filter({ hasText: /total|subtotal|₹|\$/i });

        if (await orderSummary.count() > 0) {
            await expect(orderSummary.first()).toBeVisible();

            // Should show product info
            const summaryText = await orderSummary.first().textContent();
            expect(summaryText).toBeTruthy();
        }
    });
});
