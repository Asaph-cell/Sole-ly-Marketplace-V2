import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SneakerLoader } from "./components/ui/SneakerLoader";
import { ScrollToTop } from "./components/ScrollToTop";
import { OfflineBanner } from "./components/OfflineBanner";
import { MaintenanceBanner } from "./components/MaintenanceBanner";
import { AdminGuard } from "./components/admin/AdminGuard";
import { usePlatformSettings } from "./hooks/usePlatformSettings";
import { captureFirstTouchSource } from "./lib/attribution";
import { useAuth } from "./hooks/useAuth";

const queryClient = new QueryClient();

// Helper to retry failed lazy load with page reload prompt
const lazyRetry = (componentImport: () => Promise<any>, name: string) =>
  React.lazy(async () => {
    const key = `page-force-refreshed-${name}`;
    const pageHasAlreadyBeenForceRefreshed = JSON.parse(
      window.sessionStorage.getItem(key) || 'false'
    );

    try {
      const component = await componentImport();
      return component;
    } catch (error) {
      if (!pageHasAlreadyBeenForceRefreshed) {
        // First time seeing this error - automatically refresh once
        window.sessionStorage.setItem(key, 'true');
        return window.location.reload() as any;
      }
      // Already tried refreshing, show error to user
      throw error;
    }
  });

const ErrorBoundary = lazyRetry(() => import("./components/ErrorBoundary").then(module => ({ default: module.ErrorBoundary })), "ErrorBoundary");
const Navbar = lazyRetry(() => import("./components/Navbar"), "Navbar");
const Footer = lazyRetry(() => import("./components/Footer"), "Footer");
const Home = lazyRetry(() => import("./pages/Home"), "Home");
const Shop = lazyRetry(() => import("./pages/Shop"), "Shop");
const Product = lazyRetry(() => import("./pages/Product"), "Product");
const About = lazyRetry(() => import("./pages/About"), "About");
const Contact = lazyRetry(() => import("./pages/Contact"), "Contact");
const Vendor = lazyRetry(() => import("./pages/Vendor"), "Vendor");
const VendorStorefront = lazyRetry(() => import("./pages/VendorStorefront"), "VendorStorefront");
const VendorDirectory = lazyRetry(() => import("./pages/VendorDirectory"), "VendorDirectory");
const Auth = lazyRetry(() => import("./pages/Auth"), "Auth");
const ResetPassword = lazyRetry(() => import("./pages/ResetPassword"), "ResetPassword");
const VendorRegistration = lazyRetry(() => import("./pages/VendorRegistration"), "VendorRegistration");
const Cart = lazyRetry(() => import("./pages/Cart"), "Cart");
const Checkout = lazyRetry(() => import("./pages/Checkout"), "Checkout");
const Orders = lazyRetry(() => import("./pages/Orders"), "Orders");
const Terms = lazyRetry(() => import("./pages/Terms"), "Terms");
const PrivacyPolicy = lazyRetry(() => import("./pages/PrivacyPolicy"), "PrivacyPolicy");
const VendorDashboard = lazyRetry(() => import("./pages/vendor/VendorDashboard"), "VendorDashboard");
const VendorProducts = lazyRetry(() => import("./pages/vendor/VendorProducts"), "VendorProducts");
const VendorListItem = lazyRetry(() => import("./pages/vendor/VendorListItem"), "VendorListItem");
const VendorEditProduct = lazyRetry(() => import("./pages/vendor/VendorEditProduct"), "VendorEditProduct");
const VendorEditAccessory = lazyRetry(() => import("./pages/vendor/VendorEditAccessory"), "VendorEditAccessory");
// Subscription flow removed in commission model
const VendorSettings = lazyRetry(() => import("./pages/vendor/VendorSettings"), "VendorSettings");
const VendorOrders = lazyRetry(() => import("./pages/vendor/VendorOrders"), "VendorOrders");
const VendorRatings = lazyRetry(() => import("./pages/vendor/VendorRatings"), "VendorRatings");
const VendorDisputes = lazyRetry(() => import("./pages/vendor/VendorDisputes"), "VendorDisputes");
const VendorPaymentLinks = lazyRetry(() => import("./pages/vendor/VendorPaymentLinks"), "VendorPaymentLinks");
const AdminDashboard = lazyRetry(() => import("./pages/admin/AdminDashboard"), "AdminDashboard");
const AdminDisputes = lazyRetry(() => import("./pages/admin/AdminDisputes"), "AdminDisputes");
const AdminVendors = lazyRetry(() => import("./pages/admin/AdminVendors"), "AdminVendors");
const AdminProducts = lazyRetry(() => import("./pages/admin/AdminProducts"), "AdminProducts");
const AdminComms = lazyRetry(() => import("./pages/admin/AdminComms"), "AdminComms");
const AdminMailingList = lazyRetry(() => import("./pages/admin/AdminMailingList"), "AdminMailingList");
const AdminActivity = lazyRetry(() => import("./pages/admin/AdminActivity"), "AdminActivity");
const AdminSettings = lazyRetry(() => import("./pages/admin/AdminSettings"), "AdminSettings");
const AdminGrowth = lazyRetry(() => import("./pages/admin/AdminGrowth"), "AdminGrowth");
const AdminOrders = lazyRetry(() => import("./pages/admin/AdminOrders"), "AdminOrders");
const AdminVendorDetail = lazyRetry(() => import("./pages/admin/AdminVendorDetail"), "AdminVendorDetail");
const Blog = lazyRetry(() => import("./pages/Blog"), "Blog");
const BlogPost = lazyRetry(() => import("./pages/BlogPost"), "BlogPost");
const HowItWorks = lazyRetry(() => import("./pages/HowItWorks"), "HowItWorks");
const BuyNow = lazyRetry(() => import("./pages/BuyNow"), "BuyNow");
const NotFound = lazyRetry(() => import("./pages/NotFound"), "NotFound");
const ChatBot = lazyRetry(() => import("./components/ChatBot"), "ChatBot");
const Wishlist = lazyRetry(() => import("./pages/Wishlist"), "Wishlist");
const Messages = lazyRetry(() => import("./pages/Messages"), "Messages");
const VendorMessages = lazyRetry(() => import("./pages/vendor/VendorMessages"), "VendorMessages");
const DeliveryDetails = lazyRetry(() => import("./pages/DeliveryDetails"), "DeliveryDetails");
const DeliveryNegotiation = lazyRetry(() => import("./pages/DeliveryNegotiation"), "DeliveryNegotiation");

// Secure Links Feature
const SecureInvoice = lazyRetry(() => import("./pages/checkout/SecureInvoice"), "SecureInvoice");
const GuestTracking = lazyRetry(() => import("./pages/checkout/GuestTracking"), "GuestTracking");

const PageWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    style={{ willChange: "opacity, transform" }}
  >
    <React.Suspense fallback={<SneakerLoader message="Loading..." />}>
      {children}
    </React.Suspense>
  </motion.div>
);

const MainLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col min-h-screen">
    <Navbar />
    <main className="flex-grow">{children}</main>
    <Footer />
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <Routes location={location} key={location.pathname}>
      {/* Routes WITH Navbar and Footer */}
      <Route path="/" element={<PageWrapper><MainLayout><Home /></MainLayout></PageWrapper>} />
      <Route path="/shop" element={<PageWrapper><MainLayout><Shop /></MainLayout></PageWrapper>} />
      <Route path="/product/:id" element={<PageWrapper><MainLayout><Product /></MainLayout></PageWrapper>} />
      <Route path="/about" element={<PageWrapper><MainLayout><About /></MainLayout></PageWrapper>} />
      <Route path="/contact" element={<PageWrapper><MainLayout><Contact /></MainLayout></PageWrapper>} />
      <Route path="/vendors" element={<PageWrapper><MainLayout><VendorDirectory /></MainLayout></PageWrapper>} />
      <Route path="/vendor" element={<PageWrapper><MainLayout><Vendor /></MainLayout></PageWrapper>} />
      {/* New Vanity URL Route */}
      <Route path="/store/:storeLink" element={<PageWrapper><MainLayout><VendorStorefront /></MainLayout></PageWrapper>} />
      {/* Legacy Route */}
      <Route path="/shop/:vendorId" element={<PageWrapper><MainLayout><VendorStorefront /></MainLayout></PageWrapper>} />
      <Route path="/vendor/register" element={<PageWrapper><MainLayout><VendorRegistration /></MainLayout></PageWrapper>} />
      <Route path="/auth" element={<PageWrapper><MainLayout><Auth /></MainLayout></PageWrapper>} />
      <Route path="/reset-password" element={<PageWrapper><MainLayout><ResetPassword /></MainLayout></PageWrapper>} />
      <Route path="/cart" element={<PageWrapper><MainLayout><Cart /></MainLayout></PageWrapper>} />
      <Route path="/checkout" element={<PageWrapper><MainLayout><Checkout /></MainLayout></PageWrapper>} />
      <Route path="/orders" element={<PageWrapper><MainLayout><Orders /></MainLayout></PageWrapper>} />
      <Route path="/orders/:orderId" element={<PageWrapper><MainLayout><Orders /></MainLayout></PageWrapper>} />
      <Route path="/terms" element={<PageWrapper><MainLayout><Terms /></MainLayout></PageWrapper>} />
      <Route path="/privacy-policy" element={<PageWrapper><MainLayout><PrivacyPolicy /></MainLayout></PageWrapper>} />
      <Route path="/blog" element={<PageWrapper><MainLayout><Blog /></MainLayout></PageWrapper>} />
      <Route path="/blog/:id" element={<PageWrapper><MainLayout><BlogPost /></MainLayout></PageWrapper>} />
      <Route path="/how-it-works" element={<PageWrapper><MainLayout><HowItWorks /></MainLayout></PageWrapper>} />
      <Route path="/wishlist" element={<PageWrapper><MainLayout><Wishlist /></MainLayout></PageWrapper>} />
      <Route path="/messages" element={<PageWrapper><MainLayout><Messages /></MainLayout></PageWrapper>} />
      <Route path="/delivery-details" element={<PageWrapper><MainLayout><DeliveryDetails /></MainLayout></PageWrapper>} />
      <Route path="/delivery-negotiation" element={<PageWrapper><MainLayout><DeliveryNegotiation /></MainLayout></PageWrapper>} />

      {/* Routes WITHOUT Navbar and Footer (Vendor & Admin Dashboards) */}
      <Route path="/vendor/dashboard" element={<PageWrapper><VendorDashboard /></PageWrapper>} />
      <Route path="/vendor/products" element={<PageWrapper><VendorProducts /></PageWrapper>} />
      <Route path="/vendor/list-item" element={<PageWrapper><VendorListItem /></PageWrapper>} />
      <Route path="/vendor/add-product" element={<PageWrapper><VendorListItem /></PageWrapper>} />
      <Route path="/vendor/add-accessory" element={<PageWrapper><VendorListItem /></PageWrapper>} />
      <Route path="/vendor/edit-product/:id" element={<PageWrapper><VendorEditProduct /></PageWrapper>} />
      <Route path="/vendor/edit-accessory/:id" element={<PageWrapper><VendorEditAccessory /></PageWrapper>} />
      <Route path="/vendor/orders" element={<PageWrapper><VendorOrders /></PageWrapper>} />
      <Route path="/vendor/ratings" element={<PageWrapper><VendorRatings /></PageWrapper>} />
      <Route path="/vendor/disputes" element={<PageWrapper><VendorDisputes /></PageWrapper>} />
      <Route path="/vendor/payment-links" element={<PageWrapper><VendorPaymentLinks /></PageWrapper>} />
      <Route path="/vendor/settings" element={<PageWrapper><VendorSettings /></PageWrapper>} />
      <Route path="/vendor/messages" element={<PageWrapper><VendorMessages /></PageWrapper>} />
      <Route path="/admin" element={<PageWrapper><AdminGuard><AdminDashboard /></AdminGuard></PageWrapper>} />
      <Route path="/admin/dashboard" element={<PageWrapper><AdminGuard><AdminDashboard /></AdminGuard></PageWrapper>} />
      <Route path="/admin/disputes" element={<PageWrapper><AdminGuard><AdminDisputes /></AdminGuard></PageWrapper>} />
      <Route path="/admin/vendors" element={<PageWrapper><AdminGuard><AdminVendors /></AdminGuard></PageWrapper>} />
      <Route path="/admin/products" element={<PageWrapper><AdminGuard><AdminProducts /></AdminGuard></PageWrapper>} />
      <Route path="/admin/comms" element={<PageWrapper><AdminGuard><AdminComms /></AdminGuard></PageWrapper>} />
      <Route path="/admin/mailing-list" element={<PageWrapper><AdminGuard><AdminMailingList /></AdminGuard></PageWrapper>} />
      <Route path="/admin/activity" element={<PageWrapper><AdminGuard><AdminActivity /></AdminGuard></PageWrapper>} />
      <Route path="/admin/settings" element={<PageWrapper><AdminGuard><AdminSettings /></AdminGuard></PageWrapper>} />
      <Route path="/admin/growth" element={<PageWrapper><AdminGuard><AdminGrowth /></AdminGuard></PageWrapper>} />
      <Route path="/admin/orders" element={<PageWrapper><AdminGuard><AdminOrders /></AdminGuard></PageWrapper>} />
      <Route path="/admin/vendors/:vendorId" element={<PageWrapper><AdminGuard><AdminVendorDetail /></AdminGuard></PageWrapper>} />

      {/* Standalone routes */}
      <Route path="/buy/:productId" element={<PageWrapper><BuyNow /></PageWrapper>} />
      <Route path="/pay/:id" element={<PageWrapper><SecureInvoice /></PageWrapper>} />
      <Route path="/track/:orderId" element={<PageWrapper><GuestTracking /></PageWrapper>} />

      <Route path="*" element={<PageWrapper><MainLayout><NotFound /></MainLayout></PageWrapper>} />
    </Routes>
  );
};

const Maintenance = lazyRetry(() => import("./pages/Maintenance"), "Maintenance");

const AppLayout = () => {
  const location = useLocation();

  // Admin-controlled emergency kill switch (Admin > Settings > Feature
  // flags). Defaults to off via usePlatformSettings' initialData, so a
  // normal page load never blocks on this fetch - only a real toggle
  // (rare) causes a swap to the maintenance page once it resolves.
  const { data: platformSettings } = usePlatformSettings();

  // A logged-in admin is exempt everywhere, not just on /admin - otherwise
  // turning maintenance mode on would block the admin from browsing their
  // own live site to check on things while it's up for nobody else. /auth
  // is always exempt too, so an admin who isn't currently logged in (fresh
  // browser, expired session) can still sign in and reach /admin at all.
  const { isAdmin } = useAuth();
  const isMaintenanceExempt = isAdmin || location.pathname.startsWith("/auth");

  if (platformSettings.maintenanceMode && !isMaintenanceExempt) {
    return (
      <React.Suspense fallback={<SneakerLoader message="Maintenance..." />}>
        <Maintenance />
      </React.Suspense>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <MaintenanceBanner />
      <OfflineBanner />
      <ScrollToTop />
      <React.Suspense fallback={<SneakerLoader message="Loading..." />}>
        <AnimatedRoutes />
        <ChatBot />
      </React.Suspense>
    </div>
  );
};

const App = () => {
  React.useEffect(() => {
    captureFirstTouchSource();
  }, []);

  return (
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
};

export default App;
