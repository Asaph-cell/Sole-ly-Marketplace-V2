import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SneakerLoader } from "./components/ui/SneakerLoader";
import { ScrollToTop } from "./components/ScrollToTop";
import { SmartInstallBanner } from "./components/SmartInstallBanner";

const queryClient = new QueryClient();

// Helper to retry failed lazy load with page reload prompt
const lazyRetry = (componentImport: () => Promise<any>) =>
  React.lazy(async () => {
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem('page-has-been-force-refreshed') || 'false'
    );

    try {
      const component = await componentImport();
      window.sessionStorage.setItem('page-has-been-force-refreshed', 'false');
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // First time seeing this error - automatically refresh once
        window.sessionStorage.setItem('page-has-been-force-refreshed', 'true');
        return window.location.reload() as any;
      }
      // Already tried refreshing, show error to user
      throw error;
    }
  });

const ErrorBoundary = lazyRetry(() => import("./components/ErrorBoundary").then(module => ({ default: module.ErrorBoundary })));
const Navbar = lazyRetry(() => import("./components/Navbar"));
const Footer = lazyRetry(() => import("./components/Footer"));
const Home = lazyRetry(() => import("./pages/Home"));
const Shop = lazyRetry(() => import("./pages/Shop"));
const Product = lazyRetry(() => import("./pages/Product"));
const About = lazyRetry(() => import("./pages/About"));
const Contact = lazyRetry(() => import("./pages/Contact"));
const Vendor = lazyRetry(() => import("./pages/Vendor"));
const Auth = lazyRetry(() => import("./pages/Auth"));
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"));
const VendorRegistration = lazyRetry(() => import("./pages/VendorRegistration"));
const Cart = lazyRetry(() => import("./pages/Cart"));
const Checkout = lazyRetry(() => import("./pages/Checkout"));
const Orders = lazyRetry(() => import("./pages/Orders"));
const Terms = lazyRetry(() => import("./pages/Terms"));
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"));
const VendorDashboard = lazyRetry(() => import("./pages/vendor/VendorDashboard"));
const VendorProducts = lazyRetry(() => import("./pages/vendor/VendorProducts"));
const VendorAddProduct = lazyRetry(() => import("./pages/vendor/VendorAddProduct"));
const VendorAddAccessory = lazyRetry(() => import("./pages/vendor/VendorAddAccessory"));
const VendorListItem = lazyRetry(() => import("./pages/vendor/VendorListItem"));
const VendorEditProduct = lazyRetry(() => import("./pages/vendor/VendorEditProduct"));
const VendorEditAccessory = lazyRetry(() => import("./pages/vendor/VendorEditAccessory"));
// Subscription flow removed in commission model
const VendorSettings = lazyRetry(() => import("./pages/vendor/VendorSettings"));
const VendorOrders = lazyRetry(() => import("./pages/vendor/VendorOrders"));
const VendorRatings = lazyRetry(() => import("./pages/vendor/VendorRatings"));
const VendorDisputes = lazyRetry(() => import("./pages/vendor/VendorDisputes"));
const AdminDashboard = lazyRetry(() => import("./pages/admin/AdminDashboard"));
const AdminDisputes = lazyRetry(() => import("./pages/admin/AdminDisputes"));
const Blog = lazyRetry(() => import("./pages/Blog"));
const BlogPost = lazyRetry(() => import("./pages/BlogPost"));
const HowItWorks = lazyRetry(() => import("./pages/HowItWorks"));
const BuyNow = lazyRetry(() => import("./pages/BuyNow"));
const NotFound = lazyRetry(() => import("./pages/NotFound"));
const WhatsAppButton = lazyRetry(() => import("./components/WhatsAppButton"));

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    transition={{ duration: 0.3 }}
    style={{ willChange: "opacity, transform" }}
  >
    <React.Suspense fallback={<SneakerLoader message="Loading..." />}>
      {children}
    </React.Suspense>
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
        <Route path="/shop" element={<PageWrapper><Shop /></PageWrapper>} />
        <Route path="/product/:id" element={<PageWrapper><Product /></PageWrapper>} />
        <Route path="/about" element={<PageWrapper><About /></PageWrapper>} />
        <Route path="/contact" element={<PageWrapper><Contact /></PageWrapper>} />
        <Route path="/vendor" element={<PageWrapper><Vendor /></PageWrapper>} />
        <Route path="/vendor/register" element={<PageWrapper><VendorRegistration /></PageWrapper>} />
        <Route path="/auth" element={<PageWrapper><Auth /></PageWrapper>} />
        <Route path="/reset-password" element={<PageWrapper><ResetPassword /></PageWrapper>} />
        <Route path="/cart" element={<PageWrapper><Cart /></PageWrapper>} />
        <Route path="/checkout" element={<PageWrapper><Checkout /></PageWrapper>} />
        <Route path="/orders" element={<PageWrapper><Orders /></PageWrapper>} />
        <Route path="/orders/:orderId" element={<PageWrapper><Orders /></PageWrapper>} />
        <Route path="/terms" element={<PageWrapper><Terms /></PageWrapper>} />
        <Route path="/privacy-policy" element={<PageWrapper><PrivacyPolicy /></PageWrapper>} />
        <Route path="/vendor/dashboard" element={<PageWrapper><VendorDashboard /></PageWrapper>} />
        <Route path="/vendor/products" element={<PageWrapper><VendorProducts /></PageWrapper>} />
        <Route path="/vendor/list-item" element={<PageWrapper><VendorListItem /></PageWrapper>} />
        <Route path="/vendor/add-product" element={<PageWrapper><VendorListItem /></PageWrapper>} />
        <Route path="/vendor/add-accessory" element={<PageWrapper><VendorListItem /></PageWrapper>} />
        <Route path="/vendor/edit-product/:id" element={<PageWrapper><VendorEditProduct /></PageWrapper>} />
        <Route path="/vendor/edit-accessory/:id" element={<PageWrapper><VendorEditAccessory /></PageWrapper>} />
        {null}
        <Route path="/vendor/orders" element={<PageWrapper><VendorOrders /></PageWrapper>} />
        <Route path="/vendor/ratings" element={<PageWrapper><VendorRatings /></PageWrapper>} />
        <Route path="/vendor/disputes" element={<PageWrapper><VendorDisputes /></PageWrapper>} />
        <Route path="/vendor/settings" element={<PageWrapper><VendorSettings /></PageWrapper>} />
        <Route path="/admin" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
        <Route path="/admin/dashboard" element={<PageWrapper><AdminDashboard /></PageWrapper>} />
        <Route path="/admin/disputes" element={<PageWrapper><AdminDisputes /></PageWrapper>} />
        <Route path="/blog" element={<PageWrapper><Blog /></PageWrapper>} />
        <Route path="/blog/:id" element={<PageWrapper><BlogPost /></PageWrapper>} />
        <Route path="/how-it-works" element={<PageWrapper><HowItWorks /></PageWrapper>} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<PageWrapper><NotFound /></PageWrapper>} />
      </Routes>
    </AnimatePresence>
  );
};

// ── Standalone routes (no Navbar/Footer) ─────────────────────────────────────
const StandaloneRoutes = () => (
  <Routes>
    <Route path="/buy/:productId" element={
      <React.Suspense fallback={<div className="flex items-center justify-center min-h-screen"><div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}>
        <BuyNow />
      </React.Suspense>
    } />
  </Routes>
);

const Maintenance = lazyRetry(() => import("./pages/Maintenance"));

const AppLayout = () => {
  const location = useLocation();

  // EMERGENCY MAINTENANCE MODE
  // Set to true to hide the website from the public
  const IS_MAINTENANCE_MODE = false;

  if (IS_MAINTENANCE_MODE) {
    return (
      <React.Suspense fallback={<SneakerLoader message="Maintenance..." />}>
        <Maintenance />
      </React.Suspense>
    );
  }

  // Standalone pages — no Navbar/Footer
  if (location.pathname.startsWith("/buy/")) {
    return <StandaloneRoutes />;
  }

  // Hide main navbar/footer on vendor and admin pages (they have their own)
  const isVendorOrAdminPage = location.pathname.startsWith('/vendor/') || location.pathname.startsWith('/admin');

  return (
    <div className="flex flex-col min-h-screen">
      <ScrollToTop />
      <SmartInstallBanner />
      <React.Suspense fallback={<SneakerLoader message="Loading..." />}>
        {!isVendorOrAdminPage && <Navbar />}
        <main className="flex-grow">
          <AnimatedRoutes />
        </main>
        {!isVendorOrAdminPage && <Footer />}
        <WhatsAppButton />
      </React.Suspense>
    </div>
  );
};

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <AppLayout />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
