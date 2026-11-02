import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
export function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)); }
export function slugify(value: string) { return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
export function formatBytes(value: number) { if (!value) return "0 B"; const units=["B","KB","MB","GB"]; const i=Math.min(Math.floor(Math.log(value)/Math.log(1024)),3); return `${(value/1024**i).toFixed(i?1:0)} ${units[i]}`; }
