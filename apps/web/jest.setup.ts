import "@testing-library/jest-dom";

/**
 * jsdom doesn't implement canvas 2D or WebGL contexts. We stub both
 * with a Proxy that no-ops every method call and returns a sentinel
 * object for every property access. This satisfies:
 *   - THREE.WebGLRenderer constructor (probes dozens of WebGL methods)
 *   - HTMLCanvasElement.getContext("2d") for the name-label sprites
 * The 3D scene doesn't actually render, but the React tree mounts
 * cleanly and the overlay panels are fully testable.
 */
const makeSentinel = () => ({});

const make2DStub = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const sentinel = makeSentinel();
  return new Proxy(sentinel as unknown as CanvasRenderingContext2D, {
    get(_target, prop) {
      if (prop === "canvas") return canvas;
      if (prop === "measureText") return () => ({ width: 100 });
      // Methods: return a function that returns the sentinel
      return () => sentinel;
    },
    set() {
      return true;
    },
  });
};

const makeWebGLStub = (canvas: HTMLCanvasElement): WebGLRenderingContext => {
  const sentinel = makeSentinel();
  return new Proxy(sentinel as unknown as WebGLRenderingContext, {
    get(_target, prop) {
      if (prop === "canvas") return canvas;
      if (prop === "drawingBufferWidth") return 800;
      if (prop === "drawingBufferHeight") return 600;
      return () => sentinel;
    },
  });
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, ...args: any[]): any {
  const type = args[0] as string;
  if (type === "2d") return make2DStub(this);
  if (
    type === "webgl" ||
    type === "webgl2" ||
    type === "experimental-webgl"
  ) {
    return makeWebGLStub(this);
  }
  return null;
};

// jsdom doesn't implement ResizeObserver. The viewer's useEffect
// constructs one for the canvas — stub it with a no-op.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
