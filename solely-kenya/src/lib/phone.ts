// Vendors type numbers every which way (0712..., +254 712..., 254712...).
// tel: and wa.me links both want the bare international form: 254712345678.
export const toKenyanIntl = (phone: string | null | undefined): string => {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("254") ? digits : `254${digits.replace(/^0/, "")}`;
};

// One readable shape for display, whatever was typed: "0790 793 213".
// Anything that isn't a 9-digit Kenyan subscriber number is shown as entered.
export const formatKenyanPhone = (phone: string | null | undefined): string => {
  const local = toKenyanIntl(phone).replace(/^254/, "");
  if (local.length !== 9) return phone || "";
  return `0${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
};
