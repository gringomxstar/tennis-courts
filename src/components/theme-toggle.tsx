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
      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#141A26] border border-slate-200 dark:border-white/[0.08]" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      type="button"
      title={isDark ? "Zu hellem Modus wechseln" : "Zu Roland Garros Nocturne Dark Mode wechseln"}
      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-[#141A26] dark:hover:bg-[#1A2232] dark:text-amber-400 border border-slate-200/80 dark:border-white/[0.08] shadow-2xs cursor-pointer hover:scale-105"
    >
      {isDark ? (
        <Sun className="w-3.5 h-3.5 text-amber-400 transition-transform" />
      ) : (
        <Moon className="w-3.5 h-3.5 text-slate-700 transition-transform" />
      )}
    </button>
  );
}
