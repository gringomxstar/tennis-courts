"use client";

import { useSyncExternalStore, useState, useEffect } from "react";
import { Sun, Moon } from "lucide-react";

const emptySubscribe = () => () => {};

export function ThemeToggle() {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const savedTheme = localStorage.getItem("tennis-theme");
    if (savedTheme) return savedTheme === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light");
      document.documentElement.style.colorScheme = "dark";
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
      document.documentElement.style.colorScheme = "light";
    }
  }, [isDark]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    localStorage.setItem("tennis-theme", nextDark ? "dark" : "light");
  };

  if (!isClient) {
    return (
      <div className="w-8 h-8 rounded-xl bg-card border border-border" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isDark ? "Zu hellem Modus wechseln" : "Zu Roland Garros Nocturne Dark Mode wechseln"}
      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-secondary hover:bg-accent text-muted-foreground dark:text-amber-400 border border-border shadow-2xs cursor-pointer hover:scale-105"
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5 text-amber-400 transition-transform" />
      ) : (
        <Moon className="w-3.5 h-3.5 text-foreground transition-transform" />
      )}
    </button>
  );
}
