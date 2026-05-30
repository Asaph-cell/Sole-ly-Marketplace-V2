import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import satori, { init as initSatori } from 'https://esm.sh/satori@0.10.13/wasm'
import initYoga from 'https://esm.sh/yoga-wasm-web@0.3.3'
import { Resvg, initWasm as initResvgWasm } from 'https://esm.sh/@resvg/resvg-wasm@2.4.1'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BRAND_GOLD = '#c8b34d'
const WIDTH = 1200
const HEIGHT = 630

// ── Initialization (runs once per cold start) ──────────────────────
let initialized = false
let fontRegular: ArrayBuffer
let fontBold: ArrayBuffer

async function ensureInitialized() {
    if (initialized) return

    // 1. Initialize Yoga (CSS layout engine used by Satori)
    const yogaWasm = await fetch(
        'https://cdn.jsdelivr.net/npm/yoga-wasm-web@0.3.3/dist/yoga.wasm'
    ).then(r => r.arrayBuffer())
    const yoga = await initYoga(yogaWasm)
    initSatori(yoga)

    // 2. Initialize Resvg (SVG → PNG rasterizer)
    const resvgWasm = await fetch(
        'https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.4.1/index_bg.wasm'
    ).then(r => r.arrayBuffer())
    await initResvgWasm(resvgWasm)

    // 3. Load fonts
    fontRegular = await fetch(
        'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff'
    ).then(r => r.arrayBuffer())
    fontBold = await fetch(
        'https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff'
    ).then(r => r.arrayBuffer())

    initialized = true
    console.log('OG image generator initialized successfully')
}

// ── Helpers ────────────────────────────────────────────────────────
function formatPrice(price: number): string {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
    let binary = ''
    const chunkSize = 8192
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
        binary += String.fromCharCode(...chunk)
    }
    return btoa(binary)
}

function resolveImageUrl(
    imageValue: string | undefined,
    supabaseUrl: string
): string {
    if (!imageValue) return ''
    if (imageValue.startsWith('http')) return imageValue
    if (imageValue.startsWith('/')) return `https://solelymarketplace.com${imageValue}`
    return `${supabaseUrl}/storage/v1/object/public/product-images/${imageValue}`
}

// ── Card Layout Builder ────────────────────────────────────────────
function buildCard(product: {
    name: string
    price_ksh: number
    brand?: string
    imageDataUri: string
}) {
    const { name, price_ksh, brand, imageDataUri } = product
    const displayName = name.length > 45 ? name.substring(0, 45) + '…' : name

    return {
        type: 'div',
        props: {
            style: {
                display: 'flex',
                width: '100%',
                height: '100%',
                backgroundColor: '#ffffff',
                fontFamily: 'Inter',
            },
            children: [
                // ─── Left: Product Image ───
                {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            width: '440px',
                            height: '100%',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: '#f5f5f5',
                            padding: '35px',
                        },
                        children: imageDataUri
                            ? {
                                type: 'img',
                                props: {
                                    src: imageDataUri,
                                    width: 370,
                                    height: 370,
                                    style: {
                                        objectFit: 'contain',
                                        borderRadius: '20px',
                                    },
                                },
                            }
                            : {
                                type: 'div',
                                props: {
                                    style: {
                                        width: '370px',
                                        height: '370px',
                                        backgroundColor: '#e8e8e8',
                                        borderRadius: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#aaa',
                                        fontSize: '28px',
                                    },
                                    children: '👟',
                                },
                            },
                    },
                },

                // ─── Right: Product Details ───
                {
                    type: 'div',
                    props: {
                        style: {
                            display: 'flex',
                            flexDirection: 'column',
                            flex: 1,
                            padding: '50px 50px 35px 50px',
                            justifyContent: 'space-between',
                        },
                        children: [
                            // Top section: Brand + Name + Price
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        display: 'flex',
                                        flexDirection: 'column',
                                    },
                                    children: [
                                        // Brand badge
                                        brand
                                            ? {
                                                type: 'div',
                                                props: {
                                                    style: {
                                                        fontSize: '18px',
                                                        color: '#888888',
                                                        textTransform: 'uppercase',
                                                        letterSpacing: '3px',
                                                        marginBottom: '16px',
                                                        fontWeight: 400,
                                                    },
                                                    children: brand,
                                                },
                                            }
                                            : null,
                                        // Product name
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    fontSize: '44px',
                                                    fontWeight: 700,
                                                    color: '#1a1a1a',
                                                    lineHeight: 1.15,
                                                    marginBottom: '28px',
                                                },
                                                children: displayName,
                                            },
                                        },
                                        // Price
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    fontSize: '40px',
                                                    fontWeight: 700,
                                                    color: BRAND_GOLD,
                                                },
                                                children: `KES ${formatPrice(price_ksh)}`,
                                            },
                                        },
                                    ].filter(Boolean),
                                },
                            },
                            // Bottom section: Branding bar
                            {
                                type: 'div',
                                props: {
                                    style: {
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '14px',
                                        borderTop: '2px solid #f0f0f0',
                                        paddingTop: '20px',
                                    },
                                    children: [
                                        // Gold circle logo
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    width: '42px',
                                                    height: '42px',
                                                    backgroundColor: BRAND_GOLD,
                                                    borderRadius: '50%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: 'white',
                                                    fontSize: '22px',
                                                    fontWeight: 700,
                                                },
                                                children: 'S',
                                            },
                                        },
                                        // Site URL
                                        {
                                            type: 'div',
                                            props: {
                                                style: {
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                },
                                                children: [
                                                    {
                                                        type: 'div',
                                                        props: {
                                                            style: {
                                                                fontSize: '20px',
                                                                fontWeight: 700,
                                                                color: '#333',
                                                            },
                                                            children: 'Solely',
                                                        },
                                                    },
                                                    {
                                                        type: 'div',
                                                        props: {
                                                            style: {
                                                                fontSize: '16px',
                                                                color: '#999',
                                                            },
                                                            children: 'solelymarketplace.com',
                                                        },
                                                    },
                                                ],
                                            },
                                        },
                                    ],
                                },
                            },
                        ],
                    },
                },
            ],
        },
    }
}

// ── Main Handler ───────────────────────────────────────────────────
Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders })
    }

    try {
        const url = new URL(req.url)
        const productId = url.searchParams.get('id')

        if (!productId) {
            return new Response('Missing product ID', {
                status: 400,
                headers: corsHeaders,
            })
        }

        // Fetch product from Supabase
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        const { data: product, error } = await supabase
            .from('products')
            .select('name, price_ksh, images, brand')
            .eq('id', productId)
            .single()

        if (error || !product) {
            console.error('Product not found:', productId, error)
            return Response.redirect('https://solelymarketplace.com/og-image.png', 302)
        }

        // Resolve and fetch product image
        const imageUrl = resolveImageUrl(product.images?.[0], supabaseUrl)
        let imageDataUri = ''

        if (imageUrl) {
            try {
                const imgRes = await fetch(imageUrl)
                if (imgRes.ok) {
                    const imgBuf = await imgRes.arrayBuffer()
                    // Skip embedding if image is too large (>3MB)
                    if (imgBuf.byteLength < 3 * 1024 * 1024) {
                        const base64 = uint8ArrayToBase64(new Uint8Array(imgBuf))
                        const contentType = imgRes.headers.get('content-type') || 'image/jpeg'
                        imageDataUri = `data:${contentType};base64,${base64}`
                    }
                }
            } catch (e) {
                console.error('Failed to fetch product image:', e)
            }
        }

        // Initialize WASM modules (first call only)
        await ensureInitialized()

        // Build the card layout
        const cardElement = buildCard({
            name: product.name,
            price_ksh: product.price_ksh,
            brand: product.brand,
            imageDataUri,
        })

        // Generate SVG with Satori
        const svg = await satori(cardElement, {
            width: WIDTH,
            height: HEIGHT,
            fonts: [
                { name: 'Inter', data: fontRegular, weight: 400, style: 'normal' },
                { name: 'Inter', data: fontBold, weight: 700, style: 'normal' },
            ],
        })

        // Convert SVG → PNG with Resvg
        const resvg = new Resvg(svg, {
            fitTo: { mode: 'width', value: WIDTH },
        })
        const pngData = resvg.render()
        const pngBuffer = pngData.asPng()

        return new Response(pngBuffer, {
            headers: {
                ...corsHeaders,
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=86400, s-maxage=604800',
            },
        })
    } catch (e) {
        console.error('OG image generation error:', e)
        // Graceful fallback: redirect to default OG image
        return Response.redirect('https://solelymarketplace.com/og-image.png', 302)
    }
})
