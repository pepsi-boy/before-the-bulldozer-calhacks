/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // OCI SDK reads ~/.oci/config at runtime; keep it out of the bundle.
    serverComponentsExternalPackages: ["oci-common", "oci-generativeaiinference"],
  },
};
export default nextConfig;
