import { parse } from "https://esm.sh/jsonc-parser";

export class JSONC {
  constructor() {
    this.cache = new Map();
  }

  async loadJsonc(url) {
    const cached = this.cache.get(url);
    const headers = cached?.etag ? { 'If-None-Match': cached.etag } : {};
    const res = await fetch(url, { headers });

    if (res.status === 304 && cached) return cached.data;

    const text = await res.text();
    const data = parse(text);
    this.cache.set(url, { etag: res.headers.get('ETag'), data });
    return data;
  }
}
export class Time {
  constructor() {
  }

  wait(ms){
   var start = new Date().getTime();
   var end = start;
   while(end < start + ms) {
     end = new Date().getTime();
    }
  }
}