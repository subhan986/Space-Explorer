
import type {Metadata} from 'next';
import { Inter, Roboto_Slab } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { CustomizationProvider } from '@/contexts/CustomizationContext';

// Google fonts are instantiated by calling them as functions:
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const robotoSlab = Roboto_Slab({
  variable: '--font-roboto-slab',
  subsets: ['latin'],
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  title: 'Spacetime Explorer',
  description: '3D Spacetime Fabric Gravity Visualizer',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Use GeistSans.variable and GeistMono.variable directly for the geist package
    <html lang="en" className={`${GeistSans.variable} ${inter.variable} ${robotoSlab.variable} ${GeistMono.variable}`}>
      {/* CustomizationProvider is now inside body to satisfy Next.js structure */}
      <body className={`antialiased bg-background text-foreground`}>
        <CustomizationProvider>
          {children}
          <Toaster />
        </CustomizationProvider>
      </body>
    </html>
  );
}
