/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isLinux, isWindows } from "../utils/os";

// https://github.com/microsoft/node-native-keymap/blob/master/index.d.ts

export interface IWindowsKeyboardMapping {
  [code: string]: IWindowsKeyMapping;
}

export interface IWindowsKeyMapping {
	vkey: string;
	value: string;
	withShift: string;
	withAltGr: string;
	withShiftAltGr: string;
}

export interface IWindowsKeyboardLayoutInfo {
  name: string;
  id: string;
  text: string;
}

export interface ILinuxKeyboardLayoutInfo {
  model: string;
  layout: string;
  variant: string;
  options: string;
  rules: string;
}

export interface IMacKeyboardLayoutInfo {
  id: string;
  localizedName?: string;
  lang: string;
}

export interface IWindowsKeyboardLayoutInfo {
  name: string;
  id: string;
  text: string;
}

export type IKeyboardLayoutInfo = (IWindowsKeyboardLayoutInfo | ILinuxKeyboardLayoutInfo | IMacKeyboardLayoutInfo) & { isUserKeyboardLayout?: boolean; isUSStandard?: true };

export interface ISerializedMapping {
  [key: string]: (string | number)[];
}

export interface IKeymapInfo {
  layout: IKeyboardLayoutInfo;
  secondaryLayouts: IKeyboardLayoutInfo[];
  mapping: ISerializedMapping;
  isUserKeyboardLayout?: boolean;
}

export interface IRawMixedKeyboardMapping {
	[key: string]: {
		value: string,
		withShift: string;
		withAltGr: string;
		withShiftAltGr: string;
		valueIsDeadKey?: boolean;
		withShiftIsDeadKey?: boolean;
		withAltGrIsDeadKey?: boolean;
		withShiftAltGrIsDeadKey?: boolean;
	};
}

function deserializeMapping(serializedMapping: ISerializedMapping) {
	let mapping = serializedMapping;

	let ret: { [key: string]: any } = {};
	for (let key in mapping) {
		let result: (string | number)[] = mapping[key];
		if (result.length) {
			let value = result[0];
			let withShift = result[1];
			let withAltGr = result[2];
			let withShiftAltGr = result[3];
			let mask = Number(result[4]);
			let vkey = result.length === 6 ? result[5] : undefined;
			ret[key] = {
				'value': value,
				'vkey': vkey,
				'withShift': withShift,
				'withAltGr': withAltGr,
				'withShiftAltGr': withShiftAltGr,
				'valueIsDeadKey': (mask & 1) > 0,
				'withShiftIsDeadKey': (mask & 2) > 0,
				'withAltGrIsDeadKey': (mask & 4) > 0,
				'withShiftAltGrIsDeadKey': (mask & 8) > 0
			};
		} else {
			ret[key] = {
				'value': '',
				'valueIsDeadKey': false,
				'withShift': '',
				'withShiftIsDeadKey': false,
				'withAltGr': '',
				'withAltGrIsDeadKey': false,
				'withShiftAltGr': '',
				'withShiftAltGrIsDeadKey': false
			};
		}
	}

	return ret;
}

export function getKeyboardLayoutId(layout: IKeyboardLayoutInfo): string {
  if ((<IWindowsKeyboardLayoutInfo>layout).name) {
		return (<IWindowsKeyboardLayoutInfo>layout).name;
	}

	if ((<IMacKeyboardLayoutInfo>layout).id) {
		return (<IMacKeyboardLayoutInfo>layout).id;
	}
	return (<ILinuxKeyboardLayoutInfo>layout).layout;
}

export class KeymapInfo {
	mapping: IRawMixedKeyboardMapping;
	isUserKeyboardLayout: boolean;

	constructor(public layout: IKeyboardLayoutInfo, public secondaryLayouts: IKeyboardLayoutInfo[], keyboardMapping: ISerializedMapping, isUserKeyboardLayout?: boolean) {
		this.mapping = deserializeMapping(keyboardMapping);
		this.isUserKeyboardLayout = !!isUserKeyboardLayout;
		this.layout.isUserKeyboardLayout = !!isUserKeyboardLayout;
	}

	static createKeyboardLayoutFromDebugInfo(layout: IKeyboardLayoutInfo, value: IRawMixedKeyboardMapping, isUserKeyboardLayout?: boolean): KeymapInfo {
		let keyboardLayoutInfo = new KeymapInfo(layout, [], {}, true);
		keyboardLayoutInfo.mapping = value;
		return keyboardLayoutInfo;
	}

	update(other: KeymapInfo) {
		this.layout = other.layout;
		this.secondaryLayouts = other.secondaryLayouts;
		this.mapping = other.mapping;
		this.isUserKeyboardLayout = other.isUserKeyboardLayout;
		this.layout.isUserKeyboardLayout = other.isUserKeyboardLayout;
	}

	getScore(other: IRawMixedKeyboardMapping): number {
		let score = 0;
		for (let key in other) {
			if (isWindows && (key === 'Backslash' || key === 'KeyQ')) {
				// keymap from Chromium is probably wrong.
				continue;
			}

			if (isLinux && (key === 'Backspace' || key === 'Escape')) {
				// native keymap doesn't align with keyboard event
				continue;
			}

			let currentMapping = this.mapping[key];

			if (currentMapping === undefined) {
				score -= 1;
			}

			let otherMapping = other[key];

			if (currentMapping && otherMapping && currentMapping.value !== otherMapping.value) {
				score -= 1;
			}
		}

		return score;
	}

	equal(other: KeymapInfo): boolean {
		if (this.isUserKeyboardLayout !== other.isUserKeyboardLayout) {
			return false;
		}

		if (getKeyboardLayoutId(this.layout) !== getKeyboardLayoutId(other.layout)) {
			return false;
		}

		return this.fuzzyEqual(other.mapping);
	}

	fuzzyEqual(other: IRawMixedKeyboardMapping): boolean {
		for (let key in other) {
			if (isWindows && (key === 'Backslash' || key === 'KeyQ')) {
				// keymap from Chromium is probably wrong.
				continue;
			}
			if (this.mapping[key] === undefined) {
				return false;
			}

			let currentMapping = this.mapping[key];
			let otherMapping = other[key];

			if (currentMapping.value !== otherMapping.value) {
				return false;
			}
		}

		return true;
	}
}