/**
 * SMS via Africa's Talking.
 *
 * Until AFRICASTALKING_API_KEY and AFRICASTALKING_USERNAME are set (the
 * account isn't created yet), every call is a logged no-op so callers can
 * send SMS unconditionally and email/push still go out.
 */

export function normalizeKenyanPhone(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const digits = raw.replace(/\D/g, "");
    if (digits.startsWith("254") && digits.length === 12) return `+${digits}`;
    if (digits.startsWith("0") && digits.length === 10) return `+254${digits.slice(1)}`;
    if ((digits.startsWith("7") || digits.startsWith("1")) && digits.length === 9) return `+254${digits}`;
    return null;
}

export async function sendSms(phone: string | null | undefined, message: string): Promise<boolean> {
    const to = normalizeKenyanPhone(phone);
    if (!to) return false;

    const apiKey = Deno.env.get("AFRICASTALKING_API_KEY");
    const username = Deno.env.get("AFRICASTALKING_USERNAME");
    if (!apiKey || !username) {
        console.log(`[SMS] Not configured, skipped SMS to ${to.slice(0, 7)}***`);
        return false;
    }

    try {
        const body = new URLSearchParams({ username, to, message });
        const senderId = Deno.env.get("AFRICASTALKING_SENDER_ID");
        if (senderId) body.set("from", senderId);

        const host = username === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
        const res = await fetch(`https://${host}/version1/messaging`, {
            method: "POST",
            headers: {
                apiKey,
                Accept: "application/json",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body,
        });
        if (!res.ok) {
            console.error(`[SMS] Africa's Talking returned ${res.status}:`, await res.text());
            return false;
        }
        return true;
    } catch (err) {
        console.error("[SMS] Send failed:", err);
        return false;
    }
}
