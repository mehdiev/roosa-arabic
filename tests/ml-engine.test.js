const assert = require('node:assert/strict');

const storage = new Map();
global.localStorage = {
  getItem:key => storage.has(key) ? storage.get(key) : null,
  setItem:(key, value) => storage.set(key, value),
  removeItem:key => storage.delete(key)
};
global.window = global;

require('../ml-engine.js');

const engine = new AdaptiveLearningEngine();
const words = [
  {ar:'مرحبا', en:'Hello', tr:'marhaban', cat:'greetings'},
  {ar:'كتاب', en:'Book', tr:'kitab', cat:'school'},
  {ar:'مستشفى', en:'Hospital', tr:'mustashfa', cat:'health'}
];

assert.equal(engine.features(words[0]).length, 6, 'model should expose six input features');

const first = engine.recommendation(words);
assert.ok(first && words.includes(first.word), 'recommender should return a vocabulary item');
assert.match(first.reason, /Cold-start exploration/, 'new learners should receive an honest cold-start reason');

engine.record(words[0], 2, 3200);
const record = engine.recordFor(words[0]);
assert.equal(record.attempts, 1, 'a rating should create one learning signal');
assert.ok(record.nextReview > record.lastSeen, 'a rating should schedule a future review');

const prediction = engine.predict(words[0]);
assert.ok(prediction > 0 && prediction < 1, 'recall prediction should be a valid probability');

const dashboard = engine.dashboard(words);
assert.equal(dashboard.signals, 1, 'dashboard should report trained signals');
assert.ok(storage.has('roosa_adaptive_v1'), 'model state should persist locally');

const restored = new AdaptiveLearningEngine();
assert.equal(restored.recordFor(words[0]).attempts, 1, 'a new engine should restore learner state');

console.log('Adaptive learning engine tests passed.');
