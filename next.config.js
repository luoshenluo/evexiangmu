/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Cloudflare Pages (next-on-pages) 要求所有运行时为 Edge Runtime
  // 通过 @cloudflare/next-on-pages 转换为 Cloudflare Pages 函数
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // 静默 next-on-pages 的 experimental 提示
  experimental: {
    // 兼容 Cloudflare Pages 部署
  },
}

module.exports = nextConfig
