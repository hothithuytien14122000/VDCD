import fs from 'node:fs/promises';
import path from 'node:path';
import { cfg } from './config.js';

const enc = (p) => encodeURIComponent(String(p));
function need(v, name) {
  if (!v) throw new Error(`Thiếu cấu hình ${name}`);
  return v;
}

async function api(method, p, { json, form, query } = {}) {
  need(cfg.token, 'GITLAB_TOKEN');
  const u = new URL(`${cfg.url}/api/v4${p}`);
  for (const [k, v] of Object.entries(query || {})) if (v != null) u.searchParams.set(k, String(v));
  const headers = { 'PRIVATE-TOKEN': cfg.token };
  let body;
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json); }
  else if (form) body = form;
  const res = await fetch(u, { method, headers, body });
  const text = await res.text();
  if (!res.ok) throw new Error(`GitLab ${method} ${p} → ${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}

async function graphql(query, variables) {
  const res = await fetch(`${cfg.url}/api/graphql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const data = await res.json();
  if (data.errors?.length) throw new Error(data.errors.map((e) => e.message).join('; '));
  return data.data;
}

/** Ngày dạng YYYY-MM-DD theo múi giờ cấu hình. */
export function ymd(date = new Date(), addDays = 0) {
  const d = new Date(date.getTime() + addDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: cfg.tz, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d);
}

const userCache = new Map();
async function userId(username) {
  if (!username) return undefined;
  const key = username.replace(/^@/, '');
  if (userCache.has(key)) return userCache.get(key);
  const users = await api('GET', '/users', { query: { username: key } });
  const id = users?.[0]?.id;
  if (!id) throw new Error(`Không tìm thấy user GitLab "${key}"`);
  userCache.set(key, id);
  return id;
}

/** Upload 1 file vào project, trả về markdown để nhúng vào issue/comment. */
export async function uploadFile(project, att) {
  let buf, name;
  if (att.path) {
    buf = await fs.readFile(att.path);
    name = att.filename || path.basename(att.path);
  } else if (att.base64) {
    buf = Buffer.from(att.base64.replace(/^data:[^;]+;base64,/, ''), 'base64');
    name = att.filename || 'screenshot.png';
  } else throw new Error('Attachment cần "path" hoặc "base64"');
  const form = new FormData();
  form.append('file', new Blob([buf]), name);
  const r = await api('POST', `/projects/${enc(project)}/uploads`, { form });
  return r.markdown;
}

async function uploadAll(project, attachments = []) {
  const out = [];
  for (const a of attachments) out.push(await uploadFile(project, a));
  return out;
}

/** Nhận mảng hoặc chuỗi nhiều dòng "1. ...\n2. ..." → mảng bước sạch. */
export function normalizeSteps(steps) {
  const arr = Array.isArray(steps) ? steps : String(steps ?? '').split(/\r?\n/);
  return arr
    .map((s) => String(s).replace(/^\s*(?:(?:bước\s*)?\d+\s*[.):-]|[-*•])\s*/i, '').trim())
    .filter(Boolean);
}

/** Mỗi điểm lỗi một khối riêng: bước tái hiện, kết quả mong đợi/thực tế và ảnh của chính điểm đó. */
function buildPoints(points, environment, extra) {
  const L = [];
  if (environment) L.push(`**Môi trường:** ${environment}`, '');
  points.forEach((p, i) => {
    const tc = p.testCaseId ?? p.test_case_id;
    L.push(`### Điểm ${i + 1} — ${p.title}`, '');
    if (tc) L.push(`**Test case:** ${tc}`, '');
    L.push('**Các bước tái hiện**');
    if (p.steps?.length) p.steps.forEach((s, j) => L.push(`${j + 1}. ${s}`));
    else L.push('_(chưa có)_');
    L.push('', '**Kết quả mong đợi**', p.expected || '_(chưa có)_');
    L.push('', '**Kết quả thực tế**', p.actual || '_(chưa có)_');
    L.push('', '**Hình ảnh**', ...(p.attachmentsMd?.length ? p.attachmentsMd : ['_(chưa có)_']), '', '---', '');
  });
  if (extra) L.push('### Ghi chú', extra);
  return L.join('\n');
}

export function buildDescription({ steps = [], expected, actual, environment, testCaseId, extra, attachmentsMd = [], points = [] }) {
  if (points.length) return buildPoints(points, environment, extra);
  const L = [];
  if (testCaseId) L.push(`**Test case:** ${testCaseId}`);
  if (environment) L.push(`**Môi trường:** ${environment}`);
  if (L.length) L.push('');
  L.push('### Các bước tái hiện');
  if (steps.length) steps.forEach((s, i) => L.push(`${i + 1}. ${s}`));
  else L.push('_(chưa có)_');
  L.push('', '### Kết quả mong đợi', expected || '_(chưa có)_');
  L.push('', '### Kết quả thực tế', actual || '_(chưa có)_');
  if (extra) L.push('', '### Ghi chú', extra);
  if (attachmentsMd.length) L.push('', '### Ảnh minh họa', ...attachmentsMd);
  return L.join('\n');
}

export async function findOpenByTitle(project, title) {
  const list = await api('GET', `/projects/${enc(project)}/issues`, {
    query: { state: 'opened', search: title, in: 'title', per_page: 50 },
  });
  const norm = (s) => s.trim().toLowerCase();
  return list.find((i) => norm(i.title) === norm(title));
}

/** Start date chỉ đặt được qua GraphQL (widget Dates của work item). */
async function setDates(issue, startDate, dueDate) {
  const q = `mutation($id: WorkItemID!, $s: Date, $d: Date) {
    workItemUpdate(input: { id: $id, startAndDueDateWidget: { startDate: $s, dueDate: $d } }) { errors }
  }`;
  const r = await graphql(q, { id: `gid://gitlab/WorkItem/${issue.id}`, s: startDate, d: dueDate });
  const errs = r?.workItemUpdate?.errors;
  if (errs?.length) throw new Error(errs.join('; '));
}

/**
 * Tạo bug. Nếu đã có issue đang mở trùng tiêu đề (dedupe, mặc định bật)
 * thì thêm comment "tái hiện lại" thay vì tạo issue mới.
 */
/** Chuẩn hóa từng điểm: bước sạch + upload ảnh của riêng điểm đó. */
async function preparePoints(project, points = []) {
  const out = [];
  for (const p of points) {
    out.push({ ...p, steps: normalizeSteps(p.steps), attachmentsMd: await uploadAll(project, p.attachments) });
  }
  return out;
}

export async function createBugIssue(input) {
  const project = need(input.project || cfg.project, 'GITLAB_PROJECT_ID');
  const title = need(input.title?.trim(), 'title');
  const steps = normalizeSteps(input.steps);

  if (input.dedupe !== false) {
    const dup = await findOpenByTitle(project, title);
    if (dup) {
      const att = await uploadAll(project, input.attachments);
      const pointBlocks = [];
      for (const p of input.points || []) {
        const pm = await uploadAll(project, p.attachments);
        pointBlocks.push([`**${p.title}**`, p.actual ? `Kết quả thực tế: ${p.actual}` : '', ...pm].filter(Boolean).join('\n\n'));
      }
      const when = new Date().toLocaleString('vi-VN', { timeZone: cfg.tz });
      const body = [
        `🔁 Lỗi tái hiện lại lúc ${when}`,
        input.environment ? `**Môi trường:** ${input.environment}` : '',
        input.actual ? `**Kết quả thực tế:** ${input.actual}` : '',
        ...pointBlocks,
        ...att,
      ].filter(Boolean).join('\n\n');
      await api('POST', `/projects/${enc(project)}/issues/${dup.iid}/notes`, { json: { body } });
      return { action: 'commented', iid: dup.iid, web_url: dup.web_url, title: dup.title };
    }
  }

  const points = await preparePoints(project, input.points);
  const attachmentsMd = await uploadAll(project, input.attachments);
  const startDate = ymd();
  const dueDate = ymd(new Date(), cfg.dueDays);
  const assignee = input.assignee ?? cfg.assignee;
  const assigneeId = assignee ? await userId(assignee) : undefined;
  const labels = [...new Set(
    [...(cfg.labels ? cfg.labels.split(',') : []), ...(input.labels || [])].map((s) => s.trim()).filter(Boolean),
  )].join(',');

  const issue = await api('POST', `/projects/${enc(project)}/issues`, {
    json: {
      title,
      description: buildDescription({ ...input, steps, attachmentsMd, points }),
      labels,
      assignee_ids: assigneeId ? [assigneeId] : undefined,
      due_date: dueDate,
    },
  });

  let warning;
  try { await setDates(issue, startDate, dueDate); }
  catch (e) { warning = `Chưa đặt được Start date (${e.message}); Due date đã đặt.`; }

  return {
    action: 'created', iid: issue.iid, web_url: issue.web_url, title: issue.title,
    labels, assignee, start_date: startDate, due_date: dueDate, ...(warning && { warning }),
  };
}

export async function searchIssues({ project, query, state = 'opened', labels, limit = 20 }) {
  const p = need(project || cfg.project, 'GITLAB_PROJECT_ID');
  const list = await api('GET', `/projects/${enc(p)}/issues`, {
    query: { search: query, state, labels, per_page: Math.min(limit, 100) },
  });
  return list.map((i) => ({
    iid: i.iid, title: i.title, state: i.state, labels: i.labels,
    assignees: i.assignees?.map((a) => a.username), web_url: i.web_url, created_at: i.created_at,
  }));
}

export async function addComment({ project, iid, body, attachments }) {
  const p = need(project || cfg.project, 'GITLAB_PROJECT_ID');
  const att = await uploadAll(p, attachments);
  const note = await api('POST', `/projects/${enc(p)}/issues/${iid}/notes`, {
    json: { body: [body, ...att].filter(Boolean).join('\n\n') },
  });
  return { note_id: note.id, iid };
}
