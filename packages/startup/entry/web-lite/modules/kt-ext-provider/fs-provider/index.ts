import { Injectable } from '@ali/common-di';
import { Uri, Event } from '@ali/ide-core-browser';
import { FileSystemProvider, FileStat, FileType, FileChangeEvent } from '@ali/ide-file-service';

/**
 * 解析 kt-ext:// 文件，解决前端插件加载问题
 */
@Injectable()
export class KaitianExtFsProvider implements FileSystemProvider {
  onDidChangeFile: Event<FileChangeEvent>;
  watch(uri: Uri, options: { recursive: boolean; excludes: string[]; }): number {
    throw new Error('Method not implemented.');
  }

  stat(uri: Uri): Thenable<FileStat> {
    throw new Error('Method not implemented.');
  }

  readDirectory(uri: Uri): [string, FileType][] | Thenable<[string, FileType][]> {
    throw new Error('Method not implemented.');
  }

  createDirectory(uri: Uri): void | Thenable<void | FileStat> {
    throw new Error('Method not implemented.');
  }

  async readFile(uri: Uri): Promise<string> {
    const requestUrl = uri.with({ scheme: 'https' });

    return await fetch(requestUrl.toString(), {
      headers: {
        'Accept-Encoding': 'gzip, deflate',
      },
    }).then((res) => res.text());
  }

  writeFile(uri: Uri, content: string, options: { create: boolean; overwrite: boolean; }): void | Thenable<void | FileStat> {
    throw new Error('Method not implemented.');
  }

  delete(uri: Uri, options: { recursive: boolean; moveToTrash?: boolean | undefined; }): void | Thenable<void> {
    throw new Error('Method not implemented.');
  }

  rename(oldstring: Uri, newstring: Uri, options: { overwrite: boolean; }): void | Thenable<void | FileStat> {
    throw new Error('Method not implemented.');
  }
}