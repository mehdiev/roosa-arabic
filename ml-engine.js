// Roosa Adaptive Learning Engine
// A dependency-free, two-hidden-layer neural network trained online in the browser.
(function(){
  'use strict';

  const STORAGE_KEY = 'roosa_adaptive_v1';
  const INPUTS = 6;
  const HIDDEN_1 = 8;
  const HIDDEN_2 = 4;

  const clamp = (value, min=0, max=1) => Math.max(min, Math.min(max, value));
  const tanhDerivative = value => 1 - value * value;
  const sigmoid = value => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, value))));

  function seededRandom(seed){
    let state = seed >>> 0;
    return function(){
      state += 0x6D2B79F5;
      let n = state;
      n = Math.imul(n ^ n >>> 15, n | 1);
      n ^= n + Math.imul(n ^ n >>> 7, n | 61);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }

  function matrix(rows, cols, random, scale){
    return Array.from({length:rows}, () =>
      Array.from({length:cols}, () => (random() * 2 - 1) * scale)
    );
  }

  function createWeights(){
    const random = seededRandom(24051997);
    return {
      w1: matrix(HIDDEN_1, INPUTS, random, Math.sqrt(2 / INPUTS)),
      b1: Array(HIDDEN_1).fill(0),
      w2: matrix(HIDDEN_2, HIDDEN_1, random, Math.sqrt(2 / HIDDEN_1)),
      b2: Array(HIDDEN_2).fill(0),
      w3: Array.from({length:HIDDEN_2}, () => (random() * 2 - 1) * Math.sqrt(2 / HIDDEN_2)),
      b3: 0
    };
  }

  function freshState(){
    return { version:1, signals:0, words:{}, samples:[], weights:createWeights() };
  }

  class AdaptiveLearningEngine {
    constructor(){
      this.state = this.load();
    }

    load(){
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        if(saved && saved.version === 1 && saved.weights && saved.words) return saved;
      } catch(error) {
        console.warn('Adaptive model state was reset:', error);
      }
      return freshState();
    }

    save(){
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); }
      catch(error) { console.warn('Adaptive model state could not be saved:', error); }
    }

    key(word){
      return `${word.ar}|${word.en}`;
    }

    recordFor(word){
      return this.state.words[this.key(word)] || {
        attempts:0, scoreSum:0, correct:0, lapses:0, avgMs:0,
        lastSeen:0, nextReview:0, intervalMs:0
      };
    }

    features(word, record=this.recordFor(word), now=Date.now()){
      const attempts = clamp(Math.log1p(record.attempts) / Math.log(16));
      const accuracy = record.attempts ? record.scoreSum / record.attempts : 0.5;
      const timeAway = record.lastSeen ? clamp((now - record.lastSeen) / (7 * 86400000)) : 1;
      const cleanLength = (word.ar || '').replace(/\s/g,'').length;
      const difficulty = clamp((cleanLength + ((word.ar || '').split(' ').length - 1) * 2) / 18);
      const speed = record.avgMs ? 1 - clamp((record.avgMs - 900) / 12000) : 0.5;
      const lapseRate = record.attempts ? clamp(record.lapses / record.attempts) : 0;
      return [attempts, accuracy, timeAway, difficulty, speed, lapseRate];
    }

    forward(input){
      const weights = this.state.weights;
      const h1 = weights.w1.map((row, i) =>
        Math.tanh(row.reduce((sum, weight, j) => sum + weight * input[j], weights.b1[i]))
      );
      const h2 = weights.w2.map((row, i) =>
        Math.tanh(row.reduce((sum, weight, j) => sum + weight * h1[j], weights.b2[i]))
      );
      const logit = weights.w3.reduce((sum, weight, i) => sum + weight * h2[i], weights.b3);
      return { input, h1, h2, output:sigmoid(logit) };
    }

    train(input, target, epochs=10){
      const weights = this.state.weights;
      const learningRate = 0.028;

      for(let epoch=0; epoch<epochs; epoch++){
        const {h1, h2, output} = this.forward(input);
        const oldW3 = [...weights.w3];
        const oldW2 = weights.w2.map(row => [...row]);
        const deltaOut = clamp(output - target, -1, 1);

        const deltaH2 = h2.map((value, i) => deltaOut * oldW3[i] * tanhDerivative(value));
        const deltaH1 = h1.map((value, i) => {
          const downstream = deltaH2.reduce((sum, delta, j) => sum + delta * oldW2[j][i], 0);
          return downstream * tanhDerivative(value);
        });

        weights.w3 = weights.w3.map((weight, i) => weight - learningRate * deltaOut * h2[i]);
        weights.b3 -= learningRate * deltaOut;
        weights.w2 = weights.w2.map((row, i) =>
          row.map((weight, j) => weight - learningRate * deltaH2[i] * h1[j])
        );
        weights.b2 = weights.b2.map((bias, i) => bias - learningRate * deltaH2[i]);
        weights.w1 = weights.w1.map((row, i) =>
          row.map((weight, j) => weight - learningRate * deltaH1[i] * input[j])
        );
        weights.b1 = weights.b1.map((bias, i) => bias - learningRate * deltaH1[i]);
      }
    }

    heuristicRecall(record, now=Date.now()){
      if(!record.attempts) return 0.42;
      const accuracy = record.scoreSum / record.attempts;
      const interval = Math.max(record.intervalMs, 6 * 3600000);
      const elapsed = Math.max(0, now - record.lastSeen);
      const retention = Math.exp(-elapsed / (interval * 1.45));
      return clamp((accuracy * 0.72 + retention * 0.28) * (1 - Math.min(record.lapses * .035, .2)), .03, .98);
    }

    predict(word, now=Date.now()){
      const record = this.recordFor(word);
      const neural = this.forward(this.features(word, record, now)).output;
      const heuristic = this.heuristicRecall(record, now);
      const neuralWeight = Math.min(0.78, this.state.signals / 45);
      return clamp(heuristic * (1 - neuralWeight) + neural * neuralWeight, .02, .99);
    }

    record(word, quality, responseMs){
      const now = Date.now();
      const key = this.key(word);
      const previous = this.recordFor(word);
      const targetMap = [0, .42, .82, 1];
      const target = targetMap[quality] ?? 0;
      const before = {...previous};

      previous.attempts += 1;
      previous.scoreSum += target;
      if(quality >= 2) previous.correct += 1;
      if(quality === 0) previous.lapses += 1;
      previous.avgMs = previous.avgMs
        ? previous.avgMs * .72 + clamp(responseMs || 4000, 500, 30000) * .28
        : clamp(responseMs || 4000, 500, 30000);
      previous.lastSeen = now;

      const oldInterval = before.intervalMs || 0;
      const intervals = [45000, Math.max(10 * 60000, oldInterval * .55), Math.max(12 * 3600000, oldInterval * 1.75), Math.max(3 * 86400000, oldInterval * 2.5)];
      previous.intervalMs = intervals[quality];
      previous.nextReview = now + previous.intervalMs;
      this.state.words[key] = previous;
      this.state.signals += 1;

      const sample = {x:this.features(word, before, now), y:target};
      this.state.samples.push(sample);
      if(this.state.samples.length > 240) this.state.samples.shift();
      this.train(sample.x, sample.y, 14);

      // A tiny replay buffer prevents the latest answer from dominating the model.
      const replayCount = Math.min(5, this.state.samples.length - 1);
      for(let i=0; i<replayCount; i++){
        const replay = this.state.samples[Math.floor(Math.random() * this.state.samples.length)];
        this.train(replay.x, replay.y, 2);
      }
      this.save();
      return previous;
    }

    recommendation(words, excludeKey){
      const now = Date.now();
      const ranked = words
        .filter(word => this.key(word) !== excludeKey)
        .map(word => {
          const record = this.recordFor(word);
          const recall = this.predict(word, now);
          const overdue = record.nextReview ? clamp((now - record.nextReview) / (3 * 86400000), 0, 1) : 0;
          const exploration = record.attempts ? 0 : .18;
          const score = (1 - recall) * .62 + overdue * .25 + exploration + Math.random() * .035;
          return {word, record, recall, score, overdue};
        })
        .sort((a,b) => b.score - a.score);

      const choice = ranked[0];
      if(!choice) return null;
      let reason;
      if(!choice.record.attempts){
        reason = `Cold-start exploration · the model needs a first signal for this ${choice.word.cat || 'vocabulary'} word.`;
      } else if(choice.record.nextReview <= now){
        reason = `Scheduled review · estimated recall is ${Math.round(choice.recall * 100)}% and this item is due now.`;
      } else if(choice.record.lapses){
        reason = `Weak-memory signal · ${choice.record.lapses} lapse${choice.record.lapses === 1 ? '' : 's'} detected, with ${Math.round(choice.recall * 100)}% predicted recall.`;
      } else {
        reason = `Model uncertainty · ${Math.round(choice.recall * 100)}% predicted recall makes this a useful practice item.`;
      }
      return {...choice, reason};
    }

    dashboard(words){
      const now = Date.now();
      const reviewed = words.filter(word => this.recordFor(word).attempts > 0);
      const recall = reviewed.length
        ? reviewed.reduce((sum, word) => sum + this.predict(word, now), 0) / reviewed.length
        : null;
      const due = reviewed.filter(word => this.recordFor(word).nextReview <= now).length;
      const signals = this.state.signals;
      const confidence = signals >= 75 ? 'High' : signals >= 30 ? 'Medium' : signals >= 10 ? 'Learning' : 'Low';
      return {recall, due, signals, confidence};
    }
  }

  window.AdaptiveLearningEngine = AdaptiveLearningEngine;
})();
