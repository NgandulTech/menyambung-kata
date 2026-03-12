// expand_words.js — Generate derived Indonesian words from KBBI roots
// This script creates new valid words using Indonesian morphological rules
const fs = require('fs');

console.log('Loading existing KBBI data...');
const raw = JSON.parse(fs.readFileSync('kbbi_v6_data.json', 'utf-8'));
const existing = JSON.parse(fs.readFileSync('kbbi_words.json', 'utf-8'));
const existingSet = new Set(existing.words.map(w => w.w));
console.log(`Existing words: ${existingSet.size}`);

// Extract root words (kata dasar) from KBBI
const roots = [];
for (const entry of raw) {
    const kata = entry.kata;
    if (!kata) continue;
    if (!/^[a-z]+$/i.test(kata)) continue;
    const word = kata.toLowerCase();
    if (word.length < 3 || word.length > 12) continue;
    roots.push(word);
}
console.log(`Root words extracted: ${roots.length}`);

// Vowels
const vowels = 'aiueo';
const isVowel = c => vowels.includes(c);

// ===== INDONESIAN MORPHOLOGICAL RULES =====

// me- prefix rules (nasalization)
function mePrefix(root) {
    const results = [];
    const first = root[0];
    
    if ('bcdfgjkpqstvxz'.includes(first)) {
        // Standard nasalization
        if ('bp'.includes(first)) {
            results.push('mem' + root);
            results.push('mem' + root.substring(1)); // with letter drop: memukul
            results.push('memper' + root);
        }
        if ('cdjz'.includes(first)) {
            results.push('men' + root);
            results.push('meny' + root.substring(1)); // menyapu
            results.push('menge' + root); // short words
        }
        if ('gk'.includes(first)) {
            results.push('meng' + root);
            results.push('menge' + root);
            results.push('meng' + root.substring(1)); // with k drop: mengambil
        }
        if ('stf'.includes(first)) {
            results.push('men' + root);
            results.push('meny' + root.substring(1));
        }
    } else if ('lr'.includes(first)) {
        results.push('me' + root);
        results.push('mel' + root);
    } else if ('mn'.includes(first)) {
        results.push('me' + root);
    } else if (isVowel(first)) {
        results.push('meng' + root);
        results.push('mengi' + root); // short words
    } else {
        results.push('me' + root);
    }
    return results;
}

// pe- prefix (nominalizer, mirrors me-)
function pePrefix(root) {
    const results = [];
    const first = root[0];
    
    if ('bp'.includes(first)) {
        results.push('pem' + root);
        results.push('pem' + root.substring(1));
    }
    if ('cdjz'.includes(first)) {
        results.push('pen' + root);
        results.push('peny' + root.substring(1));
    }
    if ('gk'.includes(first)) {
        results.push('peng' + root);
        results.push('peng' + root.substring(1));
    }
    if ('stf'.includes(first)) {
        results.push('pen' + root);
        results.push('peny' + root.substring(1));
    }
    if ('lr'.includes(first)) {
        results.push('pe' + root);
        results.push('pel' + root);
    }
    if ('mn'.includes(first)) {
        results.push('pe' + root);
    }
    if (isVowel(first)) {
        results.push('peng' + root);
    }
    return results;
}

// Generate derived words from a root
function deriveWords(root) {
    const derived = [];
    
    // Simple prefixes
    derived.push('ber' + root);      // berlari, bermain
    derived.push('ter' + root);      // terbang, tertidur
    derived.push('di' + root);       // dipukul, dibuat
    derived.push('ke' + root);       // ketua
    derived.push('se' + root);       // seluruh
    
    // me- prefix (complex nasalization)
    derived.push(...mePrefix(root));
    
    // pe- prefix  
    derived.push(...pePrefix(root));
    
    // Simple suffixes
    derived.push(root + 'an');       // tulisan, bacaan
    derived.push(root + 'kan');      // tuliskan, bacakan
    derived.push(root + 'i');        // tulisi, datangi
    derived.push(root + 'nya');      // bukunya
    
    // Prefix + suffix combos
    derived.push('ber' + root + 'an');    // berhamburan
    derived.push('ber' + root + 'kan');   // berdasarkan
    derived.push('ke' + root + 'an');     // kebaikan, ketinggian
    derived.push('per' + root + 'an');    // perbuatan, pertanyaan
    derived.push('pe' + root + 'an');     // pekerjaan
    derived.push('di' + root + 'kan');    // dituliskan
    derived.push('di' + root + 'i');      // ditulisi
    derived.push('ter' + root + 'kan');   // tersampaikan
    derived.push('se' + root + 'nya');    // sebenarnya
    
    // me- + suffix combos
    for (const me of mePrefix(root)) {
        derived.push(me + 'kan');
        derived.push(me + 'i');
    }
    
    // per- prefix
    derived.push('per' + root);
    derived.push('memper' + root);
    derived.push('memper' + root + 'kan');
    derived.push('memper' + root + 'i');
    derived.push('diper' + root);
    derived.push('diper' + root + 'kan');
    
    return derived;
}

// ===== GENERATE NEW WORDS =====
console.log('Generating derived words...');
const newWords = new Set();

for (const root of roots) {
    const derived = deriveWords(root);
    for (const w of derived) {
        // Filter: only valid looking words
        if (w.length < 3 || w.length > 25) continue;
        if (!/^[a-z]+$/.test(w)) continue;
        if (!existingSet.has(w)) {
            newWords.add(w);
        }
    }
}

console.log(`New derived words generated: ${newWords.size}`);

// ===== VALIDATION: Cross-check against existing words for plausibility =====
// Only keep words that follow Indonesian phonological rules
function isPhonologicallyValid(word) {
    // No triple consonants
    let consonantRun = 0;
    for (const c of word) {
        if (isVowel(c)) consonantRun = 0;
        else consonantRun++;
        if (consonantRun > 3) return false;
    }
    // No triple vowels
    let vowelRun = 0;
    for (const c of word) {
        if (isVowel(c)) vowelRun++;
        else vowelRun = 0;
        if (vowelRun > 2) return false;
    }
    // Must contain at least one vowel
    if (!/[aiueo]/.test(word)) return false;
    return true;
}

const validNew = [];
for (const w of newWords) {
    if (isPhonologicallyValid(w)) {
        validNew.push({ w, m: '' }); // No meaning for derived words
    }
}

console.log(`Phonologically valid new words: ${validNew.length}`);

// ===== MERGE WITH EXISTING AND REBUILD =====
console.log('Merging datasets...');
const allWords = [...existing.words];
const masterSet = new Set(allWords.map(w => w.w));

let added = 0;
for (const nw of validNew) {
    if (!masterSet.has(nw.w)) {
        allWords.push(nw);
        masterSet.add(nw.w);
        added++;
    }
}

console.log(`Added ${added} new words. Total: ${allWords.length}`);

// Sort alphabetically
allWords.sort((a, b) => a.w.localeCompare(b.w));

// Rebuild indexes
const prefixIndex = {};
const suffixIndex = {};
for (let i = 0; i < allWords.length; i++) {
    const w = allWords[i].w;
    for (let len = 1; len <= Math.min(3, w.length); len++) {
        const pre = w.substring(0, len);
        if (!prefixIndex[pre]) prefixIndex[pre] = [];
        prefixIndex[pre].push(i);
        const suf = w.substring(w.length - len);
        if (!suffixIndex[suf]) suffixIndex[suf] = [];
        suffixIndex[suf].push(i);
    }
}

// Recalculate strategy scores
const startFreq = {};
for (const wd of allWords) {
    if (wd.w.length >= 2) {
        const start = wd.w.substring(0, 2);
        startFreq[start] = (startFreq[start] || 0) + 1;
    }
}

const endingFreq = {};
for (const wd of allWords) {
    const ending = wd.w.substring(wd.w.length - 2);
    endingFreq[ending] = (endingFreq[ending] || 0) + 1;
}

for (const wd of allWords) {
    const ending = wd.w.substring(wd.w.length - 2);
    wd.s = startFreq[ending] || 0;
}

const output = {
    words: allWords,
    prefixIndex,
    suffixIndex,
    startFreq,
    endingFreq,
    totalWords: allWords.length
};

fs.writeFileSync('kbbi_words.json', JSON.stringify(output));
console.log('Saved expanded kbbi_words.json');

const stats = fs.statSync('kbbi_words.json');
console.log(`Output size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

// Show killer endings
const killerEndings = Object.entries(startFreq)
    .filter(([k]) => /^[a-z]{2}$/.test(k))
    .sort((a, b) => a[1] - b[1])
    .slice(0, 20);
console.log('\nTop 20 killer 2-letter endings:');
for (const [ending, count] of killerEndings) {
    console.log(`  "${ending}" → opponent has only ${count} words`);
}
