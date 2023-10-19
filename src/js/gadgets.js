// https://stackoverflow.com/a/51636258
function noWhiteSpace(strings, ...placeholders) {
  // Build the string as normal, combining all the strings and placeholders:
  let withSpace = strings.reduce((result, string, i) => (result + placeholders[i - 1] + string));
  let withoutSpace = withSpace.replace(/\s\s+/g, ' ');
  return withoutSpace;
}

// https://stackoverflow.com/a/20871714
const permutations = (inputArr) => {
  let result = [];
  const permute = (arr, m = []) => {
    if (arr.length === 0) {
      result.push(m)
    } else {
      for (let i = 0; i < arr.length; i++) {
        let curr = arr.slice();
        let next = curr.splice(i, 1);
        permute(curr.slice(), m.concat(next))
      }
    }
  }
  permute(inputArr)
  return result;
}

class Gadget {
  constructor(name, locations, states, transitions, acceptingPred, psState, psLevelIndex, psPorts, psLevels) {
    this.name = name;
    this.states = [...new Set(states)];
    this.locations = [...new Set(locations)].sort();

    transitions = [...transitions];
    for (const s of this.states) {
      for (const loc of this.locations) {
        transitions.push([s, loc, loc, s]);
      }
    }
    this.transitions = transitions.filter(([fromState, fromLoc, toLoc, toState], i) =>
      i === transitions.findIndex(([fromState2, fromLoc2, toLoc2, toState2]) =>
        fromState2 === fromState && fromLoc2 === fromLoc && toLoc2 === toLoc && toState2 === toState
      )
    ).sort();
    this.acceptingPred = acceptingPred == undefined ? s => true :
                         acceptingPred instanceof Function ? acceptingPred :
                         s => acceptingPred.includes(s);

    this.psState = psState;
    this.psLevelIndex = psLevelIndex;
    this.psPorts = psPorts || (() => undefined);
    this.psLevels = psLevels || (() => undefined);
  }

  rename(newName) {
    return new Gadget(
      newName,
      this.locations, this.states, this.transitions,
      this.acceptingPred,
      this.psState, this.psLevelIndex, this.psPorts, this.psLevels
    );
  }

  filter(fnLoc, fnState, fnTrans) {
    fnLoc = fnLoc || (() => true);
    fnState = fnState || (() => true);
    fnTrans = fnTrans || (() => true);
    const fnTrans2 = ([fromState, fromLoc, toLoc, toState]) =>
      fnLoc(fromLoc) && fnState(fromState) && fnState(toState) && fnLoc(toLoc) &&
      fnTrans(fromState, fromLoc, toLoc, toState);
    return new Gadget(
      this.name,
      this.locations.filter(fnLoc),
      this.states.filter(fnState),
      this.transitions.filter(fnTrans2),
      this.acceptingPred,
      this.psState, this.psLevelIndex, this.psPorts, this.psLevels
    );
  }

  filterLocations(fn) {
    return this.filter(fn, null, null);
  }

  filterStates(fn) {
    return this.filter(null, fn, null);
  }

  filterTransitions(fn) {
    return this.filter(null, null, fn);
  }

  map(fnLoc, fnState) {
    fnLoc = fnLoc || (l => l);
    fnState = fnState || (s => s);
    const fnTrans = ([fromState, fromLoc, toLoc, toState]) =>
      [fnState(fromState), fnLoc(fromLoc), fnLoc(toLoc), fnState(toState)];
    return new Gadget(
      this.name,
      this.locations.map(fnLoc),
      this.states.map(fnState),
      this.transitions.map(fnTrans),
      s => this.states.some(s2 => fnState(s2) === s && this.acceptingPred(s2)),
      this.psState,
      this.psLevelIndex,
      l => this.psPorts(this.locations.find(l2 => fnLoc(l2) === l)),
      s => this.psLevels(this.states.find(s2 => fnState(s2) === s))
    );
  }

  mapLocations(fn) {
    return this.map(fn, null);
  }

  mapStates(fn) {
    return this.map(null, fn);
  }

  minimizeStateLabels() {
    const stateMap = new Map(this.states.map((state, index) => [state, index]));
    return this.mapStates(s => stateMap.get(s));
  }

  flatMapTransitions(fn) {
    return new Gadget(
      this.name, this.locations, this.states,
      this.transitions.flatMap(([fromState, fromLoc, toState, toLoc]) =>
          fn(fromState, fromLoc, toState, toLoc)),
      this.acceptingPred,
      this.psState, this.psLevelIndex, this.psPorts, this.psLevels,
    );
  }

  undirect() {
    return this.flatMapTransitions((fromState, fromLoc, toLoc, toState) =>
      [[fromState, fromLoc, toLoc, toState], [fromState, toLoc, fromLoc, toState]]);
  }

  symmetrize() {
    return this.flatMapTransitions((fromState, fromLoc, toLoc, toState) =>
      [[fromState, fromLoc, toLoc, toState], [toState, toLoc, fromLoc, fromState]]);
  }

  transitionsByStartState() {
    const transitions = new Map();
    for (const state of this.states) {
      transitions.set(state, []);
    }
    for (const [fromState, fromLoc, toLoc, toState] of this.transitions) {
      transitions.get(fromState).push([fromLoc, toLoc, toState]);
    }
    return transitions;
  }

  performTransition(fromState, fromLoc, toLoc) {
    return this.transitions
          .filter(t => t[0] == fromState && t[1] === fromLoc && t[2] === toLoc)
          .map(t => t[3]);
  }

  toJSON(loops=false) {
    return {
      name: this.name,
      type: "Transitions",
      locations: this.locations,
      states: this.states,
      acceptingStates: this.states.filter(this.acceptingPred),
      transitions: Object.fromEntries(this.transitionsByStartState()),
    };
  }

  formatAsJsonHtml(loops) {
    const escape = s => encodeURIComponent(JSON.stringify(s));

    const formatLocation = loc => `<span class="gadgetLocation" location="${escape(loc)}">${JSON.stringify(loc)}</span>`;
    const formatState = state => `<span class="gadgetState" state="${escape(state)}">${JSON.stringify(state.toString())}</span>`;
    const formatStateLocation = (state, loc) => `<span class="gadgetState gadgetLocation" state="${escape(state)}" location="${escape(loc)}">${JSON.stringify(loc)}</span>`;

    const formatTransition = ([fromState, fromLoc, toLoc, toState]) => {
      return noWhiteSpace`<span class="gadgetTransition"
        fromState="${escape(fromState)}" fromLoc="${escape(fromLoc)}"
        toLoc="${escape(toLoc)}" toState="${escape(toState)}"
        >[${formatStateLocation(fromState, fromLoc)}, ${formatStateLocation(toState, toLoc)}, ${formatState(toState)}]</span>`;
    };

    const transitions = loops ? this.transitions :
      this.transitions.filter(([fromState, fromLoc, toLoc, toState]) =>
        fromLoc !== toLoc || fromState !== toState);

    const transitionsStr = this.states.map(fromState =>
      `\n    ${formatState(fromState)}: [${transitions.filter(t => t[0] == fromState).map(formatTransition).join(', ')}]`
    ).join(',');
    const str =
`{
  "name": <span class="gadgetName">${JSON.stringify(this.name)}</span>,
  "type": "Transitions",
  "locations": [${this.locations.map(formatLocation).join(', ')}],
  "states": [${this.states.map(formatState).join(', ')}],
  "acceptingStates": [${this.states.filter(this.acceptingPred).map(formatState).join(', ')}],
  "transitions": {${transitionsStr}
  }
}`

    return `<pre class="gadgetJson">${str}</pre>`;
  }
  
  print(loops=false, performLibrarySearch=false) {
    const escape = s => encodeURIComponent(JSON.stringify(s));

    console.log(this.toJSON());
    consolePrint(this.formatAsJsonHtml(loops), true);

    const stateElems = cache.getElementsByClassName('gadgetState');
    const locationElems = cache.getElementsByClassName('gadgetLocation');
    // const stateLocationElems = cache.getElementsByClassName('gadgetLocation');

    for (const state of this.states.filter(s => this.psLevels(s))) {
      for (const e of stateElems) {
        if (e.getAttribute('state') === escape(state)) {
          e.classList.add('clickable');
          e.addEventListener('click', () => {
            showGadgetState(this, state);
          });
        }
      }
    }
    for (const location of this.locations.filter(l => this.psPorts(l))) {
      for (const e of locationElems) {
        if (e.getAttribute('location') === escape(location)) {
          e.classList.add('clickable');
          e.addEventListener('click', () => {
            showGadgetLocation(this, location);
          });
        }
      }
    }
    // const transitionElems = cache.getElementsByClassName('gadgetTransition');
    // for (const [fromState, fromLoc, toLoc, toState] of this.transitions) {
    //   if (this.psLevels(fromState) != undefined && this.psPorts(fromLoc) != undefined
    //     && this.psPorts(toLoc) != undefined && this.psLevels(toState) != undefined
    //   ) {
    //     for (const e of transitionElems) {
    //       if (e.getAttribute('fromState') === escape(fromState)
    //         && e.getAttribute('fromLoc') === escape(fromLoc)
    //         && e.getAttribute('toLoc') === escape(toLoc)
    //         && e.getAttribute('toState') === escape(toState)
    //       ) {
    //         e.classList.add('clickable');
    //         e.addEventListener('click', () => {
    //           showGadgetTransition(gadget, fromState, fromLoc, toLoc, toState);
    //         });
    //       }
    //     }
    //   }
    // }
    return this;
  }

  mergeStates(startingState) {
    startingState = startingState || this.states[0];

    // dominates[s][t] means that you'll always prefer being in state s over state t
    const dominates = new Map(this.states.map(s =>
      [s, new Map(this.states.map(t => 
        [t, this.acceptingPred(s) || !this.acceptingPred(t)]
      ))]
    ));
    let progress;
    do {
      progress = false;
      for (const state1 of this.states) {
        for (const state2 of this.states) {
          if (state1 === state2 || !dominates.get(state1).get(state2)) continue;
          for (const fromLoc of this.locations) {
            if (!dominates.get(state1).get(state2)) break;
            for (const toLoc of this.locations) {
              const toStates1 = this.performTransition(state1, fromLoc, toLoc);
              const toStates2 = this.performTransition(state2, fromLoc, toLoc);
              if (!toStates2.every(toState2 => toStates1.some(toState1 => dominates.get(toState1).get(toState2)))) {
                dominates.get(state1).set(state2, false);
                progress = true;
                break;
              }
            }
          }
        }
      }
    } while(progress);
  
    // if two states dominate each other, we can replace one with another everywhere (preferring starting state)
    const gadget = this.mapStates(
      s => [startingState].concat(this.states).find(s2 => dominates.get(s).get(s2) && dominates.get(s2).get(s))
    )
    // if a traversal leads to two states, and one dominates the other, we can delete the other transition
    return gadget.filterTransitions((fromState, fromLoc, toLoc, toState) =>
      !(fromLoc === toLoc && fromState !== toState && dominates.get(fromState).get(toState)) &&
      !gadget.performTransition(fromState, fromLoc, toLoc).some(toState2 =>
        toState2 != toState && dominates.get(toState2).get(toState)
      )
    );
  }

  removeUnreachable(startState) {
    if (startState == undefined) {
      startState = this.states[0];
    }
    const reachable = new Set([startState]);

    let progress;
    do {
      progress = false;
      for (const [fromState, fromLoc, toLoc, toState] of this.transitions) {
        if (reachable.has(fromState) && !reachable.has(toState)) {
          reachable.add(toState);
          progress = true;
        }
      }
    } while (progress);

    return this.filterStates(s => reachable.has(s));
  }
  
  removeUnwinnable() {
    const winnable = new Set();
    for (const state of this.states) {
      if (this.acceptingPred(state)) {
        winnable.add(state);
      }
    }
  
    let progress;
    do {
      progress = false;
      for (const [fromState, fromLoc, toLoc, toState] of this.transitions) {
        if (winnable.has(toState) && !winnable.has(fromState)) {
          winnable.add(fromState);
          progress = true;
        }
      }
    } while (progress);
  
    return this.filterStates(s => winnable.has(s));
  }
  
  simplify(startState) {
    return this.mergeStates()
               .removeUnreachable(startState)
               .removeUnwinnable()
               .minimizeStateLabels();
  }

  stateUnion(other) {
    if (JSON.stringify(this.locations) !== JSON.stringify(other.locations)) {
      throw new Error(`Gadget locations don't match! ${this.locations} vs ${other.locations}`);
    }

    const mappedThis = this.mapStates(s => JSON.stringify([0, s]));
    const mappedOther = other.mapStates(s => JSON.stringify([1, s]));

    return new Gadget(
      `[${this.name}] + [${other.name}]`,
      this.locations,
      mappedThis.states.concat(mappedOther.states),
      mappedThis.transitions.concat(mappedOther.transitions),
      state => {const [i, s] = JSON.parse(state); return [this, other][i].acceptingPred(s)},
      state => {const [i, s] = JSON.parse(state); return i == 0 && this.psState(s)},
      this.psLevelIndex,
      this.psPorts,
    )
  }

  findInLibrary(gadgetLibrary) {
    gadgetLibrary = gadgetLibrary || standardGadgetLibrary;
    const simplifiedThis = this.mergeStates();
    for (const other of gadgetLibrary) {
      if (this.locations.length !== other.locations.length || this.states.length !== other.states.length) {
        continue;
      }

      for (const perm of permutations(this.locations)) {
        const mappedOther = other.mapLocations(loc => perm[other.locations.indexOf(loc)]);
        if (simplifiedThis.stateUnion(mappedOther).mergeStates().states.length === simplifiedThis.states.length) {
          if (mappedOther.mergeStates().states.length !== mappedOther.states.length) {
            throw new Exception(`Something went wrong. Looks like library gadget ${mappedOther.name} was not fully simplified`);
          }
          return mappedOther;
        }
      }
    }
  }

  printLibraryMatch(gadgetLibrary) {
    const libraryGadget = this.findInLibrary(gadgetLibrary);
    if (libraryGadget) {
      consolePrint(`= ${libraryGadget.name}`);
    }
  }

  determinize(startState) {
    if (startState == undefined) {
      startState = this.states[0];
    }
  
    const states = new Set();
    const transitions = [];
    const queue = [[startState]];
  
    while (queue.length > 0) {
      const state = queue.shift();
      const stateStr = JSON.stringify(state);
      if (states.has(stateStr)) continue;
      states.add(stateStr);
      for (const fromLoc of this.locations) {
        for (const toLoc of this.locations) {
          const toStates = [...new Set(
            state.flatMap(substate => this.performTransition(substate, fromLoc, toLoc))
          )];
          toStates.sort()
          if (toStates.length > 0) {
            queue.push(toStates);
            transitions.push([stateStr, fromLoc, toLoc, JSON.stringify(toStates)]);
          }
        }
      }
    }
  
    return new Gadget(
      this.name + " (determinized)",
      this.locations, states, transitions,
      state => JSON.parse(state).some(substate => this.acceptingPred(substate)),
      this.psState, this.psLevelIndex, this.psPorts,
      state => JSON.parse(state).length === 1 ? this.psLevels(JSON.parse(state)[0]) : null // can't get psLevels unless singleton :(
    );
  }
}

const standardGadgetLibrary = [
  new Gadget('Diode', [0, 1], [0], [[0, 0, 1, 0]]),
  new Gadget('Dicrumbler', [0, 1], [0, 1], [[0, 0, 1, 1]]),
  new Gadget('Crumbler', [0, 1], [0, 1], [[0, 0, 1, 1]]).undirect(),
  new Gadget('Shortcut', [0, 1], [0, 1], [[0, 0, 0, 1], [0, 0, 1, 1], [1, 0, 1, 1], [1, 1, 0, 1]]),
  new Gadget('1-Toggle', [0, 1], [0, 1], [[0, 0, 1, 1]]).symmetrize(),
  new Gadget('Directed NAND', [0, 1, 2, 3], [0, 1], [[0, 0, 1, 1], [0, 2, 3, 1]]),
  new Gadget('Undirected NAND', [0, 1, 2, 3], [0, 1], [[0, 0, 1, 1], [0, 2, 3, 1]]).undirect(),
  new Gadget('Locking 2-toggle', [0, 1, 2, 3], [0, 1, 2], [[0, 0, 1, 1], [0, 2, 3, 2]]).symmetrize(),
  new Gadget('2-Toggle', [0, 1, 2, 3], [0, 1], [[0, 0, 1, 1], [0, 2, 3, 1]]).symmetrize(),
  new Gadget('Toggle-Lock', [0, 1, 2, 3], [0, 1], [[0, 0, 1, 1], [0, 2, 3, 0]]).symmetrize(),
  new Gadget('Tripwire-Lock', [0, 1, 2, 3], [0, 1], [[0, 0, 1, 1], [0, 1, 0, 1], [0, 2, 3, 0]]).symmetrize(),
  new Gadget('Tripwire-Toggle', [0, 1, 2, 3], [0, 1], [[0, 0, 1, 1], [0, 1, 0, 1], [0, 2, 3, 1]]).symmetrize(),
  new Gadget('Directed Door', ['O', 'Ci', 'Co', 'Ti', 'To'], ['O', 'C'],
    [['C', 'O', 'O', 'O'], ['O', 'Ci', 'Co', 'C'], ['C', 'Ci', 'Co', 'C'], ['O', 'Ti', 'To', 'O']]),
  new Gadget('Directed SCD', ['O', 'Ci', 'Co'], ['O', 'C'],
    [['C', 'O', 'O', 'O'], ['O', 'Ci', 'Co', 'C']]),
  new Gadget('Undirected SCD', ['O', 'Ci', 'Co'], ['O', 'C'],
    [['C', 'O', 'O', 'O'], ['O', 'Ci', 'Co', 'C']]).undirect(),
  new Gadget('Directed SCD', ['Oi', 'Oo', 'Ci', 'Co'], ['O', 'C'],
    [['O', 'Oi', 'Oo', 'O'], ['C', 'Oi', 'Oo', 'O'], ['O', 'Ci', 'Co', 'C']]),
  new Gadget('Undirected SCD', ['Oi', 'Oo', 'Ci', 'Co'], ['O', 'C'],
    [['O', 'Oi', 'Oo', 'O'], ['C', 'Oi', 'Oo', 'O'], ['O', 'Ci', 'Co', 'C']]).undirect(),
  new Gadget('Directed SSCD', ['Oi', 'Oo', 'Ci', 'Co'], ['O', 'C'],
    [['C', 'Oi', 'Oo', 'O'], ['O', 'Ci', 'Co', 'C']]),
  new Gadget('Undirected SSCD', ['Oi', 'Oo', 'Ci', 'Co'], ['O', 'C'],
    [['C', 'Oi', 'Oo', 'O'], ['O', 'Ci', 'Co', 'C']]).undirect(),
]