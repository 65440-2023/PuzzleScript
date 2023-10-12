function* getAllTransitions(transitions) {
  for (const fromState of Object.getOwnPropertyNames(transitions)) {
    for (const [fromLoc, toLoc, toState] of transitions[fromState]) {
      yield [fromState, fromLoc, toLoc, toState];
    }
  }
}

function mkTransitions(allTransitions) {
  const transitions = {};
  for (const [fromState, fromLoc, toLoc, toState] of allTransitions) {
    if (!transitions.hasOwnProperty(fromState)) {
      transitions[fromState] = [];
    }
    transitions[fromState].push([fromLoc, toLoc, toState]);
  }
  return transitions;
}

function mapTransitions(transitions, fn) {
  return mkTransitions([...getAllTransitions(transitions)].map(fn))
}

function filterTransitions(transitions, fn) {
  return mkTransitions([...getAllTransitions(transitions)].filter(fn))
}

function performTransition(gadget, fromState, fromLoc, toLoc) {
  return gadget.transitions[fromState]
        .filter(t => t[0] === fromLoc && t[1] === toLoc)
        .map(t => t[2]);
}

function filterStates(gadget, fn) {
  return {
    name: gadget.name,
    type: "Transitions",
    locations: gadget.locations,
    states: gadget.states.filter(fn),
    acceptingStates: gadget.acceptingStates.filter(fn),
    transitions: filterTransitions(gadget.transitions,
      ([fromState, fromLoc, toLoc, toState]) => fn(fromState) && fn(toState)
    ),
  };
}

function formatGadget(gadget, loops=false) {
  if (!loops) {
    gadget = removeLoops(gadget);
  }
  const transitionsStr = Object.getOwnPropertyNames(gadget.transitions).map(fromLoc =>
    `\n    ${JSON.stringify(fromLoc)}: ${JSON.stringify(gadget.transitions[fromLoc])}`
  ).join(',');
  const str =
`{
  "name": ${JSON.stringify(gadget.name)},
  "type": ${JSON.stringify(gadget.type)},
  "locations": ${JSON.stringify(gadget.locations)},
  "states": ${JSON.stringify(gadget.states)},
  "acceptingStates": ${JSON.stringify(gadget.acceptingStates)},
  "transitions": {${transitionsStr}
  }
}`
  if (JSON.stringify(JSON.parse(str)) !== JSON.stringify(gadget)) {
    throw new Exception('gadget serialization failed');
  }

  return str;
}

function printGadget(gadget, loops=false) {
  const str = formatGadget(gadget, loops);
  console.log(str);
  consolePrint(`<pre style="display:inline-block">${str}</pre>`);
}

function determinize(gadget, startState) {
  if (gadget.type !== 'Transitions') {
    throw new Exception('Only Transitions type is supported')
  }
  if (startState === undefined) {
    startState = gadget.states[0];
  }

  const states = [];
  const transitions = {};
  const queue = [[startState]];

  while (queue.length > 0) {
    const state = queue.shift();
    const stateStr = JSON.stringify(state);
    if (transitions.hasOwnProperty(stateStr)) continue;
    states.push(stateStr);
    transitions[stateStr] = [];
    for (const fromLoc of gadget.locations) {
      for (const toLoc of gadget.locations) {
        const toStates = [...new Set(
          state.flatMap(substate => performTransition(gadget, substate, fromLoc, toLoc))
        )];
        toStates.sort()
        if (toStates.length > 0) {
          queue.push(toStates);
          transitions[stateStr].push([fromLoc, toLoc, JSON.stringify(toStates)]);
        }
      }
    }
  }

  return {
    name: gadget.name + " (determinized)",
    type: "Transitions",
    locations: gadget.locations,
    states: states,
    acceptingStates: states.filter(state => JSON.parse(state).some(substate => gadget.acceptingStates.includes(substate))),
    transitions: transitions,
  };
}

function relabelStates(gadget) {
  const stateMap = Object.fromEntries(gadget.states.map((state, index) => [state, index.toString()]));
  return {
    name: gadget.name,
    type: "Transitions",
    locations: gadget.locations,
    states: gadget.states.map(s => stateMap[s]),
    acceptingStates: gadget.acceptingStates.map(s => stateMap[s]),
    transitions: mapTransitions(gadget.transitions,
      ([fromState, fromLoc, toLoc, toState]) => [stateMap[fromState], fromLoc, toLoc, stateMap[toState]]
    ),
  };
}

function removeLoops(gadget) {
  return {
    name: gadget.name,
    type: "Transitions",
    locations: gadget.locations,
    states: gadget.states,
    acceptingStates: gadget.acceptingStates,
    transitions: filterTransitions(gadget.transitions,
      ([fromState, fromLoc, toLoc, toState]) => fromLoc !== toLoc || fromState !== toState
    ),
  };
}

function mergeStates(gadget) {
  // dominates[s][t] means that you'll always prefer being in state s over state t
  const dominates = Object.fromEntries(gadget.states.map(s =>
    [s, Object.fromEntries(gadget.states.map(t => 
      [t, gadget.acceptingStates.includes(s) || !gadget.acceptingStates.includes(t)]
    ))]
  ));
  let progress;
  do {
    progress = false;
    for (const state1 of gadget.states) {
      for (const state2 of gadget.states) {
        if (!dominates[state1][state2] || state1 === state2) continue;
        for (const fromLoc of gadget.locations) {
          for (const toLoc of gadget.locations) {
            const toStates1 = performTransition(gadget, state1, fromLoc, toLoc);
            const toStates2 = performTransition(gadget, state2, fromLoc, toLoc);
            if (!toStates2.every(toState2 => toStates1.some(toStates1 => dominates[toStates1][toState2]))) {
              dominates[state1][state2] = false;
              progress = true;
            }
          }
        }
      }
    }
  } while(progress);

  console.log(dominates);

  return {
    name: gadget.name,
    type: "Transitions",
    locations: gadget.locations,
    states: gadget.states,
    acceptingStates: gadget.acceptingStates,
    transitions: filterTransitions(gadget.transitions,
      ([fromState, fromLoc, toLoc, toState]) =>
        !performTransition(gadget, fromState, fromLoc, toLoc).some(toState2 =>
          toState2 != toState && dominates[toState2][toState]
        ) &&
        !(fromLoc === toLoc && fromState !== toState && dominates[fromState][toState])
    ),
  };
}

function removeUnreachable(gadget, startState) {
  const reachable = {};
  for (const state of gadget.states) {
    reachable[state] = false;
  }
  const queue = [startState];

  while (queue.length > 0) {
    const state = queue.shift();
    if (reachable[state]) continue;
    reachable[state] = true;
    for (const [fromLoc, toLoc, toState] of gadget.transitions[state]) {
      queue.push(toState);
    }
  }
  return filterStates(gadget, s => reachable[s]);
}

function removeUnwinnable(gadget) {
  const winnable = {};
  for (const state of gadget.states) {
    winnable[state] = false;
  }
  for (const state of gadget.acceptingStates) {
    winnable[state] = true;
  }

  let progress;
  do {
    progress = false;
    winnable[state] = 1;
    for (const fromState of gadget.states) {
      for (const [fromLoc, toLoc, toState] of gadget.transitions[fromState]) {
        if (winnable[toState]) {
          winnable[fromState] = 1;
        }
      }
    }
  } while (progress);

  return filterStates(gadget, s => winnable[s]);
}

function simplifyGadget(gadget, startState) {
  gadget = mergeStates(gadget);
  if (startState) {
    gadget = removeUnreachable(gadget, startState);
  }
  gadget = removeUnwinnable(gadget);
  return gadget;
}