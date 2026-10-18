import type { Metadata, Viewport } from 'next'
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/300-italic.css'
import '@fontsource/cormorant-garamond/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import './globals.css'
export const metadata: Metadata = { title: 'AMYGDREAD — Enter your fear', description: 'A psychological horror escape-room experience. Two rooms. Fear is not outside you.' }
export const viewport: Viewport = { themeColor: '#000000', width: 'device-width', initialScale: 1 }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>)
}
