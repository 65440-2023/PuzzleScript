var unitTesting=false;
var curlevel=0;
var curlevelTarget=null;
var hasUsedCheckpoint=false;
var levelEditorOpened=false;
var muted=0;
var runrulesonlevelstart_phase=false;
var ignoreNotJustPressedAction=true;

function doSetupTitleScreenLevelContinue(){
    try {
        if (storage_has(document.URL)) {
            if (storage_has(document.URL+'_checkpoint')){
                var backupStr = storage_get(document.URL+'_checkpoint');
                curlevelTarget = JSON.parse(backupStr);
                
                var arr = [];
                for(var p in Object.keys(curlevelTarget.dat)) {
                    arr[p] = curlevelTarget.dat[p];
                }
                curlevelTarget.dat = new Int32Array(arr);

            }
            curlevel = storage_get(document.URL); 
        }
    } catch(ex) {
    }
}

doSetupTitleScreenLevelContinue();


var verbose_logging=false;
var throttle_movement=false;
var cache_console_messages=false;
var quittingTitleScreen=false;
var quittingMessageScreen=false;
var deltatime=17;
var timer=0;
var repeatinterval=150;
var autotick=0;
var autotickinterval=0;
var winning=false;
var againing=false;
var againinterval=150;
var norepeat_action=false;
var oldflickscreendat=[];//used for buffering old flickscreen/scrollscreen positions, in case player vanishes
var keybuffer = [];

var restarting=false;

var messageselected=false;

var textImages={};
var initLevel = {
    width: 5,
    height: 5,
    layerCount: 2,
    dat: [
    1, 3, 3, 1, 1, 2, 2, 3, 3, 1,
    2, 1, 2, 2, 3, 3, 1, 1, 2, 2,
    3, 2, 1, 3, 2, 1, 3, 2, 1, 3,
    1, 3, 3, 1, 1, 2, 2, 3, 3, 1,
    2, 1, 2, 2, 3, 3, 1, 1, 2, 2
    ],
    movementMask:[
    1, 3, 3, 1, 1, 2, 2, 3, 3, 1,
    2, 1, 2, 2, 3, 3, 1, 1, 2, 2,
    3, 2, 1, 3, 2, 1, 3, 2, 1, 3,
    1, 3, 3, 1, 1, 2, 2, 3, 3, 1,
    2, 1, 2, 2, 3, 3, 1, 1, 2, 2
    ],
    rigidGroupIndexMask:[],//[indexgroupNumber, masked by layer arrays]
    rigidMovementAppliedMask:[],//[indexgroupNumber, masked by layer arrays]
    bannedGroup:[],
    colCellContents:[],
    rowCellContents:[],
    colCellContents_Movements:[],
    rowCellContents_Movements:[],
};

var level = initLevel;

// returns all(?) globals as an object
// haha, just kidding, this code base has ~391 globals
function saveGlobals() {
    return {
        unitTesting: unitTesting,
        curlevel: curlevel,
        curlevelTarget: curlevelTarget,
        hasUsedCheckpoint: hasUsedCheckpoint,
        levelEditorOpened: levelEditorOpened,
        muted: muted,
        runrulesonlevelstart_phase: runrulesonlevelstart_phase,
        ignoreNotJustPressedAction: ignoreNotJustPressedAction,
        verbose_logging: verbose_logging,
        throttle_movement: throttle_movement,
        cache_console_messages: cache_console_messages,
        quittingTitleScreen: quittingTitleScreen,
        quittingMessageScreen: quittingMessageScreen,
        deltatime: deltatime,
        timer: timer,
        repeatinterval: repeatinterval,
        autotick: autotick,
        autotickinterval: autotickinterval,
        winning: winning,
        againing: againing,
        againinterval: againinterval,
        norepeat_action: norepeat_action,
        oldflickscreendat: oldflickscreendat,
        keybuffer: keybuffer,
        restarting: restarting,
        messageselected: messageselected,
        textImages: textImages,
        initLevel: initLevel,
        level: initLevel,
    }
}

// restores all(?) globals from an object
function restoreGlobals(globals) {
    unitTesting = globals.unitTesting;
    curlevel = globals.curlevel;
    curlevelTarget = globals.curlevelTarget;
    hasUsedCheckpoint = globals.hasUsedCheckpoint;
    levelEditorOpened = globals.levelEditorOpened;
    muted = globals.muted;
    runrulesonlevelstart_phase = globals.runrulesonlevelstart_phase;
    ignoreNotJustPressedAction = globals.ignoreNotJustPressedAction;
    verbose_logging = globals.verbose_logging;
    throttle_movement = globals.throttle_movement;
    cache_console_messages = globals.cache_console_messages;
    quittingTitleScreen = globals.quittingTitleScreen;
    quittingMessageScreen = globals.quittingMessageScreen;
    deltatime = globals.deltatime;
    timer = globals.timer;
    repeatinterval = globals.repeatinterval;
    autotick = globals.autotick;
    autotickinterval = globals.autotickinterval;
    winning = globals.winning;
    againing = globals.againing;
    againinterval = globals.againinterval;
    norepeat_action = globals.norepeat_action;
    oldflickscreendat = globals.oldflickscreendat;
    keybuffer = globals.keybuffer;
    restarting = globals.restarting;
    messageselected = globals.messageselected;
    textImages = globals.textImages;
    initLevel = globals.initLevel;
    level = globals.initLevel;
}