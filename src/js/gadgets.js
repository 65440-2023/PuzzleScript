// https://stackoverflow.com/a/51636258
function noWhiteSpace(strings, ...placeholders) {
  // Build the string as normal, combining all the strings and placeholders:
  let withSpace = strings.reduce((result, string, i) => (result + placeholders[i - 1] + string));
  let withoutSpace = withSpace.replace(/\s\s+/g, ' ');
  return withoutSpace;
}

class Gadget {
  constructor(name, locations, states, transitions, acceptingPred, psState, psLevelIndex, psPorts, psLevels) {
    this.name = name;
    this.states = [...new Set(states)];
    this.locations = [...new Set(locations)];
    this.transitions = transitions.filter(([fromState, fromLoc, toLoc, toState], i) =>
      i === transitions.findIndex(([fromState2, fromLoc2, toLoc2, toState2]) =>
        fromState2 === fromState && fromLoc2 === fromLoc && toLoc2 === toLoc && toState2 === toState
      )
    );
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

  removeLoops() {
    return this.filterTransitions((fromState, fromLoc, toLoc, toState) => fromLoc !== toLoc || fromState !== toState);
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
      transitions: JSON.stringify(Object.fromEntries(this.transitionsByStartState())),
    };
  }

  formatAsJsonHtml() {
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

    const transitionsStr = this.states.map(fromState =>
      `\n    ${formatState(fromState)}: [${this.transitions.filter(t => t[0] == fromState).map(formatTransition).join(', ')}]`
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
  
  print(loops=false) {
    const escape = s => encodeURIComponent(JSON.stringify(s));

    const gadget = loops ? this : this.removeLoops();
    console.log(gadget.toJSON());
    consolePrint(gadget.formatAsJsonHtml(), true);

    const stateElems = cache.getElementsByClassName('gadgetState');
    const locationElems = cache.getElementsByClassName('gadgetLocation');
    // const stateLocationElems = cache.getElementsByClassName('gadgetLocation');

    for (const state of this.states.filter(s => this.psLevels(s))) {
      for (const e of stateElems) {
        if (e.getAttribute('state') === escape(state)) {
          e.classList.add('clickable');
          e.addEventListener('click', () => {
            showGadgetState(gadget, state);
          });
        }
      }
    }
    for (const location of this.locations.filter(l => this.psPorts(l))) {
      for (const e of locationElems) {
        if (e.getAttribute('location') === escape(location)) {
          e.classList.add('clickable');
          e.addEventListener('click', () => {
            showGadgetLocation(gadget, location);
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
  }

  mergeStates() {
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
            for (const toLoc of this.locations) {
              const toStates1 = this.performTransition(state1, fromLoc, toLoc);
              const toStates2 = this.performTransition(state2, fromLoc, toLoc);
              if (!toStates2.every(toState2 => toStates1.some(toStates1 => dominates.get(toStates1).get(toState2)))) {
                dominates.get(state1).set(state2, false);
                progress = true;
              }
            }
          }
        }
      }
    } while(progress);
  
    // if two states dominate each other, we can replace one with another everywhere
    const gadget = this.mapStates(
      s => this.states.find(s2 => dominates.get(s).get(s2) && dominates.get(s2).get(s))
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
               .minimizeStateLabels()
               .rename(this.name + ' (simplified)');
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