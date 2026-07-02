import "./globals.css";

export const metadata = {
  title: "Sentinel Agent — Email Security Dashboard",
  description: "AI-powered email threat detection, investigation, and response dashboard. Monitor phishing, spoofing, and malware attacks in real-time.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
