
for (var i=0;i<10;i++) {
	var idname = "newsound"+i;
	var el = document.getElementById(idname);
    el.addEventListener("click", (function(n){return function(){return newSound(n);};})(i), false);
}

var soundButtonPress = document.getElementById("soundButtonPress");
soundButtonPress.addEventListener("click", buttonPress, false);


var runClickLink = document.getElementById("runClickLink");
runClickLink.addEventListener("click", runClick, false);

var saveClickLink = document.getElementById("saveClickLink");
saveClickLink.addEventListener("click", saveClick, false);

var rebuildClickLink = document.getElementById("rebuildClickLink");
rebuildClickLink.addEventListener("click", rebuildClick, false);

var shareClickLink = document.getElementById("shareClickLink");
shareClickLink.addEventListener("click", shareClick, false);

var levelEditorClickLink = document.getElementById("levelEditorClickLink");
levelEditorClickLink.addEventListener("click", levelEditorClick_Fn, false);

var exportClickLink = document.getElementById("exportClickLink");
exportClickLink.addEventListener("click", exportClick, false);

var exampleDropdown = document.getElementById("exampleDropdown");
exampleDropdown.addEventListener("change", dropdownChange, false);

var loadDropDown = document.getElementById("loadDropDown");
loadDropDown.addEventListener("change", loadDropDownChange, false);
