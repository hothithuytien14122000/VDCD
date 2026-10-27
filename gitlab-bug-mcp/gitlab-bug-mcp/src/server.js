#!/usr/bin/env node
// MCP server (stdio). Lưu ý: không console.log ra stdout — sẽ làm hỏng giao thức.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as gl from './gitlab.js';

const server = new McpServer({ name: 'gitlab-bug', version: '1.0.0' });

const attachment = z.object({
  path: z.string().optional().describe('Đường dẫn file ảnh trên máy chạy MCP'),
  base64: z.string().optional().describe('Nội dung ảnh base64 (có thể kèm tiền tố data:)'),
  filename: z.string().optional(),
});
const point = z.object({
  title: z.string().describe('Tiêu đề điểm lỗi'),
  test_case_id: z.string().optional(),
  steps: z.union([z.array(z.string()), z.string()]).optional(),
  expected: z.string().optional(),
  actual: z.string().optional(),
  attachments: z.array(attachment).optional().describe('Ảnh riêng của điểm này'),
});
const ok = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });
const fail = (e) => ({ isError: true, content: [{ type: 'text', text: String(e?.message || e) }] });

server.registerTool(
  'create_bug_issue',
  {
    title: 'Tạo bug trên GitLab',
    description:
      'Tạo issue bug khi một test case FAIL. Tự gán assignee mặc định, label "New", ' +
      'Start date = hôm nay, Due date = ngày mai, upload ảnh vào description. ' +
      'Nếu đã có issue đang mở trùng tiêu đề thì thêm comment "tái hiện lại" thay vì tạo mới. ' +
      'Dùng "points" để tách nhiều điểm lỗi trong 1 issue, mỗi điểm có bước, kết quả và ảnh riêng.',
    inputSchema: {
      title: z.string().describe('Tiêu đề tiếng Việt, ngắn gọn mô tả lỗi'),
      points: z.array(point).optional().describe('Các điểm lỗi, mỗi điểm một khối riêng (ưu tiên dùng khi có nhiều điểm)'),
      steps: z.union([z.array(z.string()), z.string()]).optional().describe('Các bước tái hiện (khi không dùng points)'),
      expected: z.string().optional().describe('Kết quả mong đợi (khi không dùng points)'),
      actual: z.string().optional().describe('Kết quả thực tế (khi không dùng points)'),
      environment: z.string().optional().describe('URL/trình duyệt/môi trường test'),
      test_case_id: z.string().optional(),
      extra: z.string().optional().describe('Ghi chú thêm'),
      attachments: z.array(attachment).optional(),
      labels: z.array(z.string()).optional().describe('Label thêm ngoài label mặc định'),
      assignee: z.string().optional().describe('Username, ghi đè assignee mặc định'),
      project: z.string().optional().describe('ID hoặc "group/project", ghi đè GITLAB_PROJECT_ID'),
      dedupe: z.boolean().optional().describe('Mặc định true'),
    },
  },
  async (a) => {
    try { return ok(await gl.createBugIssue({ ...a, testCaseId: a.test_case_id })); }
    catch (e) { return fail(e); }
  },
);

server.registerTool(
  'search_issues',
  {
    title: 'Tìm issue',
    description: 'Tìm issue trong project (theo tiêu đề/mô tả), để kiểm tra lỗi đã được log chưa.',
    inputSchema: {
      query: z.string().optional(),
      state: z.enum(['opened', 'closed', 'all']).optional(),
      labels: z.string().optional().describe('Danh sách label, cách nhau dấu phẩy'),
      limit: z.number().int().min(1).max(100).optional(),
      project: z.string().optional(),
    },
  },
  async (a) => {
    try { return ok(await gl.searchIssues(a)); } catch (e) { return fail(e); }
  },
);

server.registerTool(
  'add_issue_comment',
  {
    title: 'Comment vào issue',
    description: 'Thêm comment (kèm ảnh nếu có) vào một issue theo IID.',
    inputSchema: {
      iid: z.number().int(),
      body: z.string(),
      attachments: z.array(attachment).optional(),
      project: z.string().optional(),
    },
  },
  async (a) => {
    try { return ok(await gl.addComment(a)); } catch (e) { return fail(e); }
  },
);

await server.connect(new StdioServerTransport());
