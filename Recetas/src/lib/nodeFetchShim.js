// Browser & Node 18+ native fetch shim for @tensorflow/tfjs-core (avoids CJS whatwg-url in node-fetch)
const fetchShim = (...args) => globalThis.fetch(...args);

export default fetchShim;
export { fetchShim as fetch };
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
