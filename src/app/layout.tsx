export const dynamic = "force-dynamic";
export const revalidate = 0;
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tennis Reservation App",
  description: "Moderne, mandantenfähige Tennisplatz-Reservierung und Clubverwaltung",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={cn("h-full antialiased", "font-sans")} suppressHydrationWarning>
      <head>
        <Script id="theme-script" strategy="beforeInteractive">
          {`
            (function() {
              try {
                var saved = localStorage.getItem('tennis-theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var theme = saved ? saved : (prefersDark ? 'dark' : 'light');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                  document.documentElement.classList.remove('light');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.add('light');
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch(e) {}
            })();
          `}
        </Script>
      </head>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 text-slate-900 dark:bg-[#080B11] dark:text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
