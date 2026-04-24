/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production'

const nextConfig = {
  output: 'export',
  distDir: '.next',
  images: { unoptimized: true },
  trailingSlash: true,
  assetPrefix: isDev ? undefined : './',
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: true }
}

module.exports = nextConfig
