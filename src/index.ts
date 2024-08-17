import { assert } from "console";
import { unlinkSync } from "fs";
import { connect, createServer, Server } from "net";
import { tmpdir } from "os";
import path from "path";
import { EventEmitter } from "events";

interface IOptions {
  socketPath?: string;
}

/* Options:
**   - socketPath: Can contain a custom socket path
*/
export class SingleInstance extends EventEmitter {
  public readonly socketPath: string;

  private server?: Server;

  public constructor(
    public readonly appName: string,
    public readonly options: IOptions = {}
  ) {
    super();
    assert(appName, "Missing required parameter 'appName'.");

    var defaultSocketPath = (process.platform == 'win32') ?
      '\\\\.\\pipe\\' + appName + '-sock' :
      path.join(tmpdir(), appName + '.sock');

    this.socketPath = this.options.socketPath ?? defaultSocketPath;
    this.server = undefined;
  }

  public async lock(): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = connect({ path: this.socketPath }, () => {
        client.write('connection-attempt', () => {
          reject(new Error('An application is already running'));
        });
      });
  
      client.on('error', () => {
        try {
          unlinkSync(this.socketPath);
        } catch {
          // Errors get handled below
        }
        this.server = createServer((connection) => {
          connection.on('data', () => {
            this.emit('connection-attempt');
          });
        });
        this.server.listen(this.socketPath);
        this.server.on('error', reject);
        this.server.on('listening', resolve);
      });
    });
  }

public unlock(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!this.server) {
      resolve();
      return;
    }

    this.server.close((err) => {
      if (err) {
        reject(err)
      } else {
        resolve();
      }
    });
  });
}
}
module.exports = SingleInstance