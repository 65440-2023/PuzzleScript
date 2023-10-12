function gadgetifyClick() {
    compile("restart");
    cache_console_messages = false;

    if (!canGadgetify()) {
        consolePrint("Can't run Gadgetify with this ruleset.")
    }
    else {
        for (let i = 0; i < state.levels.length; i++) {
            if (state.levels[i].message === undefined) {
                consolePrint(`Processing level ${i + 1}.`);
                const gadget = gadgetifyLevel(i);
                gadget.print();
                const simplified = gadget.simplify(0);
                simplified.print();
            }
        }
    }
    
    consoleCacheDump();
    redraw();
}

function canGadgetify() {
    if (!('player' in state.objects || 'player' in state.synonymsDict)) {
        consolePrint('`Player` must be an object or a synonym.');
        return false;
    }
    if (!('wall' in state.objects || 'wall' in state.synonymsDict)) {
        consolePrint('`Wall` must be an object or a synonym.');
        return false;
    }
    if (!('port' in state.objects || 'port' in state.synonymsDict)) {
        consolePrint('`Port` must be an object or a synonym.');
        return false;
    }
    for (const ruleGroup of state.rules) {
        for (const rule of ruleGroup) {
            if (rule.isRandom) {
                consolePrint(`Randomness is not supported (line ${rule.lineNumber}).`, false, rule.lineNumber);
                return false;
            }
            if (rule.ellipsisCount > 0 || rule.patterns.length > 1) {
                consolePrint(`Nonlocal rules are not supported (line ${rule.lineNumber}).`, false, rule.lineNumber);
                return false;
            }
            for (const command of rule.commands) {
                if (command.includes("win")) {
                    consolePrint(`WIN action is not supported (line ${rule.lineNumber}).`, false, rule.lineNumber);
                    return false;
                }
            }
        }
    }
    for (const wincondition of state.winconditions) {
        if (wincondition[0] === 0) {
            consolePrint(`ANY goals are not supported (line ${wincondition[3]}).`, false, wincondition[3]);
            return false;
        }
    }
    return true;
}

function gadgetifyLevel(levelIndex) {
    setGameState(state, ['loadLevel', levelIndex]);
    removePlayers();

    const ports = findPorts();
    const transitions = [];
    const gstateToLevel = [level.clone()];
    const acceptingGstates = []
    const gstateFromLevelString = new Map();
    gstateFromLevelString.set(convertLevelToString_fixed(), 0);
    const queue = [0];
    while (queue.length > 0) {
        const fromState = queue.shift();
        level = gstateToLevel[fromState].clone();
        RebuildLevelArrays();
        if (winConditionsSatisfied()) {
            acceptingGstates.push(fromState);
        }
        for (let fromPort = 0; fromPort < ports.length; fromPort++) {
            level = gstateToLevel[fromState].clone();
            RebuildLevelArrays();
            placePlayer(ports[fromPort]);
            const queue2 = [level.clone()];
            const substates = new Map();
            substates.set(convertLevelToString_fixed(), queue2[0]);
            while (queue2.length > 0) {
                const substate = queue2.shift();
                level = substate.clone();
                RebuildLevelArrays();
                const toPort = ports.indexOf(getPlayerPositions()[0]);
                if (toPort != -1) {
                    removePlayers();
                    const newGstateStr = convertLevelToString_fixed();
                    if (!gstateFromLevelString.has(newGstateStr)) {
                        gstateFromLevelString.set(newGstateStr, gstateToLevel.length);
                        queue.push(gstateToLevel.length);
                        gstateToLevel.push(level.clone());
                    }
                    const toState = gstateFromLevelString.get(newGstateStr);
                    transitions.push([fromState, fromPort, toPort, toState]);
                }
                for (let action = -1; action <= 5; action++) {
                    level = substate.clone();
                    RebuildLevelArrays();
                    processInput(action, true);
                    const newSubstateStr = convertLevelToString_fixed();
                    if (!substates.has(newSubstateStr)) {
                        substates.set(newSubstateStr, level.clone());
                        queue2.push(substates.get(newSubstateStr));
                    }
                }
            }
        }
    }
    return new Gadget(
        `Level ${levelIndex + 1}`,
        [...ports.keys()],
        [...gstateToLevel.keys()],
        transitions,
        acceptingGstates,
        state,
        l => ports[l],
        s => gstateToLevel[s].clone(),
    );
}

function findPorts() {
    var result=[];
    var portMask = getMaskFromName(state, 'port');
    for (var i=0;i<level.n_tiles;i++) {
        const cell = level.getCell(i);
        if (portMask.anyBitsInCommon(cell)) {
            result.push(i);
        }
    }
    return result;
}

function removePlayers() {
    for (const pos of getPlayerPositions()) {
        const cell = level.getCell(pos);
        cell.iclear(state.playerMask);
        level.setCell(pos, cell);
    }
}

function placePlayer(pos) {
    let cell = level.getCell(pos);
    cell.ior(state.playerMask);
    level.setCell(pos, cell);
    calculateRowColMasks();
}

// similar to convertLevelToString, but in the right order
// i don't want to edit the original because every test relies on it
function convertLevelToString_fixed() {
    var out = '';
    var seenCells = {};
    var i = 0;
    for (var y = 0; y < level.height; y++) {
        for (var x = 0; x < level.width; x++) {
            var bitmask = level.getCell(y + x * level.height);
            var objs = [];
            for (var bit = 0; bit < 32 * STRIDE_OBJ; ++bit) {
                if (bitmask.get(bit)) {
                    objs.push(state.idDict[bit])
                }
            }
            objs.sort();
            objs = objs.join(" ");
            /* replace repeated object combinations with numbers */
            if (!seenCells.hasOwnProperty(objs)) {
                seenCells[objs] = i++;
                out += objs + ":";
            }
            out += seenCells[objs] + ",";
        }
        out += '\n';
    }
    return out;
}

function showGadgetState(gadget, state) {
    console.log(`Loading state ${state} of gadget "${gadget.name}"`, true);
    setGameState(gadget.psState, ['rebuild']);
    const psLevel = gadget.psLevels(state)
    if (psLevel) {
        level = psLevel;
    } else {
        console.log(`Gadget "${gadget.name}" doesn't have any data associated with state ${state} :(`, true);
        return;
    }
    RebuildLevelArrays();
    calculateRowColMasks();
    redraw();
}

function showGadgetTransition(gadget, fromState, fromLoc, toLoc, toState) {
    showGadgetState(gadget, fromState);
    if (!gadget.psPorts(fromLoc)) {
        console.log(`Gadget "${gadget.name}" doesn't have any data associated with location ${fromLoc} :(`, true);
        return;
    }
    if (!gadget.psPorts(toLoc)) {
        console.log(`Gadget "${gadget.name}" doesn't have any data associated with location ${toLoc} :(`, true);
        return;
    }
    if (!gadget.psLevels(toState)) {
        console.log(`Gadget "${gadget.name}" doesn't have any data associated with state ${state} :(`, true);
        return;
    }
    placePlayer(gadget.psPorts(fromLoc));
    redraw();
}