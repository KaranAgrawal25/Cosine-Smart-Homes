import "./globals.css";

export const metadata = {
  title: "COSINE | Intelligent Networking Environment",
  description: "Control of Systems with Intelligent Networking Environment - Advanced Smart Home Management System",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;900&family=Rajdhani:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdnjs.cloudflare.com/ajax/libs/mqtt/4.3.7/mqtt.min.js" />
      </head>
      <body>
        <div className="background"></div>
        <div className="grid-overlay"></div>
        {children}
      </body>
    </html>
  );
}