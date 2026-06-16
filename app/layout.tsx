import "./globals.css";

export const metadata = {
  title: "CareScriber AI",
  description: "Videomed Clinical Assistant",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
