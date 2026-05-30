
export const onRequest: PagesFunction = async (context) => {
    const { request, params, next } = context;

    // 1. Extract ID safely
    const productId = Array.isArray(params.id) ? params.id[0] : params.id;

    if (!productId) {
        return next();
    }

    // Fetch original response (SPA shell)
    const response = await next();

    // If not HTML, return as is
    if (!response.headers.get("content-type")?.includes("text/html")) {
        return response;
    }

    // Hardcoded keys (verified working)
    const SUPABASE_URL = "https://cqcklvdblhcdowisjnsf.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxY2tsdmRibGhjZG93aXNqbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3Njc0MDMsImV4cCI6MjA3NzM0MzQwM30.XEDVTzEQIG2LyEVkVV88vNIJTqVHX6aHXut6BVSP6-g";

    try {
        const apiUrl = `${SUPABASE_URL}/rest/v1/products?id=eq.${productId}&select=name,description,price_ksh,images`;

        const apiResponse = await fetch(apiUrl, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!apiResponse.ok) {
            // Pass through on API error
            return response;
        }

        const products = await apiResponse.json();
        const product = products?.[0];

        // SAFETY CHECK: If no product, return original page immediately
        if (!product) return response;

        // 3. Prepare Data
        const title = `Buy ${product.name} Online in Kenya | Sole-ly`;
        const description = (product.description || `Buy ${product.name} online in Kenya for KES ${product.price_ksh.toLocaleString()}. Escrow-protected payment. Verified seller.`).substring(0, 197) + "...";

        // Build the OG image URL — points to the dynamic OG image generator
        const ogImageUrl = `${SUPABASE_URL}/functions/v1/generate-og-image?id=${productId}`;

        // Also resolve the raw product image as fallback
        let imageValue = product.images?.[0];
        let rawImageUrl = "https://solelymarketplace.com/og-image.png";

        if (imageValue) {
            if (imageValue.startsWith("http")) {
                rawImageUrl = imageValue;
            } else if (imageValue.startsWith("/")) {
                rawImageUrl = `https://solelymarketplace.com${imageValue}`;
            } else {
                rawImageUrl = `${SUPABASE_URL}/storage/v1/object/public/product-images/${imageValue}`;
            }
        }

        // Use the dynamic OG image generator URL
        const finalImageUrl = ogImageUrl;

        // 4. Inject — remove existing OG/Twitter tags and inject fresh ones
        return new HTMLRewriter()
            // Remove existing OG tags from the HTML shell to prevent duplicates
            .on('meta[property^="og:"]', {
                element(el) {
                    el.remove();
                }
            })
            .on('meta[name^="twitter:"]', {
                element(el) {
                    el.remove();
                }
            })
            .on("head", {
                element(element) {
                    const tags = `
            <meta property="og:type" content="product">
            <meta property="og:title" content="${title}">
            <meta property="og:description" content="${description}">
            <meta property="og:url" content="${request.url}">
            <meta property="og:site_name" content="Sole-ly Kenya">
            <meta property="og:image" content="${finalImageUrl}">
            <meta property="og:image:width" content="1200">
            <meta property="og:image:height" content="630">
            <meta property="product:price:amount" content="${product.price_ksh}">
            <meta property="product:price:currency" content="KES">
            
            <meta name="twitter:card" content="summary_large_image">
            <meta name="twitter:site" content="@solely_kenya">
            <meta name="twitter:title" content="${title}">
            <meta name="twitter:description" content="${description}">
            <meta name="twitter:image" content="${finalImageUrl}">
            
            <meta name="x-debug-worker" content="active"> 
          `;
                    element.append(tags, { html: true });
                }
            })
            .transform(response);

    } catch (e) {
        // If ANY error happens, return original response + Error Header
        const newResponse = new Response(response.body, response);
        newResponse.headers.set("X-Worker-Error", String(e));
        return newResponse;
    }
};
