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
                // gadget.print();
                const simplified = gadget.simplify();
                simplified.print().printLibraryMatch();
                const determinized = gadget.determinize().simplify();
                if (determinized.transitions.length != simplified.transitions.length ||
                        determinized.states.length != simplified.states.length) {
                    determinized.print().printLibraryMatch();
                }
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
    function serializeLevel() {
        return level.objects.join();
    }

    setGameState(state, ['loadLevel', levelIndex]);
    removePlayers();

    const ports = findPorts();
    const transitions = [];
    const gstateToLevel = [backupLevel()];
    const acceptingGstates = []
    const gstateFromLevelString = new Map();
    gstateFromLevelString.set(serializeLevel(), 0);
    const queue = [0];
    while (queue.length > 0) {
        const fromState = queue.shift();
        restoreLevel(gstateToLevel[fromState]);
        if (winConditionsSatisfied()) {
            acceptingGstates.push(fromState);
        }
        for (let fromPort = 0; fromPort < ports.length; fromPort++) {
            restoreLevel(gstateToLevel[fromState]);
            placePlayer(ports[fromPort]);
            const queue2 = [backupLevel()];
            const substates = new Map();
            substates.set(serializeLevel(), queue2[0]);
            while (queue2.length > 0) {
                const substate = queue2.shift();
                restoreLevel(substate);
                const toPort = ports.indexOf(getPlayerPositions()[0]);
                if (toPort != -1) {
                    removePlayers();
                    const newGstateStr = serializeLevel();
                    if (!gstateFromLevelString.has(newGstateStr)) {
                        gstateFromLevelString.set(newGstateStr, gstateToLevel.length);
                        queue.push(gstateToLevel.length);
                        gstateToLevel.push(backupLevel());
                    }
                    const toState = gstateFromLevelString.get(newGstateStr);
                    transitions.push([fromState, fromPort, toPort, toState]);
                }
                for (let action = -1; action <= 4; action++) {
                    restoreLevel(substate);
                    if (!processInput(action, true)) continue;
                    const newSubstateStr = serializeLevel();
                    if (!substates.has(newSubstateStr)) {
                        substates.set(newSubstateStr, backupLevel());
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
        levelIndex,
        l => ports[l],
        s => gstateToLevel[s],
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

function showGadgetState(gadget, gstate) {
    if (state !== gadget.psState || curlevel !== gadget.psLevelIndex) {
        console.log(`Loading level ${gadget.psLevelIndex + 1}`);
        setGameState(gadget.psState, ['loadLevel', gadget.psLevelIndex]);
    }
    console.log(`Loading state ${gstate} of gadget "${gadget.name}"`);
    level = restoreLevel(gstate);
    calculateRowColMasks();
    redraw();
}

function showGadgetLocation(gadget, glocation) {
    if (state !== gadget.psState || curlevel !== gadget.psLevelIndex) {
        console.log(`Loading level ${gadget.psLevelIndex + 1}`);
        setGameState(gadget.psState, ['loadLevel', gadget.psLevelIndex]);
    }
    console.log(`Teleporting player to location ${glocation} of gadget "${gadget.name}"`);
    removePlayers();
    placePlayer(gadget.psPorts(glocation));
    redraw();
}

// function showGadgetTransition(gadget, fromState, fromLoc, toLoc, toState) {
//     showGadgetState(gadget, fromState);
//     showGadgetLocation(gadget, fromLoc);
// }