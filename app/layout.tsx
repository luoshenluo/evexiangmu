import type { Metadata } from 'next'
import './globals.css'
import ClientLayout from './ClientLayout'

export const metadata: Metadata = {
  title: '花园 Garden - 模拟经营网页小游戏',
  description: '集种植、交易、社交、成长于一体的模拟经营网页游戏',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen pb-24">
        <ClientLayout>{children}</ClientLayout>
      </body>
    </html>
  )
}
