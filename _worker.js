/**
 * Cloudflare Pages Advanced Mode Worker
 * Injects dynamic OG meta tags for product pages so social media crawlers
 * (WhatsApp, Facebook, Twitter) show rich product previews.
 */
export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // Debug endpoint to verify worker is running
        if (url.pathname === '/debug-worker') {
            return new Response(JSON.stringify({
                status: 'Worker is active',
                timestamp: new Date().toISOString(),
                url: url.href,
            }), {
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Dynamic sitemap: proxy the Supabase generate-sitemap edge function
        if (url.pathname === '/sitemap.xml') {
            try {
                const SUPABASE_URL = 'https://cqcklvdblhcdowisjnsf.supabase.co';
                const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxY2tsdmRibGhjZG93aXNqbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3Njc0MDMsImV4cCI6MjA3NzM0MzQwM30.XEDVTzEQIG2LyEVkVV88vNIJTqVHX6aHXut6BVSP6-g';
                const sitemapResponse = await fetch(SUPABASE_URL + '/functions/v1/generate-sitemap', {
                    headers: {
                        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json',
                    },
                });
                if (sitemapResponse.ok) {
                    var xml = await sitemapResponse.text();
                    return new Response(xml, {
                        headers: {
                            'Content-Type': 'application/xml',
                            'Cache-Control': 'public, max-age=3600',
                        },
                    });
                }
            } catch (e) {
                // Fall through to static assets on error
            }
            return env.ASSETS.fetch(request);
        }

        // Only intercept /product/* routes for OG tag injection
        if (url.pathname.startsWith('/product/')) {
            try {
                // Get the SPA HTML response from static assets
                const response = await env.ASSETS.fetch(request);

                // Only process HTML responses
                const contentType = response.headers.get('content-type') || '';
                if (!contentType.includes('text/html')) {
                    return response;
                }

                // Extract product ID from path: /product/{id}
                const pathParts = url.pathname.split('/');
                const productId = pathParts[2];
                if (!productId) return response;

                // Fetch product data from Supabase
                const SUPABASE_URL = 'https://cqcklvdblhcdowisjnsf.supabase.co';
                const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxY2tsdmRibGhjZG93aXNqbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3Njc0MDMsImV4cCI6MjA3NzM0MzQwM30.XEDVTzEQIG2LyEVkVV88vNIJTqVHX6aHXut6BVSP6-g';

                const apiUrl = SUPABASE_URL + '/rest/v1/products?id=eq.' + productId + '&select=name,description,price_ksh,images';

                const apiResponse = await fetch(apiUrl, {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
                        'Content-Type': 'application/json',
                    },
                });

                if (!apiResponse.ok) {
                    // Return response with debug header showing API error
                    const newResponse = new Response(response.body, response);
                    newResponse.headers.set('X-OG-Debug', 'api-error-' + apiResponse.status);
                    return newResponse;
                }

                const products = await apiResponse.json();
                const product = products && products[0];

                if (!product) {
                    const newResponse = new Response(response.body, response);
                    newResponse.headers.set('X-OG-Debug', 'no-product-found');
                    return newResponse;
                }

                // Prepare OG data with buyer-intent keywords
                var title = 'Buy ' + product.name + ' Online in Kenya | Sole-ly';
                var desc = (
                    product.description ||
                    'Buy ' + product.name + ' online in Kenya for KES ' + product.price_ksh + '. Escrow-protected payment. Verified seller.'
                );
                if (desc.length > 197) {
                    desc = desc.substring(0, 197) + '...';
                }

                // Dynamic OG image from Supabase Edge Function
                var ogImageUrl = SUPABASE_URL + '/functions/v1/generate-og-image?id=' + productId;

                // Escape special characters for HTML attribute safety
                var safeTitle = title.replace(/"/g, '&quot;').replace(/</g, '&lt;');
                var safeDesc = desc.replace(/"/g, '&quot;').replace(/</g, '&lt;');

                // Build the replacement OG tags
                var ogTags = '<meta property="og:type" content="product">'
                    + '<meta property="og:title" content="' + safeTitle + '">'
                    + '<meta property="og:description" content="' + safeDesc + '">'
                    + '<meta property="og:url" content="' + url.href + '">'
                    + '<meta property="og:site_name" content="Sole-ly Kenya">'
                    + '<meta property="og:image" content="' + ogImageUrl + '">'
                    + '<meta property="og:image:width" content="1200">'
                    + '<meta property="og:image:height" content="630">'
                    + '<meta property="product:price:amount" content="' + product.price_ksh + '">'
                    + '<meta property="product:price:currency" content="KES">'
                    + '<meta name="twitter:card" content="summary_large_image">'
                    + '<meta name="twitter:site" content="@solely_kenya">'
                    + '<meta name="twitter:title" content="' + safeTitle + '">'
                    + '<meta name="twitter:description" content="' + safeDesc + '">'
                    + '<meta name="twitter:image" content="' + ogImageUrl + '">';

                // Use HTMLRewriter to strip default OG tags and inject product-specific ones
                var transformed = new HTMLRewriter()
                    .on('meta[property^="og:"]', {
                        element: function (el) { el.remove(); },
                    })
                    .on('meta[name^="twitter:"]', {
                        element: function (el) { el.remove(); },
                    })
                    .on('title', {
                        element: function (el) { el.setInnerContent(safeTitle); },
                    })
                    .on('head', {
                        element: function (el) { el.append(ogTags, { html: true }); },
                    })
                    .transform(response);

                // Add debug header to confirm worker processed the request
                var newHeaders = new Headers(transformed.headers);
                newHeaders.set('X-OG-Debug', 'success-' + product.name.substring(0, 20));
                return new Response(transformed.body, {
                    status: transformed.status,
                    headers: newHeaders,
                });

            } catch (e) {
                // On any error, serve default page with error debug header
                var fallback = await env.ASSETS.fetch(request);
                var errorResponse = new Response(fallback.body, fallback);
                errorResponse.headers.set('X-OG-Debug', 'error-' + String(e).substring(0, 100));
                return errorResponse;
            }
        }

        // All other routes: serve static assets normally
        return env.ASSETS.fetch(request);
    },
};
