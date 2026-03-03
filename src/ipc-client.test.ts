/**
 * Tests for the IpcClient pattern used in container/agent-runner/src/index.ts.
 *
 * IpcClient is embedded in the agent-runner (which has SDK dependencies not
 * available on the host), so we replicate its logic here for testing.
 * The class under test mirrors container/agent-runner/src/index.ts exactly.
 */
import { EventEmitter } from 'events';
import { describe, expect, it } from 'vitest';

/** Minimal mock socket that emits data/error/close events. */
class MockSocket extends EventEmitter {
  destroyed = false;

  destroy(): void {
    this.destroyed = true;
    this.emit('close');
  }
}

/**
 * Mirror of the IpcClient class from container/agent-runner/src/index.ts.
 * Keep in sync with the real implementation.
 */
class IpcClient {
  private buffer = '';
  private messageQueue: string[] = [];
  private closeReceived = false;
  private waitResolve: (() => void) | null = null;

  constructor(socket: MockSocket) {
    socket.on('data', (raw: Buffer | string) => {
      this.buffer += raw.toString();
      let idx: number;
      while ((idx = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, idx).trim();
        this.buffer = this.buffer.slice(idx + 1);
        if (!line) continue;
        try {
          const msg = JSON.parse(line);
          if (msg.type === 'close') {
            this.closeReceived = true;
          } else if (msg.type === 'message' && msg.text) {
            this.messageQueue.push(msg.text);
          }
        } catch {
          // invalid JSON — skip
        }
        this.waitResolve?.();
      }
    });

    socket.on('error', () => {
      this.closeReceived = true;
      this.waitResolve?.();
    });

    socket.on('close', () => {
      this.closeReceived = true;
      this.waitResolve?.();
    });
  }

  drainMessages(): string[] {
    return this.messageQueue.splice(0);
  }

  shouldClose(): boolean {
    return this.closeReceived;
  }

  waitForMessage(): Promise<string | null> {
    if (this.closeReceived) return Promise.resolve(null);
    const msgs = this.drainMessages();
    if (msgs.length > 0) return Promise.resolve(msgs.join('\n'));

    return new Promise<string | null>((resolve) => {
      const tryResolve = () => {
        if (this.closeReceived) { resolve(null); return; }
        const drained = this.drainMessages();
        if (drained.length > 0) { resolve(drained.join('\n')); return; }
        // Spurious wake — re-register instead of recursing
        this.waitResolve = tryResolve;
      };
      this.waitResolve = tryResolve;
    });
  }
}

describe('IpcClient', () => {
  it('returns immediately queued message from waitForMessage', async () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    // Queue a message before calling waitForMessage
    sock.emit('data', JSON.stringify({ type: 'message', text: 'hello' }) + '\n');

    const result = await client.waitForMessage();
    expect(result).toBe('hello');
  });

  it('waits for async message arrival', async () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    const promise = client.waitForMessage();

    // Message arrives after waitForMessage starts waiting
    sock.emit('data', JSON.stringify({ type: 'message', text: 'delayed' }) + '\n');

    const result = await promise;
    expect(result).toBe('delayed');
  });

  it('returns null on close signal', async () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    const promise = client.waitForMessage();
    sock.emit('data', JSON.stringify({ type: 'close' }) + '\n');

    const result = await promise;
    expect(result).toBeNull();
  });

  it('handles spurious wake from partial data', async () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    const promise = client.waitForMessage();

    // Partial data — no newline yet (causes wake but no complete message)
    sock.emit('data', '{"type":"mess');

    // Complete the message
    sock.emit('data', 'age","text":"split"}\n');

    const result = await promise;
    expect(result).toBe('split');
  });

  it('returns null on socket error', async () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    const promise = client.waitForMessage();
    sock.emit('error', new Error('connection reset'));

    const result = await promise;
    expect(result).toBeNull();
    expect(client.shouldClose()).toBe(true);
  });

  it('returns null on socket close', async () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    const promise = client.waitForMessage();
    sock.emit('close');

    const result = await promise;
    expect(result).toBeNull();
  });

  it('drainMessages returns and clears all queued messages', () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    sock.emit('data',
      JSON.stringify({ type: 'message', text: 'one' }) + '\n' +
      JSON.stringify({ type: 'message', text: 'two' }) + '\n' +
      JSON.stringify({ type: 'message', text: 'three' }) + '\n',
    );

    const drained = client.drainMessages();
    expect(drained).toEqual(['one', 'two', 'three']);

    // Second drain should be empty
    expect(client.drainMessages()).toEqual([]);
  });

  it('joins multiple queued messages in waitForMessage', async () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    sock.emit('data',
      JSON.stringify({ type: 'message', text: 'a' }) + '\n' +
      JSON.stringify({ type: 'message', text: 'b' }) + '\n',
    );

    const result = await client.waitForMessage();
    expect(result).toBe('a\nb');
  });

  it('ignores messages with no text field', () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    sock.emit('data', JSON.stringify({ type: 'message' }) + '\n');

    expect(client.drainMessages()).toEqual([]);
  });

  it('skips invalid JSON without crashing', () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    sock.emit('data', 'not-json\n' + JSON.stringify({ type: 'message', text: 'ok' }) + '\n');

    expect(client.drainMessages()).toEqual(['ok']);
  });

  it('returns null immediately if close already received', async () => {
    const sock = new MockSocket();
    const client = new IpcClient(sock);

    sock.emit('data', JSON.stringify({ type: 'close' }) + '\n');

    const result = await client.waitForMessage();
    expect(result).toBeNull();
  });
});
