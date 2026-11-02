import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
const geist=Geist({subsets:["latin"],variable:"--font-geist"}); const mono=Geist_Mono({subsets:["latin"],variable:"--font-geist-mono"});
export const metadata:Metadata={title:{default:"Vayuveg — Programmable CDN",template:"%s · Vayuveg"},description:"Persistent content streams for the global edge."};
export const viewport:Viewport={themeColor:"#070a0c",colorScheme:"dark",width:"device-width",initialScale:1};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en" className="bg-background"><body className={`${geist.variable} ${mono.variable} font-sans`}><Toaster theme="dark"/>{children}</body></html>}
