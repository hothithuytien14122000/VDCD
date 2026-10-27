/**
 * Playwright reporter: test FAIL (sau lần retry cuối) → tạo bug GitLab.
 * Chỉ chạy khi GITLAB_REPORT=1 để tránh log bug khi chạy thử trên máy.
 *
 * playwright.config.ts:
 *   reporter: [['list'], ['./gitlab-bug-mcp/reporters/playwright-gitlab-reporter.js', { environment: 'Staging - Chrome' }]],
 *   use: { screenshot: 'only-on-failure' },
 *
 * Trong test có thể khai báo thêm:
 *   test('Tìm kiếm theo tên', { annotation: [
 *     { type: 'tc', description: 'TC_SEARCH_01' },
 *     { type: 'expected', description: 'Hiển thị đúng bản ghi có tên chứa từ khóa' },
 *   ]}, async ({ page }) => { await test.step('Mở trang danh sách', ...) ... });
 */
import { createBugIssue } from '../src/gitlab.js';

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');

export default class GitLabBugReporter {
  constructor(options = {}) {
    this.options = options;
    this.enabled = process.env.GITLAB_REPORT === '1';
    this.jobs = [];
  }

  onTestEnd(test, result) {
    if (!this.enabled) return;
    if (!['failed', 'timedOut'].includes(result.status)) return;
    if (result.retry < test.retries) return; // còn retry → chờ kết quả cuối

    const ann = (t) => test.annotations.find((a) => a.type === t)?.description;
    const steps = result.steps.filter((s) => s.category === 'test.step').map((s) => s.title);
    const err = result.errors?.[0];
    const actual = stripAnsi(err?.message || `Test kết thúc với trạng thái ${result.status}`).slice(0, 3000);
    const attachments = result.attachments
      .filter((a) => a.path && a.contentType?.startsWith('image/'))
      .map((a) => ({ path: a.path }));
    const id = ann('tc');
    let t = test.title.replace(/^(kiểm tra|test|verify)\s+/i, '');
    t = t.charAt(0).toLowerCase() + t.slice(1);

    this.jobs.push(
      createBugIssue({
        title: `Lỗi ${t}${id ? ` [${id}]` : ''}`,
        steps: steps.length ? steps : [test.titlePath().filter(Boolean).join(' › ')],
        expected: ann('expected') || 'Test case đạt (Pass).',
        actual: '```\n' + actual + '\n```',
        testCaseId: id || `${test.location.file}:${test.location.line}`,
        environment: this.options.environment || process.env.TEST_ENV,
        attachments,
      })
        .then((r) => console.log(`[gitlab] ${r.action} #${r.iid} ${r.web_url}${r.warning ? ' ⚠ ' + r.warning : ''}`))
        .catch((e) => console.error(`[gitlab] ❌ ${test.title}: ${e.message}`)),
    );
  }

  async onEnd() {
    await Promise.allSettled(this.jobs);
  }

}
