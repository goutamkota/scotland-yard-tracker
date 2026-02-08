import { PlayerTickets, getTransportEmoji } from "@/hooks/useScotlandYard";

interface TicketDisplayProps {
  tickets: PlayerTickets;
  isMrX: boolean;
  compact?: boolean;
}

export function TicketDisplay({ tickets, isMrX, compact = false }: TicketDisplayProps) {
  const items = [
    { key: "taxi", emoji: "🚕", count: tickets.taxi, label: "Taxi" },
    { key: "bus", emoji: "🚌", count: tickets.bus, label: "Bus" },
    { key: "underground", emoji: "🚇", count: tickets.underground, label: "Undg" },
  ];

  if (isMrX) {
    items.push(
      { key: "black", emoji: "🎩", count: tickets.black, label: "Black" },
      { key: "double", emoji: "⚡", count: tickets.double, label: "2X" }
    );
  }

  if (compact) {
    return (
      <div className="flex gap-1.5 flex-wrap justify-center">
        {items.map((item) => (
          <span
            key={item.key}
            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
              item.count > 0
                ? `transport-${item.key === "underground" ? "underground" : item.key} opacity-90`
                : "bg-muted text-muted-foreground line-through opacity-50"
            }`}
          >
            {item.emoji}{item.count}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {items.map((item) => (
        <div
          key={item.key}
          className={`flex flex-col items-center px-2 py-1.5 rounded-lg text-xs font-mono ${
            item.count > 0
              ? `transport-${item.key === "underground" ? "underground" : item.key}`
              : "bg-muted text-muted-foreground"
          }`}
        >
          <span className="text-base">{item.emoji}</span>
          <span className="font-semibold">{item.count}</span>
        </div>
      ))}
    </div>
  );
}
