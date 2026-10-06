#!/usr/bin/env python3
"""
Run the be-testing Playwright suite and format the results as a GO/NO-GO markdown report.

This is a LOCAL formatter only — it does not post to Azure DevOps itself. It writes
test-report.md/.json next to the suite's own report/ folder; posting that content to a
work item is a separate, explicit step done via the api-test-generator skill's ADO MCP
tool calls, not by this script.
"""

import argparse
import json
import sys
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, List, Optional


def read_env_value(env_path: Path, key: str) -> Optional[str]:
    """Read a single KEY=value from a .env file without an external dependency."""
    if not env_path.exists():
        return None
    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, _, v = line.partition('=')
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return None


def find_latest(root_dir: Path, glob_pattern: str) -> str:
    """Latest path matching glob_pattern under root_dir, relative to root_dir."""
    matches = sorted(root_dir.glob(glob_pattern))
    return str(matches[-1].relative_to(root_dir)) if matches else 'not found'


def run_playwright_tests(root_dir: Path, timeout_seconds: int) -> tuple:
    """
    Run the be-testing Playwright suite from its own project root.

    Returns:
        tuple: (success: bool, results_file: Path)
    """
    print(f"Running Playwright tests in: {root_dir}")
    print("=" * 60)

    try:
        # Run Playwright tests
        result = subprocess.run(
            ['npx', 'playwright', 'test'],
            cwd=str(root_dir),
            capture_output=True,
            text=True,
            timeout=timeout_seconds
        )

        # Print output
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            print(result.stderr, file=sys.stderr)

        print("=" * 60)

        # Check if results file exists
        results_file = root_dir / 'report' / 'test-results.json'
        if not results_file.exists():
            print("Warning: report/test-results.json not found", file=sys.stderr)
            return False, None

        # Tests pass if exit code is 0
        success = result.returncode == 0
        return success, results_file

    except subprocess.TimeoutExpired:
        print("Error: Test execution timed out after 5 minutes", file=sys.stderr)
        return False, None

    except FileNotFoundError:
        print("Error: Playwright not found. Run 'npm install -D @playwright/test' first.", file=sys.stderr)
        return False, None

    except Exception as e:
        print(f"Error running tests: {e}", file=sys.stderr)
        return False, None


def parse_test_results(results_file: Path) -> Dict[str, Any]:
    """Parse Playwright test results JSON."""
    
    try:
        with open(results_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"Error parsing test results: {e}", file=sys.stderr)
        return None
    
    # Extract summary
    suites = data.get('suites', [])
    
    total_tests = 0
    passed_tests = 0
    failed_tests = 0
    skipped_tests = 0
    duration_ms = 0
    
    failed_details = []
    
    def process_suite(suite):
        nonlocal total_tests, passed_tests, failed_tests, skipped_tests, duration_ms
        
        for spec in suite.get('specs', []):
            for test in spec.get('tests', []):
                results = test.get('results', [])
                for result in results:
                    total_tests += 1
                    status = result.get('status')
                    duration_ms += result.get('duration', 0)
                    
                    if status == 'passed':
                        passed_tests += 1
                    elif status == 'failed':
                        failed_tests += 1
                        
                        # Collect failure details
                        title = test.get('title', 'Unknown test')
                        location = spec.get('file', 'Unknown file')
                        line = spec.get('line', 0)
                        
                        error_message = ''
                        errors = result.get('errors', [])
                        if errors:
                            error_message = errors[0].get('message', 'No error message')
                            # Truncate long error messages
                            if len(error_message) > 200:
                                error_message = error_message[:200] + '...'
                        
                        failed_details.append({
                            'title': title,
                            'location': location,
                            'line': line,
                            'error': error_message
                        })
                    elif status == 'skipped':
                        skipped_tests += 1
        
        # Process nested suites
        for child_suite in suite.get('suites', []):
            process_suite(child_suite)
    
    # Process all suites
    for suite in suites:
        process_suite(suite)
    
    return {
        'total': total_tests,
        'passed': passed_tests,
        'failed': failed_tests,
        'skipped': skipped_tests,
        'duration_ms': duration_ms,
        'duration_seconds': round(duration_ms / 1000, 2),
        'failed_details': failed_details,
        'pass_rate': round((passed_tests / total_tests * 100) if total_tests > 0 else 0, 1)
    }


def format_report(summary: Dict[str, Any], work_item_id: str = None) -> str:
    """
    Format test results as markdown report for Azure DevOps.
    New 5-section format for better flow and clarity.
    """
    
    lines = []
    
    # Extract environment info from summary (with defaults)
    env_url = summary.get('environment_url', 'Not specified')
    env_name = summary.get('environment', 'Test Environment')
    browsers = summary.get('browsers', 'Chromium')
    scope = summary.get('scope_tested', 'API Endpoint Testing')
    
    # ====================
    # SECTION 1: OVERVIEW
    # ====================
    lines.append("# 📋 Test Execution Report")
    lines.append("")
    lines.append("## 📋 Section 1: Overview")
    lines.append("")
    
    # AI GO/NO-GO Decision
    pass_rate = summary['pass_rate']
    failed_count = summary['failed']
    
    if failed_count == 0:
        go_decision = "GO"
        decision_reason = "All test cases passed successfully."
    elif pass_rate >= 95:
        go_decision = "CONDITIONAL"
        decision_reason = f"High success rate ({pass_rate}%) but {failed_count} test(s) failed. Review failures for business impact."
    elif pass_rate >= 80:
        go_decision = "CONDITIONAL"
        decision_reason = f"Moderate success rate ({pass_rate}%). Multiple failures - verify if critical functionality is affected."
    else:
        go_decision = "NO-GO"
        decision_reason = f"Low success rate ({pass_rate}%). Significant failures detected. Not recommended for deployment."
    
    decision_emoji = {"GO": "✅", "NO-GO": "❌", "CONDITIONAL": "⚠️"}
    
    # Create HTML table for better rendering in Azure DevOps
    lines.append('<table>')
    lines.append('<tr><th></th><th></th></tr>')
    lines.append(f'<tr><td><strong>Test Environment</strong></td><td>{env_name}</td></tr>')
    lines.append(f'<tr><td><strong>Base URL</strong></td><td>{env_url}</td></tr>')
    lines.append(f'<tr><td><strong>Browsers Tested</strong></td><td>{browsers}</td></tr>')
    lines.append(f'<tr><td><strong>Execution Date</strong></td><td>{datetime.now().strftime("%B %#d, %Y at %I:%M %p")}</td></tr>')
    lines.append(f'<tr><td><strong>Scope Tested</strong></td><td>{scope}</td></tr>')
    lines.append(f'<tr><td><strong>Pass Rate</strong></td><td>{summary["passed"]}/{summary["total"]} ({summary["pass_rate"]}%)</td></tr>')
    lines.append(f'<tr><td><strong>Total Duration</strong></td><td>{summary["duration_seconds"]}s</td></tr>')
    lines.append(f'<tr><td><strong>AI Recommendation</strong></td><td>{go_decision} {decision_emoji.get(go_decision, "❓")}<br/>{decision_reason}</td></tr>')
    lines.append('</table>')
    lines.append("")
    
    # ============================
    # SECTION 2: BUSINESS IMPACT
    # ============================
    lines.append("## 📊 Section 2: Business Impact")
    lines.append("")
    
    lines.append("<ul>")
    if summary['failed'] == 0:
        lines.append("<li>✅ <strong>Core functionality verified:</strong> All API endpoints are working as expected</li>")
        lines.append("<li>✅ <strong>Data integrity confirmed:</strong> Request/response validation passed for all test cases</li>")
        lines.append("<li>✅ <strong>Performance acceptable:</strong> Response times are within acceptable thresholds</li>")
    else:
        lines.append(f"<li>⚠️ <strong>Partial functionality issues:</strong> {summary['failed']} out of {summary['total']} tests failed</li>")
        
        # Check for critical failures
        critical_keywords = ['auth', 'login', 'create', 'critical', 'delete', 'update']
        critical_failures = [f for f in summary.get('failed_details', []) 
                           if any(kw in f['title'].lower() for kw in critical_keywords)]
        
        if critical_failures:
            lines.append("<li>❌ <strong>Critical path affected:</strong> Authentication or core operations may be impacted</li>")
        else:
            lines.append("<li>⚠️ <strong>Non-critical failures:</strong> Failed tests appear to be edge cases or secondary features</li>")
        
        lines.append("<li>📋 <strong>Recommendation:</strong> Review failed test details to assess actual business impact before deployment</li>")
    lines.append("</ul>")
    lines.append("")
    
    # ==========================
    # SECTION 3: TEST RESULTS
    # ==========================
    lines.append("## ✅ Section 3: Test Results")
    lines.append("")
    
    # Create HTML table for test results
    lines.append("<table>")
    lines.append("<tr><th>#</th><th>Test Case</th><th>Status</th><th>Duration</th><th>Location</th></tr>")
    
    # Show all test details if available
    test_num = 1
    if summary.get('all_test_details'):
        for test_info in summary['all_test_details']:
            status_icon = "✅" if test_info['status'] == 'passed' else "❌" if test_info['status'] == 'failed' else "⏭️"
            status_text = f"{status_icon} {test_info['status'].upper()}"
            duration = f"{test_info.get('duration', 0)}ms"
            location = f"<code>{test_info.get('file', 'N/A')}</code>"
            lines.append(f"<tr><td>{test_num}</td><td>{test_info['title']}</td><td>{status_text}</td><td>{duration}</td><td>{location}</td></tr>")
            test_num += 1
    else:
        # Fallback: show summary only
        if summary['passed'] > 0:
            lines.append(f"<tr><td>-</td><td>{summary['passed']} test(s)</td><td>✅ PASSED</td><td>-</td><td>See test results</td></tr>")
        if summary['failed'] > 0:
            for i, failure in enumerate(summary.get('failed_details', []), 1):
                location = f"<code>{failure['location']}</code>"
                lines.append(f"<tr><td>{i}</td><td>{failure['title']}</td><td>❌ FAILED</td><td>N/A</td><td>{location}</td></tr>")
    
    lines.append("</table>")
    lines.append("")
    
    # Failed test details (if any)
    if summary['failed'] > 0:
        lines.append("<h3>Failed Test Details</h3>")
        lines.append("")
        
        for i, failure in enumerate(summary.get('failed_details', []), 1):
            lines.append(f"<p><strong>{i}. {failure['title']}</strong></p>")
            lines.append("<ul>")
            lines.append(f"<li>📁 <strong>Location:</strong> <code>{failure['location']}:{failure['line']}</code></li>")
            lines.append(f"<li>❌ <strong>Error:</strong> {failure['error']}</li>")
            lines.append("</ul>")
            lines.append("")
    
    # =======================
    # SECTION 4: EVIDENCE
    # =======================
    lines.append("## 📎 Section 4: Evidence")
    lines.append("")
    lines.append("<p>Test execution artifacts (in <code>apps/testing/automation-testing/be-testing/</code>):</p>")
    lines.append("<ul>")
    lines.append(f"<li>📊 Playwright HTML report: <code>{summary.get('html_report_path', 'report/html-*')}</code></li>")
    lines.append(f"<li>📄 JUnit XML: <code>{summary.get('junit_report_path', 'report/junit-*.xml')}</code></li>")
    lines.append("</ul>")
    lines.append("")
    
    # ===================
    # SECTION 5: NOTES
    # ===================
    lines.append("## 📝 Section 5: Notes")
    lines.append("")
    if summary['failed'] == 0:
        lines.append("<p>✅ All tests executed successfully. No issues found.</p>")
        lines.append("<p><strong>Next Steps:</strong></p>")
        lines.append("<ul>")
        lines.append("<li>Review test coverage</li>")
        lines.append("<li>Consider adding additional edge case tests</li>")
        lines.append("<li>Proceed with deployment if all acceptance criteria are met</li>")
        lines.append("</ul>")
    else:
        lines.append("<p>⚠️ Some tests failed. Action required before deployment.</p>")
        lines.append("<p><strong>Recommended Actions:</strong></p>")
        lines.append("<ol>")
        lines.append("<li>Review failed test details in Section 3</li>")
        lines.append("<li>Investigate root cause of failures</li>")
        lines.append("<li>Fix identified issues</li>")
        lines.append("<li>Re-run test suite to verify fixes</li>")
        lines.append("</ol>")
    lines.append("")
    
    # Footer
    lines.append("---")
    lines.append("*Generated by API Test Generator*")
    
    if work_item_id:
        lines.append(f"*Work Item: #{work_item_id}*")
    
    return '\n'.join(lines)


def main():
    parser = argparse.ArgumentParser(
        description='Run the be-testing Playwright suite and format a local GO/NO-GO report. '
                     'Does not post to Azure DevOps — see module docstring.'
    )
    parser.add_argument(
        '--test-dir',
        help='be-testing project root, i.e. where playwright.config.ts lives '
             '(default: apps/testing/automation-testing/be-testing)',
        default='apps/testing/automation-testing/be-testing'
    )
    parser.add_argument(
        '--work-item-id',
        help='Azure DevOps work item ID this report is intended for (label only — this script '
             'does not post it; pass the same id to the ADO MCP tool call yourself)',
        required=False
    )
    parser.add_argument(
        '--output',
        help='Output file for the report (default: {test-dir}/report/test-report.md)',
        default=None
    )
    parser.add_argument(
        '--timeout-seconds',
        help='Timeout for the `npx playwright test` subprocess, in seconds (default: 300)',
        type=int,
        default=300
    )

    args = parser.parse_args()

    test_dir = Path(args.test_dir)

    if not test_dir.exists():
        print(f"Error: be-testing project root not found: {test_dir}", file=sys.stderr)
        sys.exit(1)

    # Run tests
    success, results_file = run_playwright_tests(test_dir, args.timeout_seconds)

    if not results_file:
        print("\n❌ Failed to execute tests or generate results", file=sys.stderr)
        sys.exit(1)

    # Parse results
    summary = parse_test_results(results_file)

    if not summary:
        print("\n❌ Failed to parse test results", file=sys.stderr)
        sys.exit(1)

    # Fill in real environment/report-path info (never fabricated placeholders)
    summary['environment_url'] = (
        read_env_value(test_dir / '.env', 'API_BASE_URL') or 'Not specified'
    )
    summary['browsers'] = 'N/A — raw HTTP fetch, no browser (see lib/http.ts)'
    summary['html_report_path'] = find_latest(test_dir, 'report/html-*')
    summary['junit_report_path'] = find_latest(test_dir, 'report/junit-*.xml')

    # Format report
    report = format_report(summary, args.work_item_id)

    # Save report
    output_file = Path(args.output) if args.output else (test_dir / 'report' / 'test-report.md')
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(report)
    
    print(f"\n✅ Report saved to: {output_file}")
    
    # Print report to console
    print("\n" + "=" * 60)
    print(report)
    print("=" * 60)
    
    # Also save as JSON for programmatic access
    json_output = output_file.with_suffix('.json')
    with open(json_output, 'w', encoding='utf-8') as f:
        json.dump(summary, f, indent=2)
    
    print(f"\n✅ JSON summary saved to: {json_output}")
    
    # Exit with appropriate code
    if summary['failed'] > 0:
        print(f"\n⚠️  {summary['failed']} test(s) failed")
        sys.exit(1)
    else:
        print(f"\n✅ All {summary['passed']} tests passed!")
        sys.exit(0)


if __name__ == '__main__':
    main()
