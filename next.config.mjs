/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["sharp", "bullmq", "ioredis", "bcryptjs", "@prisma/client"],
  },
};

export default nextConfig;
