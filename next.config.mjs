/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // your 3D models, textures, images, fonts — anything in /public
        source: '/:path*\\.(glb|gltf|png|jpg|jpeg|webp|avif|svg|woff|woff2|ktx2|basis)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        // Next's own built JS/CSS chunks — these are already content-hashed, safe to cache forever
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ]
  },
}