import "server-only";

import fs from "fs";
import path from "path";
import type { ClientData } from "./types";

// data/ lives two levels above dashboard/
const DATA_DIR = path.join(process.cwd(), "..", "data");

export function loadPortfolio(slug: string): ClientData | null {
  const filePath = path.join(DATA_DIR, `${slug}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ClientData;
}

export function loadAllPortfolios(): { slug: string; data: ClientData | null; error: string | null }[] {
  const SLUGS = [
    "akshay-paliwal",
    "smitha",
    "satyam",
    "anshul",
    "sourobh",
    "sdp",
    "shilpa",
    "suvidhi",
    "ankita",
  ];

  return SLUGS.map((slug) => {
    // Check for error sentinel first
    const errPath = path.join(DATA_DIR, `${slug}.error.json`);
    if (fs.existsSync(errPath)) {
      const sentinel = JSON.parse(fs.readFileSync(errPath, "utf-8"));
      return { slug, data: null, error: sentinel.error ?? "token_error" };
    }

    const data = loadPortfolio(slug);
    return { slug, data, error: data ? null : "no_data" };
  });
}
