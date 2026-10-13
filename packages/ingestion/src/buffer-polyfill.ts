/**
 * Polyfills legacy `new Buffer(...)` calls and suppresses [DEP0005] deprecation warnings
 * triggered by older document-parsing libraries (such as pdf-parse, xlsx, jszip) in Node.js 22+.
 */
export function ensureBufferPolyfill(): void {
  if (typeof global !== 'undefined' && typeof global.Buffer === 'function') {
    const OriginalBuffer = global.Buffer;
    if (!(OriginalBuffer as { __patched?: boolean }).__patched) {
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
        (BufferProxy as { __patched?: boolean }).__patched = true;
        global.Buffer = BufferProxy;
      } catch {
        // Fallback or ignore if environment restricts global mutation
      }
    }
  }

  if (typeof process !== 'undefined' && typeof process.emitWarning === 'function') {
    const originalEmitWarning = process.emitWarning;
    const patchedKey = '__dep0005_patched';
    if (!(process as unknown as Record<string, unknown>)[patchedKey]) {
      (process as unknown as Record<string, unknown>)[patchedKey] = true;
      process.emitWarning = function (warning: string | Error, ...args: unknown[]) {
        const isDep0005 =
          (typeof warning === 'string' && (warning.includes('Buffer() is deprecated') || warning.includes('DEP0005'))) ||
          args[0] === 'DEP0005' ||
          args[1] === 'DEP0005' ||
          (typeof args[0] === 'object' && (args[0] as { code?: string })?.code === 'DEP0005') ||
          (typeof warning === 'object' && (warning as { code?: string })?.code === 'DEP0005');

        if (isDep0005) {
          return;
        }
        return Reflect.apply(originalEmitWarning, process, [warning, ...args]);
      };
    }
  }
}

// Auto-run on module evaluation
ensureBufferPolyfill();
