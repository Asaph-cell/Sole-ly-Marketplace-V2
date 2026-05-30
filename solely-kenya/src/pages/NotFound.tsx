import { useLocation, Link } from "react-router-dom";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  baseSize: number;
  jitterPhase: number;
  jitterSpeed: number;
  magnetStrength: number;
  hue: number;
  opacity: number;
}

const NotFound = () => {
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const animationRef = useRef<number>();
  const [score, setScore] = useState(0);

  const createParticles = useCallback((count: number = 80) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const particles: Particle[] = [];
    for (let i = 0; i < count; i++) {
      const baseSize = Math.random() * 3 + 2; // Smaller: 2-5px
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 0,
        vy: 0,
        size: baseSize,
        baseSize,
        jitterPhase: Math.random() * Math.PI * 2,
        jitterSpeed: Math.random() * 0.03 + 0.01, // Slower jitter
        magnetStrength: Math.random() * 0.015 + 0.008, // Slower attraction
        hue: 40 + Math.random() * 15, // Gold range
        opacity: Math.random() * 0.5 + 0.5, // Brighter: 50-100% opacity
      });
    }
    particlesRef.current = particles;
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    mouseRef.current = { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const handleClick = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in e && e.type === 'touchstart') {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = e.clientX;
      clientY = e.clientY;
    } else return;

    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    particlesRef.current.forEach((p) => {
      const dist = Math.sqrt((clickX - p.x) ** 2 + (clickY - p.y) ** 2);
      if (dist < p.size + 20) {
        setScore(prev => prev + 1);
        p.x = Math.random() * canvas.width;
        p.y = Math.random() * canvas.height;
        p.vx = (Math.random() - 0.5) * 3;
        p.vy = (Math.random() - 0.5) * 3;
      }
    });
  }, []);

  const animate = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    // Clear with white background
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const mouse = mouseRef.current;
    const hasValidMouse = mouse.x > 0 && mouse.y > 0;

    particlesRef.current.forEach((p) => {
      // Gentle firefly jitter
      p.jitterPhase += p.jitterSpeed;
      const jitterX = Math.sin(p.jitterPhase) * 0.5;
      const jitterY = Math.cos(p.jitterPhase * 1.3) * 0.5;

      if (hasValidMouse) {
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Gentle magnetic easing
        const magnetForce = Math.min(p.magnetStrength * (200 / (dist + 80)), 0.06);

        p.vx += dx * magnetForce;
        p.vy += dy * magnetForce;
      }

      // Apply gentle jitter
      p.vx += jitterX * 0.05;
      p.vy += jitterY * 0.05;

      // Strong damping for slower movement
      p.vx *= 0.95;
      p.vy *= 0.95;

      // Update position
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around screen edges
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.y > canvas.height + 10) p.y = -10;

      // Subtle pulsing
      p.size = p.baseSize + Math.sin(p.jitterPhase * 2) * 0.5;

      // Draw soft glowing particle
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3);
      gradient.addColorStop(0, `hsla(${p.hue}, 60%, 50%, ${p.opacity})`);
      gradient.addColorStop(0.5, `hsla(${p.hue}, 55%, 45%, ${p.opacity * 0.4})`);
      gradient.addColorStop(1, `hsla(${p.hue}, 50%, 40%, 0)`);

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Small solid core
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 65%, 55%, ${p.opacity * 0.8})`;
      ctx.fill();
    });

    // Subtle connections
    ctx.lineWidth = 0.3;
    for (let i = 0; i < particlesRef.current.length; i++) {
      const p1 = particlesRef.current[i];
      for (let j = i + 1; j < Math.min(i + 8, particlesRef.current.length); j++) {
        const p2 = particlesRef.current[j];
        const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
        if (dist < 50) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = `hsla(45, 50%, 50%, ${(50 - dist) / 400})`;
          ctx.stroke();
        }
      }
    }

    animationRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    console.error("404:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      createParticles(80);
    };

    resize();
    window.addEventListener("resize", resize);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleMouseMove, { passive: true });
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("touchstart", handleClick, { passive: true });
    canvas.addEventListener("mouseleave", () => { mouseRef.current = { x: -1000, y: -1000 }; });
    animate();

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [createParticles, animate, handleMouseMove, handleClick]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ touchAction: "none" }} />

      {/* Score */}
      <div className="fixed top-4 right-4 bg-primary/80 text-primary-foreground px-4 py-2 rounded-full font-bold shadow-md z-20 text-sm">
        ✨ {score}
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pointer-events-none">
        <div className="text-center max-w-md pointer-events-auto">
          <div className="bg-white/60 backdrop-blur-lg border border-primary/10 rounded-3xl p-6 sm:p-8 shadow-lg">
            <div className="animate-bounce mb-4">
              <svg className="w-14 h-14 mx-auto text-primary" viewBox="0 0 64 64" fill="currentColor">
                <path d="M60 38c0 0-4-2-8-2s-8 2-12 2-8-2-12-2-8 2-12 2-8-2-8-2c-2 0-4 2-4 4v4c0 2 2 4 4 4h48c2 0 4-2 4-4v-4c0-2-2-4-4-4zM12 44c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm10 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm10 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM56 32l-8-16c-1-2-3-4-6-4H22c-3 0-5 2-6 4L8 32h48z" />
              </svg>
            </div>

            <p className="text-sm text-muted-foreground mb-1">Oops!</p>
            <h1 className="text-5xl font-black text-primary mb-2">404</h1>
            <h2 className="text-lg font-bold mb-1">This shoe walked away</h2>
            <p className="text-muted-foreground text-sm mb-4">Let's get you back on track</p>

            <div className="bg-primary/5 rounded-xl p-3 mb-6 border border-primary/10">
              <p className="text-xs text-muted-foreground">Move to attract • Click to pop!</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" asChild><Link to="/"><Home size={16} strokeWidth={1.5} className=" mr-2" />Go Home</Link></Button>
              <Button size="lg" variant="outline" asChild><Link to="/shop"><Search size={16} strokeWidth={1.5} className=" mr-2" />Shop</Link></Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
