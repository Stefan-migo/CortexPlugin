import { spawn, ChildProcess } from 'child_process';
import { createInterface, Interface } from 'readline';

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timer: NodeJS.Timeout;
}

export class MCPClient {
  private process: ChildProcess | null = null;
  private rl: Interface | null = null;
  private pending = new Map<number, PendingRequest>();
  private nextId = 1;

  constructor(
    private command: string,
    private args: string[] = [],
  ) {}

  async initialize(): Promise<void> {
    return new Promise<void>((outerResolve, outerReject) => {
      try {
        this.process = spawn(this.command, this.args, {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        this.rl = createInterface({ input: this.process.stdout! });

        this.rl.on('line', (line: string) => {
          try {
            const msg = JSON.parse(line);
            if (msg.id != null && this.pending.has(msg.id)) {
              const entry = this.pending.get(msg.id)!;
              clearTimeout(entry.timer);
              this.pending.delete(msg.id);
              if (msg.error) {
                entry.reject(new Error(msg.error.message || 'MCP error'));
              } else {
                entry.resolve(msg.result);
              }
            }
          } catch {
          }
        });

        this.process.on('error', (err: Error) => {
          this.rejectAll(err);
          outerReject(err);
        });

        this.process.on('exit', (code: number | null) => {
          if (code !== null && code !== 0) {
            const err = new Error(`MCP process exited with code ${code}`);
            this.rejectAll(err);
            outerReject(err);
          }
        });

        this.process.stdin!.on('error', () => {
        });

        const id = this.nextId++;
        const timer = setTimeout(() => {
          this.pending.delete(id);
          outerReject(new Error('MCP initialize timed out'));
        }, 5000);

        this.pending.set(id, {
          resolve: () => {
            this.sendNotification('notifications/initialized');
            outerResolve();
          },
          reject: outerReject,
          timer,
        });

        this.process.stdin!.write(JSON.stringify({
          jsonrpc: '2.0',
          id,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'cortex-cli', version: '1.0.0' },
          },
        }) + '\n');
      } catch (err) {
        outerReject(err);
      }
    });
  }

  async callTool(name: string, args: any = {}): Promise<any> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP tool call "${name}" timed out`));
      }, 5000);

      this.pending.set(id, { resolve, reject, timer });

      this.process!.stdin!.write(JSON.stringify({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name, arguments: args },
      }) + '\n');
    });
  }

  async close(): Promise<void> {
    this.rl?.close();
    if (this.process && !this.process.killed) {
      this.process.kill();
    }
    this.process = null;
    this.rl = null;
  }

  private sendNotification(method: string, params?: any): void {
    try {
      const msg = { jsonrpc: '2.0', method, params };
      this.process!.stdin!.write(JSON.stringify(msg) + '\n');
    } catch {
    }
  }

  private rejectAll(err: Error): void {
    for (const [id, entry] of this.pending) {
      clearTimeout(entry.timer);
      entry.reject(err);
    }
    this.pending.clear();
  }
}
