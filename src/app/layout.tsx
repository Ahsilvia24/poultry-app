import type { Metadata, Viewport } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import { LockPinchZoom } from "@/components/LockPinchZoom";
import { RegisterServiceWorker } from "@/components/RegisterServiceWorker";
import "./globals.css";

const sans = Source_Sans_3({
  variable: "--font-sans",
  subsets: ["latin"],
});

const serif = Source_Serif_4({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PoultryTech",
  description: "Poultry farm management for service technicians",
  applicationName: "PoultryTech",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { url: "/apple-touch-icon-precomposed.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "PoultryTech",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#f3efe6",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${serif.variable} h-full`}
      style={{ backgroundColor: "#f3efe6" }}
    >
      <body
        className="h-full overflow-hidden bg-[#f3efe6] font-sans text-stone-900 antialiased"
        style={{ backgroundColor: "#f3efe6" }}
      >
        {process.env.NODE_ENV === "production" ? (
          <script
            dangerouslySetInnerHTML={{
              __html:
                'if("serviceWorker"in navigator){navigator.serviceWorker.register("/sw.js",{scope:"/",updateViaCache:"none"})}',
            }}
          />
        ) : null}
        <RegisterServiceWorker />
        <LockPinchZoom />
        {children}
      </body>
    </html>
  );
}
