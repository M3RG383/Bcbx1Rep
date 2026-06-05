import { NextRequest, NextResponse } from "next/server";

// Known scraping/bot user agents to block
const BLOCKED_AGENTS = [
  "curl", "wget", "python-requests", "python-urllib", "scrapy",
  "go-http-client", "okhttp", "java/", "libwww-perl", "lwp-",
  "phpcrawl", "nutch", "boto3", "axios", "node-fetch", "aiohttp",
  "httpx", "httrack", "w3af", "nikto", "zgrab",
];

// Rate limit tracking (in-memory, resets on redeploy)
const requestCounts = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT = 120; // requests per window
const WINDOW_MS = 60_000; // 1 minute window

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  
  // Skip API routes, static assets, and Next.js internals
  if (
    url.pathname.startsWith("/_next/") ||
    url.pathname.startsWith("/api/") ||
    url.pathname === "/favicon.ico" ||
    url.pathname.startsWith("/__nextjs_original-stack-frame")
  ) {
    return NextResponse.next();
  }

  const userAgent = (req.headers.get("user-agent") || "").toLowerCase();

  // Block known scrapers
  for (const agent of BLOCKED_AGENTS) {
    if (userAgent.includes(agent)) {
      return new NextResponse("Access denied", {
        status: 403,
        headers: {
          "X-Robots-Tag": "noindex, nofollow",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
  }

  // Rate limit per IP
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const entry = requestCounts.get(ip);
  
  if (!entry || now > entry.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
  } else {
    entry.count++;
    if (entry.count > RATE_LIMIT) {
      return new NextResponse("Rate limit exceeded", {
        status: 429,
        headers: { "Retry-After": "60" },
      });
    }
  }

  // Security headers
  const response = NextResponse.next();
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Frame-Options", "DENY");
  
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};