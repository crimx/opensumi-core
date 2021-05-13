import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { warning } from '@ali/ide-components/lib/utils';
import { IRPCProtocol, RPCProtocol } from '@ali/ide-connection/lib/common/rpcProtocol';
import { AppConfig, Deferred, Emitter, IExtensionProps, ILogger, URI } from '@ali/ide-core-browser';
import { Disposable } from '@ali/ide-core-common';
import { posix } from '@ali/ide-core-common/lib/path';

import { IExtension, IExtensionWorkerHost, WorkerHostAPIIdentifier } from '../common';
import { ActivatedExtensionJSON } from '../common/activator';
import { AbstractWorkerExtProcessService } from '../common/extension.service';
import { getWorkerBootstrapUrl } from './loader';
import { initWorkerTheadAPIProxy } from './vscode/api/main.thread.api.impl';
import { startInsideIframe } from './workerHostIframe';

@Injectable()
export class WorkerExtProcessService extends Disposable implements AbstractWorkerExtProcessService<IExtensionWorkerHost> {
  @Autowired(AppConfig)
  private readonly appConfig: AppConfig;

  @Autowired(ILogger)
  protected readonly logger: ILogger;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  public ready: Deferred<void> = new Deferred();
  private _extHostUpdated: Deferred<void> = new Deferred();

  private extensions: IExtension[] = [];

  public protocol: IRPCProtocol;

  // noop
  public disposeProcess() {
    return;
  }

  public async activate(ignoreCors?: boolean): Promise<IRPCProtocol> {
    this.protocol = await this.createExtProcess(ignoreCors);

    if (this.protocol) {
      this.ready.resolve();
      this.logger.log('[Worker Host] init worker thread api proxy');
      this.logger.verbose(this.protocol);
      const dispose = await initWorkerTheadAPIProxy(this.protocol, this.injector, this);
      this.addDispose({ dispose });

      await this.getProxy().$updateExtHostData();
      this._extHostUpdated.resolve();
    }
    return this.protocol;
  }

  public async activeExtension(extension: IExtension): Promise<void> {
    const { extendConfig, packageJSON } = extension;
    // 对使用 kaitian.js 的老插件兼容
    // 因为可能存在即用了 kaitian.js 作为入口，又注册了 kaitianContributes 贡献点的插件
    if (extendConfig?.worker?.main) {
      warning(false, '[Deprecated warning]: kaitian.js is deprecated, please use `package.json#kaitianContributes` instead');
      await this.doActivateExtension(extension);
      return;
    }

    // 激活 workerMain 相关部分
    if (packageJSON.kaitianContributes && extension.contributes?.workerMain) {
      await this.doActivateExtension(extension);
    }
  }

  private async doActivateExtension(extension: IExtension) {
    if (this.appConfig.extWorkerHost) {
      // 只有当 proxy.$updateExtHostData 调用之后才可以开始激活插件
      await this._extHostUpdated.promise;
      await this.getProxy().$activateExtension(extension.id);
    }
  }

  public async updateExtensionData(extensions: IExtension[]): Promise<void> {
    this.extensions = extensions;
    if (this.protocol) {
      this.getProxy().$updateExtHostData();
    }
  }

  public getExtension(extensionId: string): IExtension | undefined {
    return this.extensions.find((e) => e.id === extensionId);
  }

  // 以下三个方法是给插件进程调用的 rpc call
  /**
   * FIXME: 这个绝对是写错了... @柳千
   */
  public async $activateExtension(extensionPath: string): Promise<void> {
    const extension = this.extensions.find((n) => n.path === extensionPath);
    if (extension) {
      await extension.activate();
    }
  }

  public async $getExtensions(): Promise<IExtensionProps[]> {
    return this.extensions.map((extension) => {
      if (extension.contributes && extension.contributes.workerMain) {
        return this.getWorkerExtensionProps(extension, extension.contributes.workerMain);
      } else if (
        extension.extendConfig &&
        extension.extendConfig.worker &&
        extension.extendConfig.worker.main
      ) {
        return this.getWorkerExtensionProps(extension, extension.extendConfig.worker.main);
      } else {
        return extension.toJSON();
      }
    });
  }

  public async $getStaticServicePath() {
    return this.appConfig.staticServicePath || 'http://127.0.0.1:8000';
  }

  private async createExtProcess(ignoreCors?: boolean) {
    const workerSrc = getWorkerBootstrapUrl(this.appConfig.extWorkerHost!, 'ExtensionWorkerHost', ignoreCors);
    return await this.initWorkerProtocol(workerSrc);
  }

  private async initWorkerProtocol(workerUrl: string): Promise<IRPCProtocol> {
    this.logger.log('[Worker Host] init web worker extension host');

    return new Promise((resolve, reject) => {
      const ready = new Deferred<MessagePort>();
      const onMessageEmitter = new Emitter<any>();
      if (this.appConfig.useIframeWrapWorkerHost) {
        const { iframe, extHostUuid } = startInsideIframe(workerUrl);
        window.addEventListener('message', (event) => {
          if (event.source !== iframe.contentWindow) {
            return;
          }

          if (event.data.kaitianWebWorkerExtHostId !== extHostUuid) {
            return;
          }

          if (event.data.data instanceof MessagePort) {
            ready.resolve(event.data.data);
            return;
          }
        });

        ready.promise.then((port) => {
          resolve(this.createProtocol(port, onMessageEmitter));
        });

      } else {
        try {
          const extendWorkerHost = new Worker(workerUrl, { name: 'KaitianWorkerExtensionHost' });
          this.addDispose({
            dispose: () => extendWorkerHost.terminate(),
          });
          extendWorkerHost.onmessage = (e) => {
            if (e.data instanceof MessagePort) {
              ready.resolve(e.data);
            }
          };

          extendWorkerHost.onerror = (err) => {
            reject(err);
          };

          ready.promise.then((port) => {
            resolve(this.createProtocol(port, onMessageEmitter));
          });
        } catch (err) {
          reject(err);
        }
      }
    });
  }

  private createProtocol(port: MessagePort, emitter: Emitter<string>) {
    const onMessage = emitter.event;
    const protocol = new RPCProtocol({
      onMessage,
      send: port.postMessage.bind(port),
    }, this.logger);

    port.onmessage = (event) => {
      emitter.fire(event.data);
    };
    this.logger.log('[Worker Host] web worker extension host ready');
    return protocol;
  }

  getActivatedExtensions(): Promise<ActivatedExtensionJSON[]> {
    return this.getProxy().$getActivatedExtensions();
  }

  public getProxy() {
    return this.protocol.getProxy<IExtensionWorkerHost>(WorkerHostAPIIdentifier.ExtWorkerHostExtensionService);
  }

  private getWorkerExtensionProps(extension: IExtension, workerMain: string) {
    // 这里路径遵循 posix 方式，fsPath 会自动根据平台转换
    const workerScriptURI = new URI(extension.extensionLocation.with({
      path: posix.join(extension.extensionLocation.path, workerMain),
    }));
    return Object.assign({}, extension.toJSON(), { workerScriptPath: workerScriptURI.toString() });
  }
}