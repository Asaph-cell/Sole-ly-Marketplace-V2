export const onRequest: PagesFunction = async (context) => {
    const { next } = context;

    const SUPABASE_URL = "https://cqcklvdblhcdowisjnsf.supabase.co";
    const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxY2tsdmRibGhjZG93aXNqbnNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3Njc0MDMsImV4cCI6MjA3NzM0MzQwM30.XEDVTzEQIG2LyEVkVV88vNIJTqVHX6aHXut6BVSP6-g";

    try {
        // Call the existing Supabase generate-sitemap edge function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/generate-sitemap`, {
            headers: {
                "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`Supabase returned ${response.status}`);
        }

        const xml = await response.text();

        return new Response(xml, {
            headers: {
                "Content-Type": "application/xml",
                "Cache-Control": "public, max-age=3600", // Cache for 1 hour
            },
        });
    } catch (e) {
        // Fallback: serve a minimal static sitemap if Supabase is unreachable
        const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://solelymarketplace.com/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://solelymarketplace.com/shop</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>https://solelymarketplace.com/about</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>https://solelymarketplace.com/contact</loc>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>`;

        return new Response(fallbackXml, {
            headers: {
                "Content-Type": "application/xml",
                "Cache-Control": "public, max-age=300", // Shorter cache for fallback
                "X-Sitemap-Fallback": "true",
            },
        });
    }
};
