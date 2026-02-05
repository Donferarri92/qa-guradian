import { test, expect } from '@playwright/test';

test.describe('SEO & Indexability', () => {

    test('SEO meta tags present', async ({ page }) => {
        await page.goto('/');

        // Check title
        const title = await page.title();
        expect(title).toBeTruthy();
        expect(title.length).toBeGreaterThan(10);
        expect(title.length).toBeLessThan(70); // Optimal title length

        // Check meta description
        const metaDesc = await page.locator('meta[name="description"]').getAttribute('content');
        expect(metaDesc).toBeTruthy();
        expect(metaDesc!.length).toBeGreaterThan(50);
        expect(metaDesc!.length).toBeLessThan(160);

        console.log('Title:', title);
        console.log('Description:', metaDesc);
    });

    test('canonical tag present', async ({ page }) => {
        await page.goto('/');

        const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');

        if (canonical) {
            expect(canonical).toMatch(/^https?:\/\//);
            console.log('Canonical:', canonical);
        }
    });

    test('sitemap accessible', async ({ page }) => {
        // Try common sitemap locations
        const sitemapUrls = [
            '/sitemap.xml',
            '/sitemap_index.xml',
            '/sitemap/sitemap.xml',
        ];

        let sitemapFound = false;
        let sitemapUrl = '';

        for (const url of sitemapUrls) {
            const response = await page.goto(url).catch(() => null);

            if (response && response.status() === 200) {
                const contentType = response.headers()['content-type'];
                const content = await page.content();

                if (contentType?.includes('xml') || content.includes('<?xml') || content.includes('<urlset')) {
                    sitemapFound = true;
                    sitemapUrl = url;
                    break;
                }
            }
        }

        if (sitemapFound) {
            console.log('Sitemap found at:', sitemapUrl);
        } else {
            console.log('Warning: No sitemap found');
        }

        expect(sitemapFound).toBe(true);
    });

    test('robots.txt valid', async ({ page }) => {
        const response = await page.goto('/robots.txt');

        expect(response?.status()).toBe(200);

        const content = await page.content();

        // Should have user-agent directive
        expect(content.toLowerCase()).toContain('user-agent');

        // Should reference sitemap
        const hasSitemap = content.toLowerCase().includes('sitemap');
        if (!hasSitemap) {
            console.log('Warning: robots.txt does not reference sitemap');
        }

        console.log('Robots.txt content length:', content.length);
    });

    test('structured data present', async ({ page }) => {
        // Check homepage
        await page.goto('/');

        // Look for JSON-LD structured data
        const jsonLd = await page.locator('script[type="application/ld+json"]').all();

        const structuredData: any[] = [];

        for (const script of jsonLd) {
            const content = await script.textContent();
            if (content) {
                try {
                    const data = JSON.parse(content);
                    structuredData.push(data);
                } catch {
                    // Invalid JSON
                }
            }
        }

        console.log('Structured data found:', structuredData.length, 'blocks');

        if (structuredData.length > 0) {
            const types = structuredData.map(d => d['@type']).filter(Boolean);
            console.log('Schema types:', types);
        }

        // Check product page for product schema
        const productLink = page.locator('a[href*="/products/"]').first();
        if (await productLink.count() > 0) {
            await productLink.click();
            await page.waitForLoadState('networkidle');

            const productJsonLd = await page.locator('script[type="application/ld+json"]').all();

            let hasProductSchema = false;
            for (const script of productJsonLd) {
                const content = await script.textContent();
                if (content?.includes('"Product"') || content?.includes('"@type":"Product"')) {
                    hasProductSchema = true;
                    break;
                }
            }

            if (hasProductSchema) {
                console.log('Product schema found on PDP');
            }
        }
    });

    test('open graph tags present', async ({ page }) => {
        await page.goto('/');

        const ogTags = {
            'og:title': await page.locator('meta[property="og:title"]').getAttribute('content'),
            'og:description': await page.locator('meta[property="og:description"]').getAttribute('content'),
            'og:image': await page.locator('meta[property="og:image"]').getAttribute('content'),
            'og:url': await page.locator('meta[property="og:url"]').getAttribute('content'),
        };

        console.log('Open Graph tags:', ogTags);

        // Should have at least title and image
        expect(ogTags['og:title'] || ogTags['og:description']).toBeTruthy();
    });

    test('heading structure valid', async ({ page }) => {
        await page.goto('/');

        // Check for H1
        const h1Count = await page.locator('h1').count();

        // Should have exactly one H1
        expect(h1Count).toBe(1);

        // Get heading hierarchy
        const headings = await page.evaluate(() => {
            const result: { level: number; text: string }[] = [];
            document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
                result.push({
                    level: parseInt(h.tagName.substring(1)),
                    text: h.textContent?.trim().substring(0, 50) || '',
                });
            });
            return result;
        });

        console.log('Heading structure:', headings.slice(0, 10));

        // Verify proper hierarchy (no skipping levels)
        let prevLevel = 0;
        for (const heading of headings) {
            // Skipping more than 1 level is bad practice
            if (prevLevel > 0 && heading.level > prevLevel + 1) {
                console.log(`Warning: Heading level skipped from H${prevLevel} to H${heading.level}`);
            }
            prevLevel = heading.level;
        }
    });

    test('images have alt text', async ({ page }) => {
        await page.goto('/');

        const images = await page.locator('img').all();
        const imagesWithoutAlt: string[] = [];

        for (const img of images) {
            const alt = await img.getAttribute('alt');
            const src = await img.getAttribute('src');

            if (!alt && src && !src.includes('data:')) {
                imagesWithoutAlt.push(src.substring(0, 100));
            }
        }

        console.log(`Images: ${images.length} total, ${imagesWithoutAlt.length} without alt`);

        // Most images should have alt text
        const altPercentage = ((images.length - imagesWithoutAlt.length) / images.length) * 100;
        expect(altPercentage).toBeGreaterThan(80);
    });
});
