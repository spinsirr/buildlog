import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk, IBM_Plex_Mono, JetBrains_Mono } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["700"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "BuildLog — Turn Commits into Content",
    template: "%s | BuildLog",
  },
  description: "Turn your commits into content. Build in public, effortlessly.",
  metadataBase: new URL("https://buildlog.dev"),
  icons: {
    icon: "/logo-icon.png",
    apple: "/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable} ${jetbrainsMono.variable}`}
    >
      <body className="antialiased">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster theme="dark" richColors closeButton />
      </body>
    </html>
  );
}
