import { EditorComponentRegistry, IEditorComponent, IEditorComponentResolver, EditorComponentRenderMode } from './types';
import { IDisposable, Schemas } from '@ali/ide-core-common';
import { IResource, IEditorOpenType } from '../common';
import { Injectable } from '@ali/common-di';
import * as ReactDOM from 'react-dom';

@Injectable()
export class EditorComponentRegistryImpl implements EditorComponentRegistry {

  private components: Map<string, IEditorComponent> = new Map();

  private resolvers: Map<string, IEditorComponentResolver[]> = new Map();

  public readonly perWorkbenchComponents = {};

  public registerEditorComponent<T>(component: IEditorComponent<T>): IDisposable {
    const uid = component.uid;
    if (!component.renderMode) {
      component.renderMode = EditorComponentRenderMode.ONE_PER_GROUP;
    }
    this.components.set(uid, component);
    return {
      dispose: () => {
        if (this.components.get(uid) === component) {
          this.components.delete(uid);
        }
      },
    };
  }

  public registerEditorComponentResolver<T>(scheme: string, resolver: IEditorComponentResolver<any>): IDisposable {
    this.getResolvers(scheme).unshift(resolver); // 后来的resolver先处理
    return {
      dispose: () => {
        const index = this.getResolvers(scheme).indexOf(resolver);
        if (index !== -1) {
          this.getResolvers(scheme).splice(index, 1);
        }
      },
    };
  }

  public async resolveEditorComponent(resource: IResource): Promise<IEditorOpenType[]> {
    let results = [];
    const resolvers = this.getResolvers(resource.uri.scheme).slice(); // 防止异步操作时数组被改变
    let shouldBreak = false;
    const resolve = (res) => {
      results = res;
      shouldBreak = true;
    };
    for (const resolver of resolvers) {
      await resolver(resource, results, resolve);
      if (shouldBreak) {
        break;
      }
    }
    return results;
  }

  private getResolvers(scheme: string): IEditorComponentResolver[] {
    if (!this.resolvers.has(scheme)) {
      this.resolvers.set(scheme, this.resolvers.get(Schemas.file) || []);
    }
    return this.resolvers.get(scheme) as IEditorComponentResolver[];
  }

  public getEditorComponent(id: string): IEditorComponent | null {
    return this.components.get(id) || null;
  }

  public clearPerWorkbenchComponentCache(componentId: string) {
    ReactDOM.unmountComponentAtNode(this.perWorkbenchComponents[componentId]);
    delete this.perWorkbenchComponents[componentId];
  }

}
