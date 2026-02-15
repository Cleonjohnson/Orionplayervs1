/**

 * Device type and TV detection (Fire TV / Android TV).

 * Use isTV / IS_TV to auto-set layout, fonts, and focusable UI.

 */

import { Platform } from 'react-native';



export const isTV = Platform.isTV === true;

/** Alias for TV detection; use for dynamic font sizes e.g. fontSize: IS_TV ? 24 : 14 */

export const IS_TV = isTV;



/** Font size helper: phone size on mobile, larger on TV for 10-foot HD UI. */

export const fs = (phone, tv = 32) => (isTV ? tv : phone);



export const KEY_DEVICE = 'orion_device_type';

export const KEY_DEVICE_SELECTED = 'orion_device_selected_once';



export const APP_MODE = {

  TV: 'TV',

  MOBILE: 'Mobile',

};



/** Returns 'TV' on Fire TV/Android TV, 'Mobile' otherwise. */

export function getAppModeFromPlatform() {

  return isTV ? APP_MODE.TV : APP_MODE.MOBILE;

}

