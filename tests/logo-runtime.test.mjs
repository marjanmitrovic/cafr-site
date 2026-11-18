import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/ucfr-logo-runtime.js', import.meta.url), 'utf8');

function runLogoRuntime(engine) {
  const intervals = new Map();
  const observers = [];
  const window = {
    CAFRMemberCards: engine,
    fetch: async () => new Response(''),
    addEventListener() {},
    setInterval: (callback) => { intervals.set(1, callback); return 1; },
    clearInterval: (id) => intervals.delete(id),
    setTimeout() {},
  };
  const context = vm.createContext({
    window, Request,
    document: {
      readyState: 'complete', documentElement: {},
      querySelectorAll: () => [], addEventListener() {},
    },
    MutationObserver: class {
      constructor(callback) { observers.push(callback); }
      observe() {}
    },
  });
  vm.runInContext(source, context);
  return { window, intervals, observers };
}

test('the frozen card API can be adapted without modifying its existing methods', () => {
  const originalPrint = () => 'original';
  const download = () => 'download';
  const original = Object.freeze({ printSvg: originalPrint, download });
  const h = runLogoRuntime(original);
  assert.equal(original.printSvg, originalPrint);
  assert.equal(h.window.CAFRMemberCards.download, download);
  assert.equal(h.window.CAFRMemberCards.printSvg, h.window.UCFRPrintMemberCard);
  assert.equal(Object.isFrozen(h.window.CAFRMemberCards), true);
});

test('repeated DOM mutations keep the adapted API and stop the discovery timer', () => {
  const h = runLogoRuntime(Object.freeze({ printSvg() {} }));
  const adapted = h.window.CAFRMemberCards;
  for (let i = 0; i < 20; i += 1) h.observers[0]([]);
  h.intervals.get(1)();
  assert.equal(h.window.CAFRMemberCards, adapted);
  assert.equal(h.intervals.size, 0);
});

test('a card API loaded after the logo script is adapted once it becomes available', () => {
  const h = runLogoRuntime(undefined);
  h.intervals.get(1)();
  assert.equal(h.intervals.size, 1);
  h.window.CAFRMemberCards = Object.freeze({ printSvg() {} });
  h.intervals.get(1)();
  assert.equal(h.window.CAFRMemberCards.printSvg, h.window.UCFRPrintMemberCard);
  assert.equal(h.intervals.size, 0);
});
