import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DashboardSkeleton } from "@/components/skeletons";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatBar, DataTable } from "@/components/admin/AdminShared";
import { Globe, MousePointerClick, Eye, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SiteUsage {
  vendor_id: string;
  store_name: string | null;
  store_link: string | null;
  enabled: boolean;
  founding: boolean;
  first_enabled_at: string | null;
  theme: string;
  offer_active: boolean;
  visits_7d: number;
  visits_30d: number;
  buy_clicks_30d: number;
  whatsapp_clicks_30d: number;
  product_views_30d: number;
  waitlisted: boolean;
  updated_at: string;
}

/**
 * How each seller website is doing: who holds a free spot, and what visitors
 * do on each site. Sellers beyond the free spots appear here as "waiting".
 */
const AdminWebsites = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SiteUsage[]>([]);
  const [limit, setLimit] = useState(10);
  const [waitlist, setWaitlist] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [{ data, error }, { data: setting }, { data: wl }] = await Promise.all([
          (supabase as any).rpc("admin_store_site_usage"),
          supabase.from("platform_settings").select("value").eq("key", "website_free_slots").maybeSingle(),
          (supabase as any).rpc("admin_store_site_waitlist_count"),
        ]);
        if (error) { setFailed(true); return; }
        setRows((data as SiteUsage[]) ?? []);
        if (setting?.value != null) setLimit(Number(setting.value) || 10);
        setWaitlist(Number(wl) || 0);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const live = rows.filter((r) => r.enabled);
  const taken = rows.filter((r) => r.founding).length;
  const sum = (k: keyof SiteUsage) => rows.reduce((n, r) => n + (Number(r[k]) || 0), 0);
  const visits = sum("visits_30d");
  const buyClicks = sum("buy_clicks_30d");

  return (
    <AdminLayout pageTitle="Websites">
      {loading ? (
        <DashboardSkeleton />
      ) : failed ? (
        <p className="text-sm text-muted-foreground">Couldn't load website usage. The website migrations may not be applied yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBar label="Free spots used" value={`${taken} / ${limit}`} icon={Users} progress={Math.min(100, (taken / limit) * 100)}
              hint={waitlist > 0 ? `${waitlist} waiting for paid plans` : "Nobody waiting yet"} />
            <StatBar label="Websites live" value={live.length} icon={Globe} delay={0.05} hint={`${rows.length} built in total`} />
            <StatBar label="Visits, 30 days" value={visits} icon={Eye} delay={0.1} />
            <StatBar label="Buy clicks, 30 days" value={buyClicks} icon={MousePointerClick} delay={0.15}
              hint={visits > 0 ? `${((buyClicks / visits) * 100).toFixed(1)}% of visits` : undefined} />
          </div>

          <div className="rounded-2xl border border-border bg-card shadow-soft p-4">
            <p className="text-xs font-medium text-foreground mb-1">Every website</p>
            <DataTable
              rowKey={(r: SiteUsage) => r.vendor_id}
              rows={rows}
              emptyMessage="No seller has built a website yet"
              columns={[
                {
                  header: "Seller",
                  cell: (r) => (
                    <Link to={`/admin/vendors/${r.vendor_id}`} className="font-medium text-foreground hover:underline truncate">
                      {r.store_name || "Unnamed shop"}
                    </Link>
                  ),
                },
                {
                  header: "Status",
                  cell: (r) =>
                    r.enabled ? (
                      <span className="text-emerald-600 font-medium">Live{r.founding ? " (free)" : ""}</span>
                    ) : r.waitlisted ? (
                      <span className="text-amber-600 font-medium">Waiting</span>
                    ) : (
                      <span className="text-muted-foreground">Not live</span>
                    ),
                },
                { header: "Look", cell: (r) => <span className="capitalize text-muted-foreground">{r.theme}{r.offer_active ? " + offer" : ""}</span> },
                { header: "Visits 7d", align: "right", cell: (r) => r.visits_7d },
                { header: "Visits 30d", align: "right", cell: (r) => r.visits_30d },
                { header: "Product views", align: "right", cell: (r) => r.product_views_30d },
                { header: "Buy clicks", align: "right", cell: (r) => r.buy_clicks_30d },
                { header: "WhatsApp", align: "right", cell: (r) => r.whatsapp_clicks_30d },
                {
                  header: "Went live",
                  align: "right",
                  cell: (r) => (
                    <span className="text-muted-foreground whitespace-nowrap">
                      {r.first_enabled_at ? formatDistanceToNow(new Date(r.first_enabled_at), { addSuffix: true }) : "Never"}
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminWebsites;
