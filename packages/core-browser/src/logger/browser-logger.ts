import { Injectable, Autowired } from '@ali/common-di';
import { ILoggerManageClient, SupportLogNamespace, ILogServiceClient, LogLevel } from '@ali/ide-core-common';

export const ILogger = Symbol('ILogger');

// tslint:disable-next-line:no-empty-interface
export interface ILogger extends ILogServiceClient {}

@Injectable()
export class Logger implements ILogServiceClient {

  @Autowired(ILoggerManageClient)
  private LoggerManage: ILoggerManageClient;
  private logger: ILogServiceClient = this.LoggerManage.getLogger(SupportLogNamespace.Browser);

  getLevel() {
    return this.getLevel();
  }

  setLevel(level: LogLevel) {
    return this.logger.setLevel(level);
  }

  error(...args) {
    return this.logger.error(...args);
  }

  warn(...args) {
    return this.logger.warn(...args);
  }

  log(...args) {
    return this.logger.log(...args);
  }
  debug(...args) {
    return this.logger.debug(...args);
  }

  verbose(...args) {
    return this.logger.verbose(...args);
  }

  critical(...args) {
    return this.logger.critical(...args);
  }

  dispose() {
    return this.logger.dispose();
  }
}
