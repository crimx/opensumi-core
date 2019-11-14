import { WithEventBus, ComponentRegistryInfo } from '@ali/ide-core-browser';
import { Injectable, Autowired, INJECTOR_TOKEN, Injector } from '@ali/common-di';
import { observable, action } from 'mobx';

export const TabbarServiceFactory = Symbol('TabbarServiceFactory');

// TODO 存尺寸，存状态
@Injectable({multiple: true})
export class TabbarService extends WithEventBus {
  @observable currentContainerId: string;

  @observable.shallow containersMap: Map<string, ComponentRegistryInfo> = new Map();

  private prevSize?: number;

  constructor(public location: string) {
    super();
  }

  registerContainer(containerId: string, componentInfo: ComponentRegistryInfo) {
    this.containersMap.set(containerId, componentInfo);
  }

  getContainer(containerId: string) {
    return this.containersMap.get(containerId);
  }

  @action.bound handleTabClick(
    e: React.MouseEvent,
    setSize: (size: number, side: string) => void,
    getSize: (side: string) => number,
    forbidCollapse?: boolean) {
    const containerId = e.currentTarget.id;
    if (containerId === this.currentContainerId && !forbidCollapse) {
      this.prevSize = getSize(this.location);
      this.currentContainerId = '';
      setSize(50, this.location);
    } else {
      if (this.prevSize === undefined) {
        this.prevSize = getSize(this.location);
      }
      this.currentContainerId = containerId;
      setSize(this.prevSize || 400, this.location);
    }
  }

}
