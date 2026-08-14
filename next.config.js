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
  webpack: (config, { isServer }) => {
    // bcryptjs 在构建时引用 node 内置 crypto，为 Edge/无 Node 环境提供 polyfill
    if (!isServer) {
      config.resolve.fallback = {
        ...(config.resolve.fallback || {}),
        crypto: false,
      }
    }
    return config
  },
}

module.exports = nextConfig
