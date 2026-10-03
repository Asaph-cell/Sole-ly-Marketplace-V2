import { Fragment, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useSignedChatImages } from "@/lib/chat";
import { format, isToday, isYesterday, differenceInMinutes, isSameDay } from "date-fns";
import { Check, CheckCheck, Truck, Handshake } from "lucide-react";

export interface ChatMessage {
  id: string;
  message: string;
  sender_id: string;
  sender_role?: string;
  message_type?: string | null;
  metadata?: any;
  created_at: string;
  is_read: boolean;
  read_at?: string | null;
}

const dayLabel = (d: Date) => (isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : format(d, "EEE d MMM"));
const timeLabel = (d: Date) => format(d, "h:mm a").toLowerCase();

// Consecutive messages from the same person within 5 minutes read as one burst.
const sameGroup = (a?: ChatMessage, b?: ChatMessage) =>
  !!a && !!b &&
  a.sender_id === b.sender_id &&
  (a.message_type ?? "text") === "text" && (b.message_type ?? "text") === "text" &&
  Math.abs(differenceInMinutes(new Date(b.created_at), new Date(a.created_at))) < 5;

const Ticks = ({ read }: { read: boolean }) =>
  read
    ? <CheckCheck size={14} strokeWidth={2.25} className="text-[hsl(205_80%_45%)]" aria-label="Seen" />
    : <Check size={14} strokeWidth={2.25} className="text-foreground/45" aria-label="Sent" />;

const DeliveryOffer = ({ msg, own }: { msg: ChatMessage; own: boolean }) => {
  const fee = Number(msg.metadata?.delivery_fee ?? 0);
  const method = msg.metadata?.delivery_method as string | null;
  return (
    <div className={`w-[15.5rem] max-w-[82%] rounded-2xl border ${own ? "border-primary/40 bg-cream" : "border-border bg-card"} px-3.5 py-3 shadow-sm`}>
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Truck size={13} strokeWidth={2} /> {own ? "Your delivery offer" : "Delivery offer"}
      </p>
      <p className="mt-1 font-display text-2xl leading-none tabular-nums">
        {fee === 0 ? "Free" : `KES ${fee.toLocaleString()}`}
      </p>
      {method && <p className="mt-1 text-xs text-muted-foreground">{method === "Pick Up" ? "Buyer collects" : `via ${method}`}</p>}
      <p className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
        {timeLabel(new Date(msg.created_at))}
        {own && <Ticks read={msg.is_read} />}
      </p>
    </div>
  );
};

const PhotoMessage = ({ msg, own }: { msg: ChatMessage; own: boolean }) => {
  const paths: string[] = Array.isArray(msg.metadata?.images) ? msg.metadata.images : [];
  const urls = useSignedChatImages(paths);
  const [open, setOpen] = useState<number | null>(null);
  const caption = msg.message && !/^\d* ?photos?$/i.test(msg.message) ? msg.message : "";
  const many = paths.length > 1;

  return (
    <div className={`w-[15rem] max-w-[78%] overflow-hidden rounded-2xl ${own ? "rounded-br-md bg-[hsl(44_72%_87%)] dark:bg-[hsl(40_28%_22%)]" : "rounded-bl-md bg-card"} p-1 shadow-sm`}>
      <div className={`grid gap-1 ${many ? "grid-cols-2" : "grid-cols-1"}`}>
        {paths.map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => setOpen(i)}
            aria-label={`Open photo ${i + 1}`}
            className={`relative overflow-hidden rounded-xl bg-foreground/10 ${many ? "aspect-square" : "aspect-[4/5]"}`}
          >
            {urls[i] && <img src={urls[i]} alt={`Photo ${i + 1}`} loading="lazy" className="h-full w-full object-cover" />}
          </button>
        ))}
      </div>
      <div className="px-2 pb-1 pt-1.5">
        {caption && <p className="text-[14.5px] leading-snug whitespace-pre-line break-words">{caption}</p>}
        <p className="flex items-center justify-end gap-0.5 text-[10.5px] text-muted-foreground">
          {timeLabel(new Date(msg.created_at))}
          {own && <Ticks read={msg.is_read} />}
        </p>
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-3xl border-0 bg-black/95 p-2 [&>button]:text-white">
          <DialogTitle className="sr-only">Photo {open !== null ? open + 1 : ""} of {paths.length}</DialogTitle>
          {open !== null && urls[open] && (
            <img src={urls[open]} alt={`Photo ${open + 1}`} className="mx-auto max-h-[80vh] w-auto rounded-lg object-contain" />
          )}
          {many && (
            <div className="flex justify-center gap-2 pb-1 pt-2">
              {paths.map((p, i) => (
                <button key={p} type="button" onClick={() => setOpen(i)} aria-label={`Photo ${i + 1}`}
                  className={`h-12 w-12 overflow-hidden rounded-lg ring-2 ${open === i ? "ring-white" : "ring-transparent opacity-60"}`}>
                  {urls[i] && <img src={urls[i]} alt="" className="h-full w-full object-cover" />}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const ChatMessages = ({
  messages,
  currentUserId,
  otherTyping = false,
}: {
  messages: ChatMessage[];
  currentUserId: string;
  otherTyping?: boolean;
}) => {
  // The newest message I sent that the other person has seen gets the "Seen" note.
  const lastOwnIndex = messages.map((m) => m.sender_id === currentUserId).lastIndexOf(true);
  const lastOwn = lastOwnIndex >= 0 ? messages[lastOwnIndex] : null;

  return (
    <div className="flex flex-col">
      {messages.map((msg, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const d = new Date(msg.created_at);
        const newDay = !prev || !isSameDay(new Date(prev.created_at), d);
        const own = msg.sender_id === currentUserId;
        const joinsPrev = !newDay && sameGroup(prev, msg);
        const joinsNext = sameGroup(msg, next) && isSameDay(new Date(next!.created_at), d);
        const type = msg.message_type ?? "text";

        return (
          <Fragment key={msg.id}>
            {newDay && (
              <div className="my-3 flex justify-center">
                <span className="rounded-full bg-background/80 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm">
                  {dayLabel(d)}
                </span>
              </div>
            )}

            {type === "system" || type === "delivery_rejected" ? (
              <div className="my-2 flex justify-center">
                <p className="max-w-[85%] rounded-xl bg-background/70 px-3 py-1.5 text-center text-xs text-muted-foreground whitespace-pre-line">
                  {msg.message.replace(/^❌\s*/, "")}
                </p>
              </div>
            ) : type === "delivery_accepted" ? (
              <div className="my-2 flex justify-center">
                <p className="flex max-w-[88%] items-start gap-2 rounded-xl bg-[#1a5138]/10 px-3.5 py-2 text-xs font-medium text-[#1a5138] ">
                  <Handshake size={14} strokeWidth={2} className="mt-px shrink-0" />
                  Delivery fee agreed: {Number(msg.metadata?.delivery_fee ?? 0) === 0 ? "free" : `KES ${Number(msg.metadata?.delivery_fee).toLocaleString()}`}
                  {msg.metadata?.delivery_method ? ` · ${msg.metadata.delivery_method}` : ""}
                </p>
              </div>
            ) : type === "image" ? (
              <div className={`mt-3 flex ${own ? "justify-end" : "justify-start"}`}>
                <PhotoMessage msg={msg} own={own} />
              </div>
            ) : type === "delivery_proposal" ? (
              <div className={`mt-3 flex ${own ? "justify-end" : "justify-start"}`}>
                <DeliveryOffer msg={msg} own={own} />
              </div>
            ) : (
              <div className={`flex ${own ? "justify-end" : "justify-start"} ${joinsPrev ? "mt-0.5" : "mt-3"}`}>
                <div
                  className={[
                    "max-w-[78%] sm:max-w-[65%] px-3 py-1.5 text-[14.5px] leading-snug shadow-sm",
                    own ? "bg-[hsl(44_72%_87%)] dark:bg-[hsl(40_28%_22%)] text-foreground" : "bg-card text-foreground",
                    "rounded-2xl",
                    own && !joinsNext ? "rounded-br-md" : "",
                    !own && !joinsNext ? "rounded-bl-md" : "",
                  ].join(" ")}
                >
                  <span className="whitespace-pre-line break-words">{msg.message}</span>
                  {/* Time + ticks tucked into the bubble's last line */}
                  <span className="float-right ml-2 mt-1.5 flex translate-y-0.5 items-center gap-0.5 text-[10.5px] leading-none text-muted-foreground">
                    {timeLabel(d)}
                    {own && <Ticks read={msg.is_read} />}
                  </span>
                </div>
              </div>
            )}

            {lastOwn?.id === msg.id && lastOwn.is_read && (
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                Seen{lastOwn.read_at ? ` ${isToday(new Date(lastOwn.read_at)) ? timeLabel(new Date(lastOwn.read_at)) : dayLabel(new Date(lastOwn.read_at))}` : ""}
              </p>
            )}
          </Fragment>
        );
      })}

      {otherTyping && (
        <div className="mt-3 flex justify-start" aria-live="polite">
          <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-card px-3.5 py-2.5 shadow-sm" aria-label="Typing">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 rounded-full bg-foreground/40 animate-bounce motion-reduce:animate-none" style={{ animationDelay: `${i * 140}ms` }} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
