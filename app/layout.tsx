"use client";

import "./globals.css";
import Link from "next/link";

export const metadata = {
title: "CareScriber AI",
description: "Videomed Clinical Assistant",
};

export default function RootLayout({
children,
}: {
children: React.ReactNode;
}) {
return ( <html lang="en"> <body className="min-h-screen bg-slate-50 flex flex-col"> <main className="flex-1">{children}</main>

```
    <footer className="border-t bg-white mt-10">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="font-semibold text-slate-800">
              CareScriber AI
            </h3>
            <p className="text-sm text-slate-500">
              AI Clinical Documentation & Medical Scribing Platform
            </p>
          </div>

          <div className="flex items-center gap-6 text-sm">
            <Link
              href="/privacy"
              className="text-slate-600 hover:text-blue-600"
            >
              Privacy Policy
            </Link>

            <Link
              href="/terms"
              className="text-slate-600 hover:text-blue-600"
            >
              Terms of Service
            </Link>

            <Link
              href="/contact"
              className="text-slate-600 hover:text-blue-600"
            >
              Contact
            </Link>
          </div>
        </div>

        <div className="border-t mt-4 pt-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} CareScriber AI. All rights reserved.
        </div>
      </div>
    </footer>
  </body>
</html>
```

);
}
