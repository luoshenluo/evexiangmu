import type { Metadata, Viewport } from 'next'
import './globals.css'
import ClientLayout from './ClientLayout'

export const metadata: Metadata = {
  title: '花园 Garden - 模拟经营网页小游戏',
  description: '集种植、交易、社交、成长于一体的模拟经营网页游戏',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f0fdf4' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' },
  ],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen pb-24 md:pb-0">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
