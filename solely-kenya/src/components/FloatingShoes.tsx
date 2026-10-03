import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface Product {
    id: string;
    name: string;
    images: string[];
}

interface FloatingShoePosition {
    x: number;
    y: number;
    size: number;
    rotation: number;
    delay: number;
    duration: number;
}

// 4 floating shoe positions - arranged around the right side of the hero
const POSITIONS: FloatingShoePosition[] = [
    { x: 65, y: 5, size: 120, rotation: 12, delay: 0, duration: 6 },
    { x: 82, y: 20, size: 105, rotation: -8, delay: 0.3, duration: 7 },
    { x: 68, y: 50, size: 115, rotation: 18, delay: 0.6, duration: 5.5 },
    { x: 85, y: 68, size: 100, rotation: -12, delay: 0.9, duration: 6.5 },
];

const TRANSITION_INTERVAL = 8000; // 8 seconds between rotations
const FADE_DURATION = 600; // 600ms fade

const FloatingShoes = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [displayedProducts, setDisplayedProducts] = useState<Product[]>([]);
    const [isTransitioning, setIsTransitioning] = useState<boolean[]>([false, false, false, false]);
    const [mounted, setMounted] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Fetch products from database
    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const { data, error } = await supabase
                    .from("products")
                    .select("id, name, images")
                    .eq("status", "active")
                    .order("created_at", { ascending: false })
                    .limit(16);

                if (error) throw error;

                const productsWithImages = (data || []).filter(
                    (p) => p.images && p.images.length > 0
                );

                setProducts(productsWithImages);

                if (productsWithImages.length >= 4) {
                    setDisplayedProducts(productsWithImages.slice(0, 4));
                } else if (productsWithImages.length > 0) {
                    const initial: Product[] = [];
                    for (let i = 0; i < 4; i++) {
                        initial.push(productsWithImages[i % productsWithImages.length]);
                    }
                    setDisplayedProducts(initial);
                }
            } catch (error) {
                console.error("Error fetching products for floating shoes:", error);
            }
        };

        fetchProducts();
        setMounted(true);
    }, []);

    const rotateProduct = useCallback((index: number) => {
        if (products.length <= 4) return;

        setIsTransitioning(prev => {
            const next = [...prev];
            next[index] = true;
            return next;
        });

        setTimeout(() => {
            setDisplayedProducts(prev => {
                const newDisplayed = [...prev];
                const currentIds = prev.map(p => p.id);
                const availableProducts = products.filter(p => !currentIds.includes(p.id));

                if (availableProducts.length > 0) {
                    const randomIndex = Math.floor(Math.random() * availableProducts.length);
                    newDisplayed[index] = availableProducts[randomIndex];
                } else {
                    const otherProducts = products.filter(p => p.id !== prev[index].id);
                    if (otherProducts.length > 0) {
                        const randomIndex = Math.floor(Math.random() * otherProducts.length);
                        newDisplayed[index] = otherProducts[randomIndex];
                    }
                }

                return newDisplayed;
            });

            setTimeout(() => {
                setIsTransitioning(prev => {
                    const next = [...prev];
                    next[index] = false;
                    return next;
                });
            }, 100);
        }, FADE_DURATION);
    }, [products]);

    useEffect(() => {
        if (products.length <= 4) return;

        const timeoutIds: NodeJS.Timeout[] = [];
        const intervalIds: NodeJS.Timeout[] = [];

        POSITIONS.forEach((_, index) => {
            const staggerDelay = index * 2500;

            const timeoutId = setTimeout(() => {
                rotateProduct(index);

                const intervalId = setInterval(() => {
                    rotateProduct(index);
                }, TRANSITION_INTERVAL + (index * 1000));

                intervalIds.push(intervalId);
            }, staggerDelay + TRANSITION_INTERVAL);

            timeoutIds.push(timeoutId);
        });

        return () => {
            timeoutIds.forEach(id => clearTimeout(id));
            intervalIds.forEach(id => clearInterval(id));
        };
    }, [products.length, rotateProduct]);

    if (!mounted || displayedProducts.length === 0) return null;

    return (
        <>
            {displayedProducts.map((product, index) => {
                const position = POSITIONS[index];
                if (!position) return null;

                const isHovered = hoveredIndex === index;
                const isFading = isTransitioning[index];

                return (
                    <Link
                        key={`floating-shoe-${index}`}
                        to={`/product/${product.id}`}
                        className="floating-shoe hidden md:block"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        style={{
                            position: 'absolute',
                            left: `${position.x}%`,
                            top: `${position.y}%`,
                            width: position.size + 20,
                            height: position.size + 20,
                            padding: '10px',
                            animationDelay: `${position.delay}s`,
                            animationDuration: `${position.duration}s`,
                            transform: `rotate(${position.rotation}deg) ${isHovered ? 'scale(1.15)' : 'scale(1)'}`,
                            zIndex: isHovered ? 100 : 20 + index,
                            cursor: 'pointer',
                            textDecoration: 'none',
                            transition: 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), z-index 0s',
                        }}
                        title={`View ${product.name}`}
                    >
                        {/* Main shoe container */}
                        <div
                            style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: '16px',
                                overflow: 'hidden',
                                position: 'relative',
                                opacity: isFading ? 0 : 1,
                                transform: isFading ? 'scale(0.85)' : 'scale(1)',
                                transition: `opacity ${FADE_DURATION}ms ease-in-out, transform ${FADE_DURATION}ms ease-in-out`,
                                boxShadow: isHovered
                                    ? '0 25px 60px rgba(143, 103, 0, 0.5), 0 0 40px rgba(143, 103, 0, 0.3)'
                                    : '0 20px 40px rgba(0, 0, 0, 0.35)',
                            }}
                        >
                            {/* Product image */}
                            <img
                                src={product.images[0]}
                                alt={`${product.name} - Buy Shoes Online Kenya`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: isHovered ? 'scale(1.1)' : 'scale(1)',
                                    transition: 'transform 0.5s ease-out',
                                }}
                                draggable={false}
                            />

                            {/* Golden glow border */}
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    borderRadius: '16px',
                                    border: isHovered ? '3px solid #c9a227' : '2px solid transparent',
                                    boxShadow: isHovered ? 'inset 0 0 25px rgba(201, 162, 39, 0.4)' : 'none',
                                    transition: 'all 0.4s ease-out',
                                    pointerEvents: 'none',
                                }}
                            />

                            {/* Hover overlay with product info */}
                            <div
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: isHovered
                                        ? 'linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(143, 103, 0, 0.4) 50%, transparent 100%)'
                                        : 'linear-gradient(to top, rgba(0, 0, 0, 0.3) 0%, transparent 50%)',
                                    opacity: 1,
                                    transition: 'all 0.4s ease-out',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'flex-end',
                                    padding: '12px',
                                    pointerEvents: 'none',
                                }}
                            >
                                <span
                                    style={{
                                        color: 'white',
                                        fontSize: isHovered ? '13px' : '11px',
                                        fontWeight: 700,
                                        textShadow: '0 2px 8px rgba(0,0,0,0.8)',
                                        textAlign: 'center',
                                        transform: isHovered ? 'translateY(0)' : 'translateY(8px)',
                                        opacity: isHovered ? 1 : 0.7,
                                        transition: 'all 0.4s ease-out',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {product.name}
                                </span>
                                <span
                                    style={{
                                        color: '#ffd700',
                                        fontSize: '11px',
                                        fontWeight: 600,
                                        textAlign: 'center',
                                        marginTop: '4px',
                                        opacity: isHovered ? 1 : 0,
                                        transform: isHovered ? 'translateY(0)' : 'translateY(10px)',
                                        transition: 'all 0.4s ease-out 0.1s',
                                        textShadow: '0 1px 4px rgba(0,0,0,0.6)',
                                    }}
                                >
                                    Click to shop
                                </span>
                            </div>

                            {/* Shine effect on hover */}
                            <div
                                style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: isHovered ? '100%' : '-100%',
                                    width: '50%',
                                    height: '100%',
                                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                    transform: 'skewX(-25deg)',
                                    transition: 'left 0.6s ease-out',
                                    pointerEvents: 'none',
                                }}
                            />
                        </div>
                    </Link>
                );
            })}
        </>
    );
};

export default FloatingShoes;
