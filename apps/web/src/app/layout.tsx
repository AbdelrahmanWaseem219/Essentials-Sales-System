import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Essentials Egypt · Sales',
  description: 'Essentials Egypt — Sales Management System',
};

// Runs before first paint so the saved (or system) theme is applied with no
// flash of the wrong color. Reads localStorage('theme'); falls back to the OS
// preference. Kept inline + tiny on purpose.
const noFlashTheme = `
(function(){try{
  var t = localStorage.getItem('theme');
  if(!t){ t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
  if(t === 'dark'){ document.documentElement.classList.add('dark'); }
}catch(e){}})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashTheme }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
