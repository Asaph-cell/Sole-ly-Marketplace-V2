/**
 * Cloudflare Pages Advanced Mode Worker
 * Injects dynamic OG meta tags for product pages so social media crawlers
 * (WhatsApp, Facebook, Twitter) show rich product previews.
 */
const SITE_URL = 'https://solelymarketplace.com';

// Server-side head tags for the main static pages. index.html only carries
// the homepage's tags, so without this every URL looks like the homepage to
// crawlers that don't run JavaScript (Bing, AI crawlers, link previews).
// Keep these in step with each page's <SEO> props.
const ROUTE_META = {
    '/shop': ['Shop Local Sellers in Kenya | Solely Kenya', 'Shop shoes, fashion, electronics and more from sellers across Kenya. Pay with M-Pesa; we hold your money until your order arrives.'],
    '/how-it-works': ['How Solely Protects Your Money | Solely Kenya', 'See how Solely holds your M-Pesa payment until your order arrives and pays the seller when you confirm. Full refund if it never comes.'],
    '/vendor': ['Sell Online Safely in Kenya with Payment Links | Solely Kenya', "Stop losing sales because buyers don't trust you yet. Send them a secure Solely payment link, their money is protected until delivery. Zero fees to start. Works on WhatsApp, Instagram & TikTok."],
    '/vendors': ['Sellers and Stores in Kenya | Solely Kenya', 'Browse sellers on Solely. Every order is buyer-protected: we hold your money until the order arrives.'],
    '/blog': ['Safe Online Selling and Shopping Guides | Solely Kenya', "Tips on selling safely online, growing your social media shop, and protecting yourself as a buyer. Real stories from Kenya's online sellers."],
    '/about': ['About Solely: Safe Online Payments in Kenya | Solely Kenya', 'Solely is the safest way to buy and sell online in Kenya. We protect every transaction; your money is safe until you get what you ordered.'],
    '/contact': ['Contact Solely | Solely Kenya', 'Got a question or complaint? Contact Solely. We respond within 24 hours. Email us at contact@solelymarketplace.com.'],
};

// Every client-side route in src/App.tsx. A path that matches none of these
// gets a real 404 status (the SPA still renders its Not Found page), instead
// of a 200 that search engines index as a "soft 404".
const ROUTE_PATTERNS = [
    /^\/$/,
    /^\/(shop|vendors|blog|about|contact|how-it-works|terms|privacy-policy|feedback|report-listing|auth|reset-password|cart|checkout|wishlist|orders|messages|delivery-details|delivery-negotiation)\/?$/,
    /^\/(shop|store|product|blog|orders|buy|pay|track)\/[^/]+\/?$/,
    /^\/vendor(\/(register|dashboard|setup|products|list-item|add-product|add-accessory|orders|ratings|disputes|payment-links|settings|messages))?\/?$/,
    /^\/vendor\/(edit-product|edit-accessory)\/[^/]+\/?$/,
    /^\/admin(\/(dashboard|disputes|vendors|products|reports|comms|mailing-list|activity|settings|growth|orders))?\/?$/,
    /^\/admin\/vendors\/[^/]+\/?$/,
];

// Point canonical/og:url at this path and, for known pages, swap in the
// page's own title and description.
function rewriteHead(response, pathname) {
    var canonical = SITE_URL + (pathname === '/' ? '/' : pathname.replace(/\/$/, ''));
    var meta = ROUTE_META[pathname.replace(/\/$/, '')];
    var rewriter = new HTMLRewriter()
        .on('link[rel="canonical"]', { element: function (el) { el.setAttribute('href', canonical); } })
        .on('meta[property="og:url"]', { element: function (el) { el.setAttribute('content', canonical); } });
    if (meta) {
        var title = meta[0];
        var desc = meta[1];
        rewriter = rewriter
            .on('title', { element: function (el) { el.setInnerContent(title); } })
            .on('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]', {
                element: function (el) { el.setAttribute('content', desc); },
            })
            .on('meta[property="og:title"], meta[name="twitter:title"]', {
                element: function (el) { el.setAttribute('content', title); },
            });
    }
    return rewriter.transform(response);
}

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
                const SUPABASE_URL = 'https://ktoodrjfytteppnpyhvi.supabase.co';
                const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0b29kcmpmeXR0ZXBwbnB5aHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDA0MDMsImV4cCI6MjA5Mjg3NjQwM30.4VknmxjOv9YjyvOzXHHfOIo3h2czfuT5NNu0-pXz-As';
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
                const SUPABASE_URL = 'https://ktoodrjfytteppnpyhvi.supabase.co';
                const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0b29kcmpmeXR0ZXBwbnB5aHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczMDA0MDMsImV4cCI6MjA5Mjg3NjQwM30.4VknmxjOv9YjyvOzXHHfOIo3h2czfuT5NNu0-pXz-As';

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
                var title = product.name + ', KES ' + Number(product.price_ksh).toLocaleString('en-US') + ' in Kenya | Solely Kenya';
                var desc = (
                    product.description ||
                    'Buy ' + product.name + ' online in Kenya for KES ' + product.price_ksh + '. Your money is held until your order arrives.'
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
                    + '<meta property="og:site_name" content="Solely Kenya">'
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
                    .on('link[rel="canonical"]', {
                        element: function (el) { el.setAttribute('href', SITE_URL + '/product/' + productId); },
                    })
                    .on('meta[name="description"]', {
                        element: function (el) { el.setAttribute('content', safeDesc); },
                    })
                    .on('head', {
                        element: function (el) { el.append(ogTags, { html: true }); },
                    })
                    .transform(response);

                var finalHeaders = new Headers(transformed.headers);
                finalHeaders.set('X-OG-Debug', 'success');
                return new Response(transformed.body, {
                    status: transformed.status,
                    headers: finalHeaders,
                });

            } catch (e) {
                // On any error, serve default page with error debug header
                var fallbackReq = new Request(url.origin + '/index.html', request);
                var fallback = await env.ASSETS.fetch(fallbackReq);
                var fbHeaders = new Headers(fallback.headers);
                fbHeaders.set('X-OG-Debug', 'error');
                return new Response(fallback.body, {
                    status: 200,
                    headers: fbHeaders
                });
            }
        }

        // All other routes: serve static assets normally
        var assetResponse = await env.ASSETS.fetch(request);

        // Allow iframe embedding for /pay/* (Solely checkout widget)
        if (url.pathname.startsWith('/pay/')) {
            var payHeaders = new Headers(assetResponse.headers);
            payHeaders.delete('X-Frame-Options');
            payHeaders.set('Content-Security-Policy', 'frame-ancestors *');
            return new Response(assetResponse.body, {
                status: assetResponse.status,
                headers: payHeaders,
            });
        }

        // Cache solely-widget.js for external consumers
        if (url.pathname === '/solely-widget.js') {
            var widgetHeaders = new Headers(assetResponse.headers);
            widgetHeaders.set('Cache-Control', 'public, max-age=86400');
            widgetHeaders.set('Content-Type', 'application/javascript; charset=utf-8');
            widgetHeaders.set('Access-Control-Allow-Origin', '*');
            return new Response(assetResponse.body, {
                status: assetResponse.status,
                headers: widgetHeaders,
            });
        }

        if (assetResponse.status === 404 && !url.pathname.includes('.')) {
            // SPA Fallback for unknown routes without extensions
            var spaReq = new Request(url.origin + '/index.html', request);
            var spaResponse = await env.ASSETS.fetch(spaReq);

            // Also allow iframe embedding for SPA-routed /pay/* paths
            if (url.pathname.startsWith('/pay/')) {
                var spaPayHeaders = new Headers(spaResponse.headers);
                spaPayHeaders.delete('X-Frame-Options');
                spaPayHeaders.set('Content-Security-Policy', 'frame-ancestors *');
                return new Response(spaResponse.body, {
                    status: 200,
                    headers: spaPayHeaders,
                });
            }

            try {
                var known = ROUTE_PATTERNS.some(function (re) { return re.test(url.pathname); });
                var rewritten = rewriteHead(spaResponse, url.pathname);
                if (known) return rewritten;
                var notFoundHeaders = new Headers(rewritten.headers);
                notFoundHeaders.set('X-Robots-Tag', 'noindex');
                return new Response(rewritten.body, { status: 404, headers: notFoundHeaders });
            } catch (e) {
                return spaResponse;
            }
        }
        return assetResponse;
    },
};
