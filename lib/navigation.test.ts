import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NAV_ITEMS,
  getNavItemByPathname,
} from './navigation';
import { DICTIONARIES, SUPPORTED_LOCALES } from './i18n/dictionaries';

test('all 11 required KIRALIS routes are defined and unique', () => {
  assert.equal(NAV_ITEMS.length, 11);
  const hrefs = new Set(NAV_ITEMS.map((i) => i.href));
  assert.equal(hrefs.size, 11);
});

test('getNavItemByPathname resolves exact and nested paths accurately', () => {
  assert.equal(getNavItemByPathname('/').key, 'dashboard');
  assert.equal(getNavItemByPathname('/vehicles').key, 'vehicles');
  assert.equal(getNavItemByPathname('/vehicles/').key, 'vehicles');
  assert.equal(getNavItemByPathname('/settings').key, 'settings');
  assert.equal(getNavItemByPathname('/unknown-path').key, 'dashboard');
});

test('all locales define complete translations for every module', () => {
  for (const locale of SUPPORTED_LOCALES) {
    const dict = DICTIONARIES[locale];
    for (const item of NAV_ITEMS) {
      assert.ok(dict.modules[item.key].navLabel.length > 0);
      assert.ok(dict.modules[item.key].title.length > 0);
      assert.ok(dict.modules[item.key].emptyTitle.length > 0);
    }
  }
});
