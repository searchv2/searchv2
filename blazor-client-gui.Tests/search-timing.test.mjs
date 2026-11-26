import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

function browser() {
    let now = 0;
    let observer;
    let nextFrame = 0;
    const frames = new Map();
    const formListeners = new Map();
    const documentListeners = new Map();
    const form = {
        addEventListener: (name, callback) => formListeners.set(name, callback),
        removeEventListener: name => formListeners.delete(name)
    };
    const root = { dataset: { searchCompletion: "0" }, querySelector: () => form };
    const document = {
        hidden: false,
        addEventListener: (name, callback) => documentListeners.set(name, callback),
        removeEventListener: name => documentListeners.delete(name)
    };
    const context = vm.createContext({
        window: {}, document, performance: { now: () => now },
        DotNet: { createJSObjectReference: () => ({ __jsObjectId: 1 }) },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observer = this; }
            observe() {}
            disconnect() { this.disconnected = true; }
        },
        requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
        cancelAnimationFrame: id => frames.delete(id)
    });
    vm.runInContext(readFileSync(new URL("../blazor-client-gui/wwwroot/search-timing.js", import.meta.url), "utf8"), context);
    const timing = context.window.searchTiming.attach(root);
    return {
        timing,
        submit(time) { now = time; formListeners.get("submit")?.(); },
        complete(id, outcome = "success") {
            root.dataset.searchCompletion = String(id);
            root.dataset.searchOutcome = outcome;
            observer.callback();
        },
        frame(time) {
            now = time;
            const callbacks = [...frames.values()];
            frames.clear();
            callbacks.forEach(callback => callback(time));
        },
        hide() { document.hidden = true; documentListeners.get("visibilitychange")?.(); },
        show() { document.hidden = false; },
        assertDisposed() {
            assert.equal(formListeners.size, 0);
            assert.equal(documentListeners.size, 0);
            assert.equal(frames.size, 0);
            assert.equal(observer.disconnected, true);
        }
    };
}

test("returns the timing object itself for Blazor's automatic IJSObjectReference wrapping", () => {
    const b = browser();
    assert.equal(typeof b.timing.collect, "function");
    assert.equal(typeof b.timing.dispose, "function");
    assert.equal(b.timing.__jsObjectId, undefined);
    b.timing.dispose();
});

test("measures from submission through two frames, excluding the later reporting trip", async () => {
    const b = browser();
    b.submit(100);
    b.complete(1);
    b.frame(180);
    const value = b.timing.collect(1);
    b.frame(200);
    b.frame(900); // A delayed server collection must not inflate the browser duration.
    assert.equal(await value, 0.1);
    assert.equal(await b.timing.collect(1), 0.1);
    assert.equal(b.timing.collect(2), null);
});

test("ignores errors and invalid submissions, and measures the next successful search", async () => {
    const b = browser();
    b.submit(0);
    b.complete(1, "error");
    assert.equal(b.timing.collect(1), null);
    b.submit(20);
    b.complete(2, "invalid");
    assert.equal(b.timing.collect(2), null);
    b.submit(50);
    b.complete(3);
    b.frame(80);
    b.frame(100);
    assert.equal(await b.timing.collect(3), 0.05);
});

test("duplicate submissions do not reset a pending measurement", async () => {
    const b = browser();
    b.submit(100);
    b.submit(150);
    b.complete(1);
    b.frame(180);
    b.frame(200);
    assert.equal(await b.timing.collect(1), 0.1);
});

test("a new search supersedes an earlier result that has not painted", async () => {
    const b = browser();
    b.submit(0);
    b.complete(1);
    const old = b.timing.collect(1);
    b.submit(100);
    assert.equal(await old, null);
    b.complete(2);
    b.frame(150);
    b.frame(200);
    assert.equal(await b.timing.collect(2), 0.1);
});

test("hidden tabs discard pending searches and pending frames", async () => {
    const b = browser();
    b.hide();
    b.submit(0);
    b.complete(1);
    assert.equal(b.timing.collect(1), null);
    b.show();
    b.submit(100);
    b.hide();
    b.show();
    b.complete(2);
    assert.equal(b.timing.collect(2), null);
    b.submit(200);
    b.complete(3);
    const value = b.timing.collect(3);
    b.hide();
    assert.equal(await value, null);
});

test("disposal cancels pending work and removes listeners", async () => {
    const b = browser();
    b.submit(100);
    b.complete(1);
    const value = b.timing.collect(1);
    b.timing.dispose();
    assert.equal(await value, null);
    b.assertDisposed();
});
