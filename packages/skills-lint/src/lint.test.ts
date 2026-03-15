import { describe, expect, it } from 'vitest';
import { BLOCKED_COMMANDS, extractBashBlocks, scanLines } from './lint.ts';

describe('scanLines', () => {
  it('flags rm command', () => {
    const violations = scanLines('rm -rf /tmp/test', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('rm');
    expect(violations[0].line).toBe(1);
  });

  it('flags sudo command', () => {
    const violations = scanLines('sudo apt-get install curl', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('sudo');
  });

  it('flags nft command', () => {
    const violations = scanLines('nft add rule inet filter input tcp dport 22 drop', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('nft');
  });

  it('flags mkfs.ext4 command', () => {
    const violations = scanLines('mkfs.ext4 /dev/sda1', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('mkfs');
  });

  it('flags mkfs.xfs command', () => {
    const violations = scanLines('mkfs.xfs /dev/sdb1', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('mkfs');
  });

  it('flags path-prefixed mkfs.ext4 command', () => {
    const violations = scanLines('/sbin/mkfs.ext4 /dev/sdc1', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('mkfs');
  });

  it('flags chmod command', () => {
    const violations = scanLines('chmod 777 /etc/passwd', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('chmod');
  });

  it('flags eval command', () => {
    const violations = scanLines('eval "$DANGEROUS_STRING"', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('eval');
  });

  it('flags path-prefixed rm (/bin/rm)', () => {
    const violations = scanLines('/bin/rm -rf /tmp', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('rm');
  });

  it('flags path-prefixed rm (./rm)', () => {
    const violations = scanLines('./rm -rf /tmp', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('rm');
  });

  it('flags rm after pipe', () => {
    const violations = scanLines('echo test | rm -rf /tmp', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('rm');
  });

  it('does not flag rm as substring of another word (framework)', () => {
    const violations = scanLines('echo framework', 'test.sh', 0);
    expect(violations).toHaveLength(0);
  });

  it('flags rm inside a full-line comment', () => {
    const violations = scanLines('# rm -rf /tmp is used here', 'test.sh', 0);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('rm');
  });

  it('skips blank lines', () => {
    const violations = scanLines('\n\n\n', 'test.sh', 0);
    expect(violations).toHaveLength(0);
  });

  it('does not flag safe commands', () => {
    const violations = scanLines('curl https://example.com | grep "text"', 'test.sh', 0);
    expect(violations).toHaveLength(0);
  });

  it('reports correct line numbers with lineOffset', () => {
    const code = 'echo hello\nrm -rf /tmp';
    const violations = scanLines(code, 'test.sh', 10);
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(12); // offset 10 + line index 1 + 1
  });

  it('reports at most one violation per line', () => {
    // rm and sudo on same line — should report only one
    const violations = scanLines('sudo rm -rf /tmp', 'test.sh', 0);
    expect(violations).toHaveLength(1);
  });

  it('includes the file path in the violation', () => {
    const violations = scanLines('rm file', '/path/to/script.sh', 0);
    expect(violations[0].file).toBe('/path/to/script.sh');
  });

  it('includes the trimmed line content in the violation', () => {
    const violations = scanLines('  rm -rf /tmp  ', 'test.sh', 0);
    expect(violations[0].content).toBe('rm -rf /tmp');
  });
});

describe('extractBashBlocks', () => {
  it('extracts a bash code block', () => {
    const md = '# Heading\n\n```bash\necho hello\n```\n';
    const blocks = extractBashBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('echo hello');
  });

  it('extracts a sh code block', () => {
    const md = '```sh\necho hi\n```';
    const blocks = extractBashBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('echo hi');
  });

  it('extracts a shell code block', () => {
    const md = '```shell\necho hi\n```';
    const blocks = extractBashBlocks(md);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].code).toBe('echo hi');
  });

  it('does not extract typescript code blocks', () => {
    const md = '```typescript\nconst x = rm;\n```';
    const blocks = extractBashBlocks(md);
    expect(blocks).toHaveLength(0);
  });

  it('does not extract plain code blocks (no language)', () => {
    const md = '```\nrm -rf /tmp\n```';
    const blocks = extractBashBlocks(md);
    expect(blocks).toHaveLength(0);
  });

  it('reports correct startLine for block content', () => {
    const md = 'line1\nline2\n```bash\ncontent\n```';
    const blocks = extractBashBlocks(md);
    // ```bash is on line index 2, so content starts at index 3 (1-based: line 4)
    expect(blocks[0].startLine).toBe(3);
  });

  it('extracts multiple bash blocks', () => {
    const md = '```bash\necho one\n```\n\n```bash\necho two\n```';
    const blocks = extractBashBlocks(md);
    expect(blocks).toHaveLength(2);
    expect(blocks[0].code).toBe('echo one');
    expect(blocks[1].code).toBe('echo two');
  });

  it('extracts multi-line block content', () => {
    const md = '```bash\nline1\nline2\nline3\n```';
    const blocks = extractBashBlocks(md);
    expect(blocks[0].code).toBe('line1\nline2\nline3');
  });
});

describe('integration: scanLines on bash block content', () => {
  it('detects rm in bash block and reports correct line number', () => {
    const md = '# Title\n\n```bash\nbash /path/to/script.sh\nrm -rf /tmp/test\n```';
    const blocks = extractBashBlocks(md);
    expect(blocks).toHaveLength(1);
    const violations = scanLines(blocks[0].code, 'test.md', blocks[0].startLine);
    expect(violations).toHaveLength(1);
    expect(violations[0].command).toBe('rm');
    expect(violations[0].line).toBe(5);
  });
});

describe('BLOCKED_COMMANDS coverage', () => {
  const blockedCommands = Object.keys(BLOCKED_COMMANDS);

  it('includes rm', () => expect(blockedCommands).toContain('rm'));
  it('includes sudo', () => expect(blockedCommands).toContain('sudo'));
  it('includes chmod', () => expect(blockedCommands).toContain('chmod'));
  it('includes eval', () => expect(blockedCommands).toContain('eval'));
  it('includes shutdown', () => expect(blockedCommands).toContain('shutdown'));
  it('includes dd', () => expect(blockedCommands).toContain('dd'));
});
