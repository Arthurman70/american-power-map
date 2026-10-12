// Web Worker: runs the Barnes-Hut layout for the "Distance" (depth-from-selection) view in the browser.
importScripts('/layout.js');
onmessage = (ev) => {
  const d = ev.data;
  const depth = {}; for (let i = 0; i < d.nodes.length; i++) if (d.depth[i] >= 0) depth[d.nodes[i].id] = d.depth[i];
  const a = PowerLayout.anchors(d.nodes, 'depth', { depth, maxD: d.maxD, spread: d.spread });
  const r = PowerLayout.run({ N: d.nodes.length, size: d.size, ax: a.ax, ay: a.ay, az: a.az, kx: a.kx, ky: a.ky, kz: a.kz, es: d.es, ed: d.ed, ew: d.ew, x0: d.x0, y0: d.y0, z0: d.z0, iters: d.iters || 140, spread: d.spread,
    onProgress: (i, n) => postMessage({ progress: i / n }) });
  postMessage({ done: true, x: r.x, y: r.y, z: r.z }, [r.x.buffer, r.y.buffer, r.z.buffer]);
};
