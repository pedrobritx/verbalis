import '@testing-library/jest-dom'

// jsdom doesn't ship ResizeObserver; cmdk needs it.
if (typeof globalThis.ResizeObserver === 'undefined') {
  class ResizeObserverPolyfill {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverPolyfill as unknown as typeof ResizeObserver
}

// jsdom omits these Element APIs that cmdk + Radix poke at.
if (typeof Element !== 'undefined') {
  if (typeof Element.prototype.scrollIntoView !== 'function') {
    Element.prototype.scrollIntoView = function () {}
  }
  if (typeof Element.prototype.hasPointerCapture !== 'function') {
    Element.prototype.hasPointerCapture = () => false
  }
  if (typeof Element.prototype.releasePointerCapture !== 'function') {
    Element.prototype.releasePointerCapture = () => {}
  }
}
