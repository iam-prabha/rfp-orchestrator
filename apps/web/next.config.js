// Polyfill legacy Buffer constructor and suppress DEP0005 deprecation warnings
if (typeof global !== 'undefined' && typeof global.Buffer === 'function') {
  const OriginalBuffer = global.Buffer;
  if (!OriginalBuffer.__patched) {
    try {
      const BufferProxy = new Proxy(OriginalBuffer, {
        construct(target, args) {
          const [arg, encodingOrOffset, length] = args;
          if (typeof arg === 'number') {
            return target.alloc(arg);
          }
          return target.from(arg, encodingOrOffset, length);
        },
        apply(target, _thisArg, args) {
          const [arg, encodingOrOffset, length] = args;
          if (typeof arg === 'number') {
            return target.alloc(arg);
          }
          return target.from(arg, encodingOrOffset, length);
        },
      });
      BufferProxy.__patched = true;
      global.Buffer = BufferProxy;
    } catch {
      // ignore
    }
  }
}

if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
  const origEmitWarning = process.emitWarning;
  if (!process.__dep0005_patched) {
    process.__dep0005_patched = true;
    process.emitWarning = function (warning, ...args) {
      const isDep0005 =
        (typeof warning === 'string' && (warning.includes('Buffer() is deprecated') || warning.includes('DEP0005'))) ||
        args[0] === 'DEP0005' ||
        args[1] === 'DEP0005' ||
        (typeof args[0] === 'object' && args[0]?.code === 'DEP0005') ||
        (typeof warning === 'object' && warning?.code === 'DEP0005');

      if (isDep0005) {
        return;
      }
      return Reflect.apply(origEmitWarning, process, [warning, ...args]);
    };
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@repo/shared',
    '@repo/ingestion',
    '@repo/retrieval',
    '@repo/drafting',
    '@repo/orchestrator',
  ],
  images: {
    domains: ['localhost', 'your-project.supabase.co'],
  },
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ['pdf-parse', 'xlsx', 'mammoth', 'exceljs', 'docx'],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      child_process: false,
    };
    return config;
  },

  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
