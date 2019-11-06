import { format, mnemonicButtonLabel } from './utils/strings';

export type ILocalizationKey = string; //ts不支持symbol作为key

const localizationRegistryMap = new Map<string, ILocalizationRegistry>();

export function localize(symbol: ILocalizationKey, defaultMessage?: string | undefined, scope: string = 'host'): string {
  const localizationRegistry = getLocalizationRegistry(scope);
  return localizationRegistry.getLocalizeString(symbol, defaultMessage);
}

export function formatLocalize(symbol: ILocalizationKey, ...args: any){
  return format(localize(symbol), ...args);
}

export function registerLocalizationBundle(bundle: ILocalizationBundle, scope: string = 'host') {
  return getLocalizationRegistry(scope).registerLocalizationBundle(bundle);
}

export interface ILocalizationBundle extends ILocalizationInfo{
  contents: ILocalizationContents;
}

export interface ILocalizationInfo {
  languageId: string;
  languageName: string;
  localizedLanguageName: string;
}

export interface ILocalizationContents{
  [key : string ]: string;
}

interface ILocalizationRegistry {

  readonly currentLanguageId: string;

  registerLocalizationBundle(bundle: ILocalizationBundle): void;

  getLocalizeString(symbol: ILocalizationKey, defaultLabel?: string): string;

  getAllLanguages(): ILocalizationInfo[];
}

class LocalizationRegistry implements ILocalizationRegistry {

  constructor(private _currentLanguageId: string = 'zh-CN'){

  }

  private localizationMap: Map<string, ILocalizationContents> = new Map() ;

  public readonly localizationInfo: Map<string, ILocalizationInfo> = new Map();

  get currentLanguageId() {
    return this._currentLanguageId!;
  }

  set currentLanguageId(languageId: string) {
    if (languageId) {
      this._currentLanguageId = languageId;
    }
  }

  registerLocalizationBundle(bundle: ILocalizationBundle): void {
    const existingMessages = this.getContents(bundle.languageId);
    Object.keys(bundle.contents).forEach((key: ILocalizationKey)=> {
      existingMessages[key] = mnemonicButtonLabel(bundle.contents[key], true); // 暂时去除所有注记符
    });
    if (!this.localizationInfo.has(bundle.languageId)) {
      this.localizationInfo.set(bundle.languageId, Object.assign({}, bundle, {contents: undefined}));
    }
  }

  getLocalizeString(key: ILocalizationKey, defaultLabel?: string | null): string {
    let defaultMessage = defaultLabel;
    if (defaultLabel === null) {
      defaultMessage = this.getContents('en-US')[key as keyof ILocalizationContents]
    }
    return this.getContents(this.currentLanguageId)[key as keyof ILocalizationContents] || defaultMessage || '';
  }

  private getContents(languageId: string): ILocalizationContents {
    languageId = languageId.toLowerCase();
    if (!this.localizationMap.has(languageId)) {
      this.localizationMap.set(languageId, {})
    }
    return this.localizationMap.get(languageId) as ILocalizationContents;
  }

  getAllLanguages(): ILocalizationInfo[] {
    return Array.from(this.localizationInfo.values());
  }
}

/**
 * 获取当前语言别名，默认为中文
 * TODO 临时通过 href 获取
 * @returns 当前语言别名
 */
export function getLanguageId(scope: string = 'host'): string {
  return getLocalizationRegistry(scope).currentLanguageId;
}

export function getCurrentLanguageInfo(scope: string = 'host'): ILocalizationInfo {
  return getLocalizationRegistry(scope).localizationInfo.get(getLocalizationRegistry(scope).currentLanguageId)!;
}

export function setLanguageId(language, scope: string = 'host'): void {
  getLocalizationRegistry(scope).currentLanguageId = language;
}

export function getAvailableLanguages(scope: string = 'host'): ILocalizationInfo[] {
  return getLocalizationRegistry(scope).getAllLanguages();
}

function getLocalizationRegistry(scope: string): LocalizationRegistry {
  if(!localizationRegistryMap[scope]){
    localizationRegistryMap[scope] = new LocalizationRegistry(window.localStorage && window.localStorage.getItem('1:general.language') || 'zh-CN');
  }
  return localizationRegistryMap[scope];
}

/**
 * 含有占位符标识的 key 转换
 * @param label
 */
export function replaceLocalizePlaceholder(label?: string, env?: string): string | undefined {
  if (label) {
    return label.replace(/%(.*?)%/g, (_, p) => localize(p, undefined, env)) ;
  }
}


