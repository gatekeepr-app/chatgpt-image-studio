import "./styles.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ChatGPT Image Studio",
  description: "Node/Next.js image generation GUI for Login with ChatGPT",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
