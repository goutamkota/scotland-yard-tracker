// ---------------------------------------------------------------------------
//  Scotland Yard – Avatar / Character Selection
// ---------------------------------------------------------------------------

export interface Avatar {
  id: string;
  emoji: string;
  label: string;
  color: string; // tailwind bg color class
}

export const AVATARS: Avatar[] = [
  { id: "detective-hat",   emoji: "🕵️", label: "Detective",    color: "bg-blue-500" },
  { id: "fox",             emoji: "🦊", label: "Fox",          color: "bg-orange-500" },
  { id: "wolf",            emoji: "🐺", label: "Wolf",         color: "bg-gray-500" },
  { id: "eagle",           emoji: "🦅", label: "Eagle",        color: "bg-amber-700" },
  { id: "owl",             emoji: "🦉", label: "Owl",          color: "bg-yellow-800" },
  { id: "cat",             emoji: "🐱", label: "Cat",          color: "bg-yellow-500" },
  { id: "shark",           emoji: "🦈", label: "Shark",        color: "bg-slate-500" },
  { id: "dragon",          emoji: "🐉", label: "Dragon",       color: "bg-red-600" },
  { id: "unicorn",         emoji: "🦄", label: "Unicorn",      color: "bg-pink-500" },
  { id: "ghost",           emoji: "👻", label: "Ghost",        color: "bg-purple-400" },
  { id: "robot",           emoji: "🤖", label: "Robot",        color: "bg-cyan-500" },
  { id: "alien",           emoji: "👽", label: "Alien",        color: "bg-green-500" },
  { id: "ninja",           emoji: "🥷", label: "Ninja",        color: "bg-neutral-800" },
  { id: "pirate",          emoji: "🏴‍☠️", label: "Pirate",       color: "bg-stone-700" },
  { id: "crown",           emoji: "👑", label: "Royal",        color: "bg-yellow-400" },
  { id: "wizard",          emoji: "🧙", label: "Wizard",       color: "bg-indigo-500" },
];

export function getAvatarById(id: string): Avatar | undefined {
  return AVATARS.find((a) => a.id === id);
}
