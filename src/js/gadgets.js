// https://stackoverflow.com/a/51636258
function noWhiteSpace(strings, ...placeholders) {
  // Build the string as normal, combining all the strings and placeholders:
  let withSpace = strings.reduce((result, string, i) => (result + placeholders[i - 1] + string));
  let withoutSpace = withSpace.replace(/\s\s+/g, ' ');
  return withoutSpace;
}

class Gadget {
  constructor(name, locations, states, transitions, acceptingPred, psState, psPorts, psLevels) {
    this.name = name;
    this.states = [...new Set(states)];
    this.locations = [...new Set(locations)];
    this.transitions = transitions.filter(([fromState, fromLoc, toLoc, toState], i) =>
      i === transitions.findIndex(([fromState2, fromLoc2, toLoc2, toState2]) =>
        fromState2 === fromState && fromLoc2 === fromLoc && toLoc2 === toLoc && toState2 === toState
      )
    );
    this.acceptingPred = acceptingPred === undefined ? s => true :
                         acceptingPred instanceof Function ? acceptingPred :
                         s => acceptingPred.includes(s);
    this.psState = psState;

    this.psPorts = psPorts || (() => undefined);
    this.psLevels = psLevels || (() => undefined);
  }

  rename(newName) {
    return new Gadget(
      newName,
      this.locations, this.states, this.transitions,
      this.acceptingPred,
      this.psState, this.psPorts, this.psLevels
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
      this.psState, this.psPorts, this.psLevels
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
      this.acceptingPred,
      this.psState,
      l => this.psPorts(this.locations.find(l2 => fnLoc(l2) == l)),
      s => this.psLevels(this.states.find(s2 => fnState(s2) == s))
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

    const formatState = state => `<span class="state" state="${escape(state)}">${JSON.stringify(state)}</span>`;
    const formatTransition = ([fromState, fromLoc, toLoc, toState]) => 
      noWhiteSpace`<span class="transition"
        fromState="${escape(fromState)}" fromLoc="${escape(fromLoc)}"
        toLoc="${escape(toLoc)}" toState="${escape(toState)}"
        >${JSON.stringify([fromLoc, toLoc, toState])}</span>`;
    const formatStateArray = states => states.map(formatState).join(',');
    const formatTransitionArray = transitions => transitions.map(formatTransition).join(',');

    const transitionsStr = this.states.map(fromState =>
      `\n    ${formatState(fromState)}: [${formatTransitionArray(this.transitions.filter(t => t[0] == fromState))}]`
    ).join(',');
    const str =
`{
  "name": <span class="name">${JSON.stringify(this.name)}</span>,
  "type": "Transitions",
  "locations": ${JSON.stringify(this.locations)},
  "states": [${formatStateArray(this.states)}],
  "acceptingStates": [${formatStateArray(this.states.filter(this.acceptingPred))}],
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

    const stateElems = cache.getElementsByClassName('state');
    const transitionElems = cache.getElementsByClassName('transition');
    for (const state of this.states) {
      for (const e of stateElems) {
        if (e.getAttribute('state') === escape(state)) {
          e.addEventListener('click', () => {
            showGadgetState(gadget, state);
          });
        }
      }
    }
    for (const [fromState, fromLoc, toLoc, toState] of this.transitions) {
      for (const e of transitionElems) {
        if (e.getAttribute('fromState') === escape(fromState)
          && e.getAttribute('fromLoc') === escape(fromLoc)
          && e.getAttribute('toLoc') === escape(toLoc)
          && e.getAttribute('toState') === escape(toState)) {
          e.addEventListener('click', () => {
            showGadgetTransition(gadget, fromState, fromLoc, toLoc, toState);
          });
        }
      }
    }
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
    if (startState === undefined) return this;
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
}

// function determinize(gadget, startState) {
//   if (gadget.type !== 'Transitions') {
//     throw new Exception('Only Transitions type is supported')
//   }
//   if (startState === undefined) {
//     startState = gadget.states[0];
//   }
//
//   const states = [];
//   const transitions = {};
//   const queue = [[startState]];
//
//   while (queue.length > 0) {
//     const state = queue.shift();
//     const stateStr = JSON.stringify(state);
//     if (transitions.hasOwnProperty(stateStr)) continue;
//     states.push(stateStr);
//     transitions[stateStr] = [];
//     for (const fromLoc of gadget.locations) {
//       for (const toLoc of gadget.locations) {
//         const toStates = [...new Set(
//           state.flatMap(substate => performTransition(gadget, substate, fromLoc, toLoc))
//         )];
//         toStates.sort()
//         if (toStates.length > 0) {
//           queue.push(toStates);
//           transitions[stateStr].push([fromLoc, toLoc, JSON.stringify(toStates)]);
//         }
//       }
//     }
//   }
//
//   return {
//     name: gadget.name + " (determinized)",
//     type: "Transitions",
//     locations: gadget.locations,
//     states: states,
//     acceptingStates: states.filter(state => JSON.parse(state).some(substate => gadget.acceptingStates.includes(substate))),
//     transitions: transitions,
//   };
// }