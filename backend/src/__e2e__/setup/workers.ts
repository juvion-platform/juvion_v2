import { availableParallelism } from 'node:os';

/**
 * Number of parallel e2e workers; global-setup starts one MongoDB server per worker.
 * Each worker runs a forked app plus its own mongod, so leave a core free and cap at six
 * (beyond that the forks contend for CPU and files slow down). E2E_WORKERS overrides it.
 */
export const E2E_WORKERS = Math.max(
  1,
  Number(process.env.E2E_WORKERS) || Math.min(6, availableParallelism() - 1),
);
