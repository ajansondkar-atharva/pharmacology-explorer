/* View registry — imports and registers every view module. */

import * as home from './home';
import * as directory from './directory';
import * as monograph from './monograph';
import * as compare from './compare';

export function registerViews(): void {
  home.register();
  directory.register();
  monograph.register();
  compare.register();
}
