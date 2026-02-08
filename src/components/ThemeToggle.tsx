import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";
import { sounds } from "@/lib/audio";
import { haptics } from "@/lib/haptics";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggle = () => {
    sounds.tap();
    haptics.tap();
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <button
      onClick={toggle}
      className="p-1.5 sm:p-2 rounded-lg hover:bg-muted transition-colors"
      title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-muted-foreground hover:text-foreground" />
      ) : (
        <Moon className="w-4 h-4 text-muted-foreground hover:text-foreground" />
      )}
    </button>
  );
}
