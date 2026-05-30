import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://solelymarketplace.com'

// Static pages with their priorities and change frequencies
const STATIC_PAGES = [
    { loc: '/', changefreq: 'daily', priority: '1.0' },
    { loc: '/shop', changefreq: 'daily', priority: '0.9' },
    { loc: '/about', changefreq: 'monthly', priority: '0.6' },
    { loc: '/contact', changefreq: 'monthly', priority: '0.5' },
    { loc: '/auth', changefreq: 'monthly', priority: '0.5' },
    { loc: '/vendor', changefreq: 'monthly', priority: '0.7' },
    { loc: '/privacy-policy', changefreq: 'monthly', priority: '0.3' },
    { loc: '/terms', changefreq: 'monthly', priority: '0.3' },
]

Deno.serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

        const supabase = createClient(supabaseUrl, supabaseServiceKey)

        // Fetch all active products
        const { data: products, error: productsError } = await supabase
            .from('products')
            .select('id, updated_at')
            .eq('status', 'active')
            .order('created_at', { ascending: false })

        if (productsError) {
            console.error('Error fetching products:', productsError)
            throw new Error('Failed to fetch products')
        }

        // Build XML sitemap
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`

        // Add static pages
        for (const page of STATIC_PAGES) {
            xml += `
  <url>
    <loc>${SITE_URL}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
        }

        // Add product pages
        if (products && products.length > 0) {
            for (const product of products) {
                const lastmod = product.updated_at
                    ? new Date(product.updated_at).toISOString().split('T')[0]
                    : new Date().toISOString().split('T')[0]

                xml += `
  <url>
    <loc>${SITE_URL}/product/${product.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
            }
        }

        xml += `
</urlset>`

        console.log(`Generated sitemap with ${STATIC_PAGES.length} static pages and ${products?.length || 0} products`)

        return new Response(xml, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/xml',
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        })
    } catch (error) {
        console.error('Sitemap generation error:', error)
        return new Response(JSON.stringify({ error: 'Failed to generate sitemap' }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json',
            },
        })
    }
})
