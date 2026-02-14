import path from 'path';

export const ASSISTANT_NAME = process.env.ASSISTANT_NAME || 'Andy';
export const POLL_INTERVAL = 2000;
export const SCHEDULER_POLL_INTERVAL = 60000;

// Absolute paths needed for container mounts
const PROJECT_ROOT = process.cwd();
const HOME_DIR = process.env.HOME || '/Users/user';

// Mount security: allowlist stored OUTSIDE project root, never mounted into containers
export const MOUNT_ALLOWLIST_PATH = path.join(
  HOME_DIR,
  '.config',
  'nanoclaw',
  'mount-allowlist.json',
);
export const STORE_DIR = path.resolve(PROJECT_ROOT, 'store');
export const GROUPS_DIR = path.resolve(PROJECT_ROOT, 'groups');
export const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
export const MAIN_GROUP_FOLDER = 'main';

// Container backend: 'apple' for macOS Apple Container, 'podman' for Podman + Kata (Linux)
// Auto-detected from platform if not set
export const CONTAINER_BACKEND: 'apple' | 'podman' =
  (process.env.CONTAINER_BACKEND as 'apple' | 'podman') ||
  (process.platform === 'darwin' ? 'apple' : 'podman');

// The CLI binary name
export const CONTAINER_COMMAND =
  CONTAINER_BACKEND === 'apple' ? 'container' : 'podman';

// OCI runtime for Podman (Kata Containers with Firecracker VMM)
// Ignored when CONTAINER_BACKEND is 'apple'
export const CONTAINER_RUNTIME =
  process.env.CONTAINER_RUNTIME || 'kata-runtime';

export const CONTAINER_IMAGE =
  process.env.CONTAINER_IMAGE || (CONTAINER_BACKEND === 'podman'
    ? 'localhost/nanoclaw-agent:latest'
    : 'nanoclaw-agent:latest');
export const CONTAINER_TIMEOUT = parseInt(
  process.env.CONTAINER_TIMEOUT || '1800000',
  10,
);
export const CONTAINER_MAX_OUTPUT_SIZE = parseInt(
  process.env.CONTAINER_MAX_OUTPUT_SIZE || '10485760',
  10,
); // 10MB default
export const IPC_POLL_INTERVAL = 1000;
export const IDLE_TIMEOUT = parseInt(
  process.env.IDLE_TIMEOUT || '1800000',
  10,
); // 30min default — how long to keep container alive after last result
export const MAX_CONCURRENT_CONTAINERS = Math.max(
  1,
  parseInt(process.env.MAX_CONCURRENT_CONTAINERS || '5', 10) || 5,
);

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const TRIGGER_PATTERN = new RegExp(
  `^@${escapeRegex(ASSISTANT_NAME)}\\b`,
  'i',
);

// Timezone for scheduled tasks (cron expressions, etc.)
// Uses system timezone by default
export const TIMEZONE =
  process.env.TZ || Intl.DateTimeFormat().resolvedOptions().timeZone;
