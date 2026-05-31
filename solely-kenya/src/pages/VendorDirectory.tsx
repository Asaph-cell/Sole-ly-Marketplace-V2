import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Store, MapPin, ShieldCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

const VendorDirectory = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    setLoading(true);
    // Fetch all profiles that have listed items (or just fetch all for now)
    const { data, error } = await supabase
      .from("profiles")
      .select(`
        id, store_name, full_name, is_verified, vendor_city, vendor_county, store_link
      `)
      .order("is_verified", { ascending: false });

    if (!error && data) {
      // Filter out users who haven't set up a store name or aren't vendors
      const activeVendors = data.filter(v => v.store_name);
      setVendors(activeVendors);
    }
    setLoading(false);
  };

  const filteredVendors = vendors.filter(v => 
    (v.store_name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (v.vendor_city?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-muted/20 pb-20">
      <SEO title="All Stores & Vendors | Sole-ly" description="Browse all verified vendors and stores on Sole-ly Marketplace." />
      
      {/* Header */}
      <div className="bg-primary/5 border-b border-primary/10">
        <div className="container mx-auto px-4 py-12 md:py-16 text-center">
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">Official Stores & Vendors</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8">
            Shop directly from your favorite Instagram sellers and local brands with full Escrow protection.
          </p>
          
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
            <Input 
              placeholder="Search for a store or city (e.g. Nairobi)" 
              className="pl-10 h-12 rounded-full border-primary/20 focus-visible:ring-primary/30 text-base"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="h-48 bg-muted rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : filteredVendors.length === 0 ? (
          <div className="text-center py-20">
            <Store className="mx-auto h-16 w-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-xl font-bold">No stores found</h3>
            <p className="text-muted-foreground">Try adjusting your search criteria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredVendors.map((vendor) => {
              const name = vendor.store_name || vendor.full_name;
              const location = vendor.vendor_city ? `${vendor.vendor_city}${vendor.vendor_county ? `, ${vendor.vendor_county}` : ''}` : null;
              
              return (
                <Link 
                  key={vendor.id} 
                  to={`/store/${vendor.store_link || vendor.id}`}
                  className="bg-card rounded-2xl border border-border p-6 hover:shadow-md hover:border-primary/30 transition-all group flex flex-col items-center text-center gap-4"
                >
                  <div className="h-20 w-20 rounded-full bg-primary/10 text-primary border-4 border-background flex items-center justify-center text-3xl font-black shadow-sm group-hover:scale-105 transition-transform">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  
                  <div className="w-full">
                    <h3 className="font-bold text-lg flex items-center justify-center gap-1.5 truncate">
                      {name}
                      {vendor.is_verified && <ShieldCheck size={18} className="text-primary shrink-0" fill="currentColor" stroke="white" />}
                    </h3>
                    
                    {location && (
                      <p className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1 truncate">
                        <MapPin size={14} /> {location}
                      </p>
                    )}
                  </div>
                  
                  <div className="mt-auto pt-4 w-full">
                    <div className="w-full py-2 bg-muted/50 rounded-xl text-sm font-semibold group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                      Visit Store
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default VendorDirectory;
