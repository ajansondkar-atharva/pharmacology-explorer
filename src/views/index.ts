/* View registry — imports and registers every view module. */

import * as home from './home';
import * as directory from './directory';
import * as monograph from './monograph';
import * as compare from './compare';
import * as interactions from './interactions';
import * as pkLab from './pk-lab';
import * as mechanisms from './mechanisms';
import * as algorithms from './algorithms';
import * as diseases from './diseases';
import * as guidelines from './guidelines';
import * as study from './study';
import * as saved from './saved';
import * as sync from './sync';

export function registerViews(): void {
  home.register();
  directory.register();
  monograph.register();
  compare.register();
  interactions.register();
  pkLab.register();
  mechanisms.register();
  algorithms.register();
  diseases.register();
  guidelines.register();
  study.register();
  saved.register();
  sync.register();
}
