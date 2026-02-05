import { test, expect } from '@playwright/test';

interface ImageInfo {
    src: string;
    naturalWidth: number;
    naturalHeight: number;
    displayWidth: number;
    displayHeight: number;
    fileSize?: number;
    format?: string;
    isVisible: boolean;
}

interface ImageQualityIssue {
    src: string;
    productUrl?: string;
    issues: string[];
    naturalWidth: number;
    naturalHeight: number;
    displayWidth: number;
    displayHeight: number;
}

test.describe('Image Quality Analysis', () => {

    test('image quality analysis', async ({ page }) => {
        await page.goto('/');

        // Navigate to collection page
        const collectionLink = page.locator('a[href*="collection"]').first();
        if (await collectionLink.count() > 0) {
            await collectionLink.click();
        } else {
            await page.goto('/collections/all');
        }
        await page.waitForLoadState('networkidle');

        // Analyze all images
        const images = await page.locator('img').all();
        const imageReport: ImageQualityIssue[] = [];

        for (let i = 0; i < Math.min(images.length, 30); i++) {
            const img = images[i];

            const info = await img.evaluate((el: HTMLImageElement) => ({
                src: el.src,
                naturalWidth: el.naturalWidth,
                naturalHeight: el.naturalHeight,
                displayWidth: el.clientWidth,
                displayHeight: el.clientHeight,
                isVisible: el.offsetParent !== null,
            }));

            if (!info.isVisible || !info.src || info.src.startsWith('data:')) {
                continue;
            }

            const issues: string[] = [];

            // Check for low resolution
            if (info.naturalWidth < 100 && info.displayWidth > 150) {
                issues.push('LOW_RES');
            }

            // Check for stretched images
            if (info.naturalWidth > 0 && info.naturalHeight > 0) {
                const naturalRatio = info.naturalWidth / info.naturalHeight;
                const displayRatio = info.displayWidth / info.displayHeight;

                if (Math.abs(naturalRatio - displayRatio) > 0.1) {
                    issues.push('STRETCHED');
                }
            }

            // Check for broken images
            if (info.naturalWidth === 0) {
                issues.push('BROKEN');
            }

            // Check for excessively large images
            if (info.naturalWidth > 2000 && info.displayWidth < 500) {
                issues.push('OVERSIZED');
            }

            // Check for placeholder images
            if (info.src.includes('placeholder') || info.src.includes('no-image')) {
                issues.push('PLACEHOLDER');
            }

            if (issues.length > 0) {
                imageReport.push({
                    src: info.src.substring(0, 150),
                    issues,
                    naturalWidth: info.naturalWidth,
                    naturalHeight: info.naturalHeight,
                    displayWidth: info.displayWidth,
                    displayHeight: info.displayHeight,
                });
            }
        }

        console.log('=== IMAGE QUALITY REPORT ===');
        console.log(`Total images analyzed: ${images.length}`);
        console.log(`Images with issues: ${imageReport.length}`);
        console.log(JSON.stringify(imageReport.slice(0, 10), null, 2));

        // No broken images allowed
        const brokenImages = imageReport.filter(r => r.issues.includes('BROKEN'));
        expect(brokenImages).toHaveLength(0);
    });

    test('no missing images', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const images = await page.locator('img').all();
        const missingImages: string[] = [];

        for (const img of images) {
            const isVisible = await img.isVisible();

            if (isVisible) {
                const naturalWidth = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
                const src = await img.getAttribute('src');

                if (naturalWidth === 0 && src && !src.startsWith('data:')) {
                    missingImages.push(src);
                }
            }
        }

        console.log(`Missing images: ${missingImages.length}`);
        if (missingImages.length > 0) {
            console.log('Missing:', missingImages.slice(0, 5));
        }

        // Zero tolerance for missing images
        expect(missingImages).toHaveLength(0);
    });

    test('product images quality check', async ({ page }) => {
        await page.goto('/');

        // Find product links
        const productLinks = await page.locator('a[href*="/products/"]').all();
        const productsToCheck = Math.min(productLinks.length, 5);

        const productImageIssues: Array<{
            productUrl: string;
            issues: ImageQualityIssue[];
        }> = [];

        for (let i = 0; i < productsToCheck; i++) {
            const productLink = page.locator('a[href*="/products/"]').nth(i);
            const href = await productLink.getAttribute('href');

            await page.goto(href || '/');
            await page.waitForLoadState('networkidle');

            // Check product images
            const productImages = await page.locator(
                '[class*="product-image"] img, [class*="gallery"] img, main img'
            ).all();

            const issues: ImageQualityIssue[] = [];

            for (const img of productImages) {
                const info = await img.evaluate((el: HTMLImageElement) => ({
                    src: el.src,
                    naturalWidth: el.naturalWidth,
                    naturalHeight: el.naturalHeight,
                    displayWidth: el.clientWidth,
                    displayHeight: el.clientHeight,
                }));

                const imgIssues: string[] = [];

                // Product images should be high quality
                if (info.naturalWidth < 400) {
                    imgIssues.push('LOW_RES');
                }

                if (info.naturalWidth === 0) {
                    imgIssues.push('BROKEN');
                }

                // Check compression (rough heuristic - small file size for large dimensions)
                // This would need actual file size check which requires additional request

                if (imgIssues.length > 0) {
                    issues.push({
                        src: info.src.substring(0, 100),
                        issues: imgIssues,
                        ...info,
                    });
                }
            }

            if (issues.length > 0) {
                productImageIssues.push({
                    productUrl: page.url(),
                    issues,
                });
            }
        }

        console.log('=== PRODUCT IMAGE QUALITY REPORT ===');
        console.log(`Products checked: ${productsToCheck}`);
        console.log(`Products with image issues: ${productImageIssues.length}`);
        console.log(JSON.stringify(productImageIssues, null, 2));

        // No broken product images
        const brokenProductImages = productImageIssues.filter(p =>
            p.issues.some(i => i.issues.includes('BROKEN'))
        );
        expect(brokenProductImages).toHaveLength(0);
    });

    test('image format optimization', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const imageFormats = await page.evaluate(() => {
            const images = document.querySelectorAll('img');
            const formats: Record<string, number> = {};

            images.forEach(img => {
                const src = img.src;
                const ext = src.split('.').pop()?.split('?')[0]?.toLowerCase();
                if (ext && ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif', 'svg'].includes(ext)) {
                    formats[ext] = (formats[ext] || 0) + 1;
                }
            });

            return formats;
        });

        console.log('Image formats:', imageFormats);

        // Calculate modern format usage
        const total = Object.values(imageFormats).reduce((a, b) => a + b, 0);
        const modernFormats = (imageFormats['webp'] || 0) + (imageFormats['avif'] || 0);
        const modernPercentage = total > 0 ? (modernFormats / total) * 100 : 0;

        console.log(`Modern formats (WebP/AVIF): ${modernPercentage.toFixed(1)}%`);
    });

    test('lazy loading implemented', async ({ page }) => {
        await page.goto('/');

        const images = await page.locator('img').all();
        let lazyLoadCount = 0;

        for (const img of images) {
            const loading = await img.getAttribute('loading');
            const dataSrc = await img.getAttribute('data-src');
            const classes = await img.getAttribute('class');

            if (
                loading === 'lazy' ||
                dataSrc ||
                classes?.includes('lazy')
            ) {
                lazyLoadCount++;
            }
        }

        console.log(`Lazy loading: ${lazyLoadCount}/${images.length} images`);

        // Most images should use lazy loading
        const lazyPercentage = (lazyLoadCount / images.length) * 100;
        console.log(`Lazy loading percentage: ${lazyPercentage.toFixed(1)}%`);
    });
});
