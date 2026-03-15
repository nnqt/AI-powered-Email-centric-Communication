import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.FRONTEND_URL || "http://localhost:3000",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,DELETE,PATCH,POST,PUT",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version",
          },
        ],
      },
    ];
  },
  serverExternalPackages: ['pino', 'thread-stream'],
  webpack: (config: any, { isServer, webpack }: any) => {
    if (isServer) {
        config.plugins.push(
            new webpack.IgnorePlugin({
                resourceRegExp: /^(why-is-node-running|tap)$/,
            })
        );
    }
    return config;
  },
  turbopack: {},
};

export default nextConfig;
