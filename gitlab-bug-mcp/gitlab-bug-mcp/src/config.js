import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// Nạp .env ở thư mục gốc dự án (nếu có). Biến đã set sẵn (vd. trong config MCP) được ưu tiên.
const envPath = fileURLToPath(new URL('../.env', import.meta.url));
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    const val = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}

export const cfg = {
  url: (process.env.GITLAB_URL || 'https://gitlab.com').replace(/\/+$/, ''),
  token: process.env.GITLAB_TOKEN,
  project: process.env.GITLAB_PROJECT_ID, // id số hoặc "group/project"
  assignee: process.env.GITLAB_DEFAULT_ASSIGNEE ?? 'gnt.manhtv',
  labels: process.env.GITLAB_DEFAULT_LABELS ?? 'New',
  tz: process.env.GITLAB_TZ || 'Asia/Ho_Chi_Minh',
  dueDays: Number(process.env.GITLAB_DUE_DAYS ?? 1),
};
