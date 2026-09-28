// Store setup levels. Level 1 (registration) is all a seller needs to list,
// sell and withdraw; levels 2 and 3 add visibility and the Verified badge.

export type SetupProfile = {
  store_name?: string | null;
  whatsapp_number?: string | null;
  mpesa_number?: string | null;
  store_logo_url?: string | null;
  store_description?: string | null;
  vendor_city?: string | null;
  vendor_county?: string | null;
  vendor_address_line1?: string | null;
  kyc_status?: string | null;
  kyc_reject_reason?: string | null;
};

export type SetupItem = {
  key: string;
  label: string;
  done: boolean;
  points: number;
};

const filled = (v?: string | null) => !!v && v.trim().length > 0;

export const getStoreSetup = (p: SetupProfile | null | undefined) => {
  const profile = p ?? {};
  const verification = profile.kyc_status ?? "not_required";

  const level1: SetupItem[] = [
    {
      key: "basics",
      label: "Store name, contact number and M-Pesa",
      done: filled(profile.store_name) && filled(profile.whatsapp_number) && filled(profile.mpesa_number),
      points: 40,
    },
  ];
  const level2: SetupItem[] = [
    { key: "logo", label: "Store logo", done: filled(profile.store_logo_url), points: 10 },
    { key: "description", label: "Short description", done: filled(profile.store_description), points: 10 },
    { key: "location", label: "City and county", done: filled(profile.vendor_city) && filled(profile.vendor_county), points: 10 },
    { key: "address", label: "Pickup address", done: filled(profile.vendor_address_line1), points: 10 },
  ];
  // Submitting earns half the level; approval completes it.
  const level3: SetupItem[] = [
    {
      key: "verification",
      label: "ID or business registration",
      done: verification === "approved",
      points: verification === "approved" ? 20 : verification === "pending" ? 10 : 0,
    },
  ];

  const itemPoints = (i: SetupItem) => (i.key === "verification" ? i.points : i.done ? i.points : 0);
  const percent = [...level1, ...level2, ...level3].reduce((sum, i) => sum + itemPoints(i), 0);

  const level2Done = level2.every((i) => i.done);
  const nextStep = !level2Done
    ? level2.find((i) => !i.done)!.label
    : verification === "approved"
      ? null
      : verification === "pending"
        ? null
        : "Get verified";

  return {
    percent,
    level1,
    level2,
    level3,
    level2Done,
    verification: verification as "not_required" | "pending" | "approved" | "rejected",
    rejectReason: profile.kyc_reject_reason ?? null,
    nextStep,
    complete: percent >= 100,
  };
};
