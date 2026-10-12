// Worker thread: computes one layout and stores it in the database.
import { parentPort, workerData } from 'node:worker_threads';
import { computeLayout } from './graph.mjs';
const out = computeLayout(workerData.db, workerData.layout, (i, n) => parentPort.postMessage({ progress: i / n }));
parentPort.postMessage({ done: true, positions: out }, [out.buffer]);
