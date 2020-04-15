import { IToolBarViewService, ToolBarPosition, IToolBarElementHandle, IToolBarAction, IToolBarComponent } from './types';
import { removeObjectFromArray } from '@ali/ide-core-common/lib/functional';
import { observable } from 'mobx';
import { Disposable } from '@ali/ide-core-browser';
import { Injectable } from '@ali/common-di';

@Injectable()
export class ToolBarViewService implements IToolBarViewService {

  private elements: {
    [position: string]: ToolBarElementHandle[],
  } = {
    [ToolBarPosition.LEFT]: observable.array([]),
    [ToolBarPosition.RIGHT]: observable.array([]),
    [ToolBarPosition.CENTER]: observable.array([]),
  };

  registerToolBarElement(element: IToolBarAction | IToolBarComponent) {

    const handle = new ToolBarElementHandle(element);
    this.elements[element.position].push(handle);
    // sort elements
    this.elements[element.position] = this.elements[element.position].sort((a, b) => (a.element.order || 0) - (b.element.order || 0));
    handle.addDispose({
      dispose: () => {
        removeObjectFromArray(this.elements[element.position], handle);
      },
    });
    return handle;
  }

  getVisibleElements(position: ToolBarPosition): (IToolBarComponent | IToolBarAction)[] {
    return this.elements[position].filter((handle) => handle.visible).map((handle) => handle.element);
  }

}

export class ToolBarElementHandle extends Disposable implements IToolBarElementHandle {

  @observable
  public visible: boolean = true;

  constructor(public readonly element: IToolBarAction | IToolBarComponent) {
    super();
  }

  setVisible(visible: boolean) {
    this.visible = visible;
  }
}
