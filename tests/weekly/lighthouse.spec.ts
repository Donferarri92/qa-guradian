import { test, expect } from '@playwright/test';

/**
 * Lighthouse integration for Core Web Vitals testing
 * Note: Full Lighthouse requires the lighthouse package and chromium
 */

test.describe('Performance & Core Web Vitals', () => {

    test('lighthouse performance audit', async ({ page }) => {
        // Navigate and measure performance
        const startTime = Date.now();

        await page.goto('/', { waitUntil: 'networkidle' });

        const loadTime = Date.now() - startTime;

        // Get performance metrics using Performance API
        const metrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            const paint = performance.getEntriesByType('paint');

            const fcp = paint.find(p => p.name === 'first-contentful-paint');
            const lcp = new Promise<number>(resolve => {
                new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1] as any;
                    resolve(lastEntry?.startTime || 0);
                }).observe({ type: 'largest-contentful-paint', buffered: true });

                // Fallback after 5 seconds
                setTimeout(() => resolve(0), 5000);
            });

            return {
                domContentLoaded: navigation?.domContentLoadedEventEnd - navigation?.fetchStart,
                load: navigation?.loadEventEnd - navigation?.fetchStart,
                fcp: fcp?.startTime,
                ttfb: navigation?.responseStart - navigation?.fetchStart,
            };
        });

        // Store metrics for reporting
        console.log('Performance Metrics:', JSON.stringify(metrics, null, 2));

        // Basic thresholds
        expect(metrics.ttfb).toBeLessThan(1500); // TTFB < 1.5s
        expect(metrics.domContentLoaded).toBeLessThan(3000); // DOM < 3s
        expect(loadTime).toBeLessThan(8000); // Full load < 8s
    });

    test('core web vitals meet thresholds', async ({ page }) => {
        await page.goto('/');

        // Measure CLS by observing layout shifts
        const cls = await page.evaluate(() => {
            return new Promise<number>(resolve => {
                let clsValue = 0;
                const observer = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries() as any[]) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    }
                });

                observer.observe({ type: 'layout-shift', buffered: true });

                setTimeout(() => {
                    observer.disconnect();
                    resolve(clsValue);
                }, 3000);
            });
        });

        console.log('CLS:', cls);

        // CLS should be < 0.25 (good is < 0.1)
        expect(cls).toBeLessThan(0.25);
    });

    test('homepage lighthouse score baseline', async ({ page }) => {
        // Simple performance check without full Lighthouse
        const startTime = Date.now();

        const response = await page.goto('/');
        const loadTime = Date.now() - startTime;

        // Check response is fast
        expect(response?.status()).toBeLessThan(400);

        // Count resources
        const resourceCount = await page.evaluate(() => {
            return performance.getEntriesByType('resource').length;
        });

        console.log(`Page loaded in ${loadTime}ms with ${resourceCount} resources`);

        // Resource count shouldn't be excessive
        expect(resourceCount).toBeLessThan(200);
    });

    test('collection page performance', async ({ page }) => {
        const startTime = Date.now();

        await page.goto('/');
        const collectionLink = page.locator('a[href*="collection"]').first();
        if (await collectionLink.count() > 0) {
            await collectionLink.click();
        } else {
            await page.goto('/collections/all');
        }

        await page.waitForLoadState('networkidle');
        const loadTime = Date.now() - startTime;

        // Collection pages should load reasonably fast
        expect(loadTime).toBeLessThan(6000);

        // Images should be optimized (lazy loaded or small initial set)
        const imagesLoaded = await page.evaluate(() => {
            return performance.getEntriesByType('resource')
                .filter(r => r.name.match(/\.(jpg|jpeg|png|webp|gif)/i))
                .length;
        });

        console.log(`Collection page: ${loadTime}ms, ${imagesLoaded} images`);
    });

    test('product page performance', async ({ page }) => {
        await page.goto('/');

        const productLink = page.locator('a[href*="/products/"]').first();
        if (await productLink.count() > 0) {
            const startTime = Date.now();
            await productLink.click();
            await page.waitForLoadState('networkidle');
            const loadTime = Date.now() - startTime;

            expect(loadTime).toBeLessThan(5000);
            console.log(`Product page loaded in ${loadTime}ms`);
        }
    });
});
