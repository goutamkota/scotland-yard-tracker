import { useState } from "react";
import { AVATARS, type Avatar } from "@/lib/avatars";

interface AvatarPickerProps {
  selectedId: string;
  onSelect: (avatar: Avatar) => void;
  takenAvatarIds?: string[];
  compact?: boolean;
}

export function AvatarPicker({ selectedId, onSelect, takenAvatarIds = [], compact = false }: AvatarPickerProps) {
  return (
    <div className={`grid ${compact ? "grid-cols-8 gap-1.5" : "grid-cols-4 sm:grid-cols-8 gap-2"}`}>
      {AVATARS.map((avatar) => {
        const isTaken = takenAvatarIds.includes(avatar.id) && avatar.id !== selectedId;
        const isSelected = selectedId === avatar.id;

        return (
          <button
            key={avatar.id}
            onClick={() => !isTaken && onSelect(avatar)}
            disabled={isTaken}
            className={`
              relative flex flex-col items-center justify-center rounded-xl border-2 transition-all duration-200
              ${compact ? "p-1.5" : "p-2 sm:p-3"}
              ${isSelected
                ? "border-primary bg-primary/20 scale-105 ring-2 ring-primary/40"
                : isTaken
                  ? "border-border bg-muted/30 opacity-40 cursor-not-allowed"
                  : "border-border bg-card hover:border-primary/50 hover:bg-secondary cursor-pointer"
              }
            `}
            title={isTaken ? `${avatar.label} (taken)` : avatar.label}
          >
            <span className={`${compact ? "text-lg" : "text-2xl sm:text-3xl"}`}>
              {avatar.emoji}
            </span>
            {!compact && (
              <span className={`text-[9px] font-mono mt-1 ${isSelected ? "text-primary" : "text-muted-foreground"}`}>
                {avatar.label}
              </span>
            )}
            {isSelected && (
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                <span className="text-[8px] text-primary-foreground">✓</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
