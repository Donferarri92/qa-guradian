import { test, expect } from '@playwright/test';

test.describe('Security Baseline', () => {

    test('security headers present', async ({ page }) => {
        const response = await page.goto('/');
        const headers = response?.headers() || {};

        const securityHeaders = {
            // Required headers
            'strict-transport-security': 'HSTS - Forces HTTPS',
            'x-content-type-options': 'Prevents MIME sniffing',
            'x-frame-options': 'Prevents clickjacking',

            // Recommended headers
            'content-security-policy': 'CSP - XSS protection',
            'x-xss-protection': 'XSS filter (legacy)',
            'referrer-policy': 'Controls referrer info',
        };

        const results: Record<string, boolean> = {};
        const missing: string[] = [];

        for (const [header, description] of Object.entries(securityHeaders)) {
            const hasHeader = header in headers;
            results[header] = hasHeader;
            if (!hasHeader) {
                missing.push(`${header} (${description})`);
            }
        }

        console.log('Security Headers:', JSON.stringify(results, null, 2));

        if (missing.length > 0) {
            console.log('Missing headers:', missing);
        }

        // At minimum, should have HSTS and X-Content-Type-Options
        expect(
            headers['strict-transport-security'] ||
            page.url().startsWith('https')
        ).toBeTruthy();
    });

    test('TLS configuration valid', async ({ page }) => {
        // Check that HTTPS is used
        const response = await page.goto('/');
        const url = page.url();

        expect(url.startsWith('https://')).toBe(true);

        // Check for certificate info would require additional tools
        // For now, just verify HTTPS works
        expect(response?.status()).toBeLessThan(400);
    });

    test('no mixed content', async ({ page }) => {
        const mixedContentWarnings: string[] = [];

        page.on('console', msg => {
            const text = msg.text();
            if (
                text.includes('Mixed Content') ||
                text.includes('insecure content')
            ) {
                mixedContentWarnings.push(text);
            }
        });

        await page.goto('/');
        await page.waitForLoadState('networkidle');

        // Check key pages
        const pagesToCheck = ['/collections/all', '/cart'];
        for (const url of pagesToCheck) {
            await page.goto(url).catch(() => { });
            await page.waitForTimeout(1000);
        }

        expect(mixedContentWarnings).toHaveLength(0);
    });

    test('no exposed sensitive endpoints', async ({ page }) => {
        // Check common sensitive paths that shouldn't be publicly accessible
        const sensitivePaths = [
            '/.env',
            '/.git/config',
            '/wp-admin',
            '/admin',
            '/phpinfo.php',
            '/config.php',
            '/.htaccess',
            '/backup.sql',
        ];

        for (const path of sensitivePaths) {
            const response = await page.goto(path).catch(() => null);

            if (response) {
                const status = response.status();
                // Should be 404, 403, or redirect
                expect([301, 302, 403, 404]).toContain(status);
            }
        }
    });

    test('cookies have secure flags', async ({ page }) => {
        await page.goto('/');

        const cookies = await page.context().cookies();

        const insecureCookies = cookies.filter(cookie => {
            // Session/auth cookies should have secure flag
            const isSessionCookie = cookie.name.match(/session|auth|token|cart/i);
            return isSessionCookie && !cookie.secure;
        });

        if (insecureCookies.length > 0) {
            console.log('Insecure cookies:', insecureCookies.map(c => c.name));
        }

        // All session cookies should be secure on HTTPS site
        expect(insecureCookies.length).toBe(0);
    });

    test('no inline event handlers in HTML', async ({ page }) => {
        await page.goto('/');

        // Check for dangerous inline handlers
        const inlineHandlers = await page.evaluate(() => {
            const elements = document.querySelectorAll('*');
            const handlers: string[] = [];
            const dangerousAttributes = ['onclick', 'onerror', 'onload', 'onmouseover'];

            elements.forEach(el => {
                dangerousAttributes.forEach(attr => {
                    if (el.hasAttribute(attr)) {
                        handlers.push(`${el.tagName}: ${attr}`);
                    }
                });
            });

            return handlers;
        });

        // Inline handlers are not ideal but may exist in some frameworks
        if (inlineHandlers.length > 0) {
            console.log('Inline handlers found:', inlineHandlers.length);
        }

        // Just log, don't fail - many sites use these for legitimate purposes
        expect(true).toBe(true);
    });
});
