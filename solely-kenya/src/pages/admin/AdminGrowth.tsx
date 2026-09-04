import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatBar, MiniAreaChart, DonutChart, DataTable } from "@/components/admin/AdminShared";
import { SneakerLoader } from "@/components/ui/SneakerLoader";
import { Users, Store, TrendingUp, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface SignupRow {
  id: string;
  full_name: string | null;
  created_at: string;
  signup_source: string | null;
  role: "vendor" | "customer";
}

const RANGE_DAYS = 60;

const AdminGrowth = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<SignupRow[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [{ data: roles }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("profiles").select("id, full_name, created_at, signup_source").order("created_at", { ascending: false }),
      ]);

      const vendorIds = new Set(
        (roles || []).filter((r) => r.role === "vendor" || r.role === "revoked_vendor").map((r) => r.user_id)
      );

      setRows(
        (profiles || []).map((p) => ({
          id: p.id,
          full_name: p.full_name,
          created_at: p.created_at,
          signup_source: p.signup_source,
          role: vendorIds.has(p.id) ? "vendor" : "customer",
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const now = Date.now();
  const rangeStart = now - RANGE_DAYS * 24 * 60 * 60 * 1000;
  const weekStart = now - 7 * 24 * 60 * 60 * 1000;
  const monthStart = now - 30 * 24 * 60 * 60 * 1000;

  const totalUsers = rows.length;
  const totalVendors = rows.filter((r) => r.role === "vendor").length;
  const newThisWeek = rows.filter((r) => new Date(r.created_at).getTime() >= weekStart).length;
  const newThisMonth = rows.filter((r) => new Date(r.created_at).getTime() >= monthStart).length;

  // Daily signup counts for the last RANGE_DAYS, zero-filled so gaps don't
  // just vanish from the chart.
  const dailyMap = new Map<string, number>();
  for (let i = RANGE_DAYS - 1; i >= 0; i--) {
    const d = new Date(now - i * 24 * 60 * 60 * 1000);
    dailyMap.set(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), 0);
  }
  rows
    .filter((r) => new Date(r.created_at).getTime() >= rangeStart)
    .forEach((r) => {
      const key = new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
    });
  const dailySignups = Array.from(dailyMap.entries()).map(([date, signups]) => ({ date, signups }));

  const roleDonut = [
    { name: "Customers", value: totalUsers - totalVendors },
    { name: "Vendors", value: totalVendors },
  ].filter((d) => d.value > 0);

  const sourceCounts = new Map<string, number>();
  rows.forEach((r) => {
    const key = r.signup_source || "Unknown";
    sourceCounts.set(key, (sourceCounts.get(key) || 0) + 1);
  });
  const sourceDonut = Array.from(sourceCounts.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
  const trackedSourceCount = rows.filter((r) => r.signup_source && r.signup_source !== "Unknown").length;

  const recentSignups = rows.slice(0, 10);

  return (
    <AdminLayout pageTitle="Growth">
      {loading ? (
        <SneakerLoader message="Loading..." fullScreen={false} />
      ) : (
        <div className="flex flex-col gap-4">

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatBar label="Total users" value={totalUsers} icon={Users} />
            <StatBar label="Total vendors" value={totalVendors} icon={Store} delay={0.05} />
            <StatBar label="New this week" value={newThisWeek} icon={TrendingUp} delay={0.1} />
            <StatBar label="New this month" value={newThisMonth} icon={TrendingUp} delay={0.15} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-soft p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-medium text-foreground">Signups</p>
                <p className="text-[11px] text-muted-foreground">Last {RANGE_DAYS} days</p>
              </div>
              <MiniAreaChart
                data={dailySignups}
                dataKey="signups"
                gradientId="adminSignups"
                height={220}
                tooltipFormatter={(v) => `${v} signup${v === 1 ? "" : "s"}`}
              />
            </div>

            <div className="rounded-2xl border border-border bg-card shadow-soft p-4">
              <p className="text-xs font-medium text-foreground mb-3">Customers vs vendors</p>
              {roleDonut.length > 0 ? (
                <DonutChart data={roleDonut} height={140} centerLabel="Total" centerValue={totalUsers} />
              ) : (
                <p className="text-xs text-muted-foreground py-8 text-center">No signups yet</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <div className="rounded-2xl border border-border bg-card shadow-soft p-4">
              <p className="text-xs font-medium text-foreground mb-1">Where signups come from</p>
              <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground mb-3">
                <Info size={11} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
                <span>
                  Best-effort browser referrer/UTM tracking, only covers signups since this shipped
                  ({trackedSourceCount} of {totalUsers} tracked). Many mobile apps hide this entirely,
                  so treat it as directional, not exact.
                </span>
              </div>
              {sourceDonut.length > 0 ? (
                <DonutChart data={sourceDonut} height={140} />
              ) : (
                <p className="text-xs text-muted-foreground py-8 text-center">No data yet</p>
              )}
            </div>

            <div className="lg:col-span-2 rounded-2xl border border-border bg-card shadow-soft p-4">
              <p className="text-xs font-medium text-foreground mb-1">Recent signups</p>
              <DataTable
                rowKey={(r: SignupRow) => r.id}
                rows={recentSignups}
                emptyMessage="No signups yet"
                columns={[
                  { header: "Name", cell: (r) => <span className="font-medium text-foreground truncate">{r.full_name || "Unknown"}</span> },
                  {
                    header: "Role",
                    cell: (r) => (
                      <span className="capitalize text-muted-foreground">{r.role}</span>
                    ),
                  },
                  { header: "Source", cell: (r) => <span className="text-muted-foreground">{r.signup_source || "Unknown"}</span> },
                  {
                    header: "Joined",
                    align: "right",
                    cell: (r) => <span className="text-muted-foreground whitespace-nowrap">{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>,
                  },
                ]}
              />
            </div>
          </div>

        </div>
      )}
    </AdminLayout>
  );
};

export default AdminGrowth;
