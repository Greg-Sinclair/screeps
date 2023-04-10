var roomUtilities = require('utilities.rooms');
const spawnUtilities = require('utilities.spawns');

//globals
var room;
var terrain;

//need to maintain 2 of these for the inner and outer layer of source flags respectively
var cachedCostMatrixInner;
var cachedCostMatrixOuter;

// var roomControl = {
//   run: function (spawn) {
//     room = spawn.room;
//     terrain = room.getTerrain();
//     mainSpawn = spawn;
//     placeLoadFlags();
//     placeUnloadFlags();
//     queueConstructions(spawn);
//   }
// };

var roomControl = {
  run: function (_room){
    room = _room;
    if (!room.controller){
      return;
      // do nothing if the room has no controller
    }

    if (!room.controller.my){
      return;
      // exit if I don't own the room. other functions may be added here in the future
    }

    if (roomUtilities.checkRoomUpdateTimer(room)){
      roomUtilities.checkDevelopmentStates(room)
      terrain = room.getTerrain();
      if (developRoomTxCxFlags(room)){
        // will call developRoomTxCxFlags for 3 consecutive ticks to draw all the flags
        roomUtilities.resetRoomUpdateTimer(room);
        //don't do anything else until the flags are finished
        return;
      }
      room.find(FIND_MY_SPAWNS).forEach(function(spawn){
        spawnUtilities.updateNearestSource(spawn);
      })
    }
  }
}

// 3 steps are needed over 3 frames to establish the flags
// 1: place inner flags
// 2: place outer flags
// 3: audit flags, deleting potentially inaccessible placements
// if the final state has not been accomplished, resets the room update timer
// this applies to both sources and controllers, so the level stuff will be handled externally (I don't have a setup to save variables in the controller)
// since this ought to be done on a per-target bases, the functions this calls will need reworked as well

//TODO there is a case where sources directly next to each other might create weird flag configurations. Try to do them all at the same time to counteract this

function developRoomTxCxFlags(room){
  let controllerFlagLevel = room.memory.controllerFlagLevel;
  let result = false;
  let newLevel = 0;
  if (!controllerFlagLevel){
    room.memory.controllerFlagLevel = 0;
    controllerFlagLevel = 0;
  }
  newLevel = placeTxRxCxFlagsMultipart(room.controller, controllerFlagLevel, COLOR_YELLOW);
  if (newLevel != controllerFlagLevel){
    result = true;
  }
  room.memory.controllerFlagLevel = newLevel
  room.find(FIND_SOURCES).filter(function(source){return (roomUtilities.isSpaceSafe(source.pos)==true)}).forEach(function(source){
    let level = source.memory.flagLevel;
    if (!level){
      source.memory.flagLevel=0;
      level=0;
    }
    newLevel = placeTxRxCxFlagsMultipart(source, level, COLOR_ORANGE);

    if (newLevel != level){
      result=true;
    }
    source.memory.flagLevel = newLevel;
  });
  // if this returns true, abort the function in main (for this room anyway), reset its timer, and continue next tick
  return result;
}


function placeTxRxCxFlagsMultipart(target, level, primaryColor){
  // level 0: place inner flags
  // level 1: audit inner flags
  // level 2: place outer flags
  // level 3: audit outer flags
  if (level==0){
    placeTxRxFlags(target, primaryColor);
    return 1;
  }
  else if (level==1){
    auditFlagAccessibility(target, level);
    return 2;
  }
  else if (level==2){
    placeCxFlags(target, primaryColor);
    return 3;

  }
  else if (level==3){
    auditFlagAccessibility(target, level);
    return 4;
  }
  return 4;
}

module.exports = roomControl;



function drawRoad(start, target){
  if (!start || !target) {
    return false;
  }

  var path = start.pos.findPathTo(target, {ignoreCreeps:true});
  //for loop is non-inclusive so that it doesn't try to put a road on top of controllers or whatever, since this costs 45k
  for (var i = 1; i < path.length-1; i++){
    if (roomUtilities.isSpaceSafe(new RoomPosition(path[i].x, path[i].y, start.room.name))==false){
      return true;
      //this is so that it doesn't queue anything up past the enemy
    }
    var result = start.room.createConstructionSite(path[i].x, path[i].y, STRUCTURE_ROAD)
    if (result != 0 && result != -7){
      return false;
    }
  }
  return true;
}

function queueConstructions(spawn){

  //only queue a new batch of stuff once the original is finished
  // the time between work being finished and new stuff spawning in is pretty harmless since walls can be endlessly reinforced.
  if (spawn.room.find(FIND_MY_CONSTRUCTION_SITES).length > 0){return;}

  var controller = spawn.room.controller;
  //ignore sources that aren't safe

  //return if any of these fail to ensure the roads are prioritized
  //make a road from the spawn to the nearest source
  var spawnSource = Game.getObjectById(spawn.memory.nearestSource);
  if (spawnSource){
    if (!drawRoad(spawn, spawnSource)){
    return;
    }
  }
  //draw a road from the spawn to the controller
  if (!drawRoad(spawn, controller)){
    return;
  }
  //draw a road from the controller to all exploited sources
  var sources = spawn.room.find(FIND_SOURCES).filter(function(source){
    return (source.memory.devState == 'partial' || source.memory.devState == 'complete') && roomUtilities.isSpaceSafe(source.pos)
  });
  for (var i in sources){
    if (!drawRoad(controller, sources[i])){
    return;
    }
  }
  //there's a way to traverse these roads and connect them to the spawn if they go near it. do an aoe around the spawn for roads, pick the closest one to any point in another path, connect to it



  //place any extensions near the designated source (this is set up when the room is instantiated)
  //this part is a bit harder. having it adapt and switch sources if one gets attacked is logical, but that ruins the idea of a single creep to feed the extensions. is that even a good idea though? the carriers could just handle them
  //the extensions don't have memory either, but that won't be needed for this setup. when a carrier fills up from a source, if that source has non-full extensions the carrier signals that it'll deal with it (sets a flag in the source)
  //still not sure of the best strategy for placing them in the first place. find a large open area near a source? tricky
  //they should also not absolutely be prioritized under roads THEY CAN BE QUEUED AFTER (and should so they don't block traffic), THE BUILDERS JUST HAVE TO PRIORITIZE THEM

  return;

  if (spawn.memory.extensionSource == undefined){
    var extensionSource = findFurthestTarget(controller, sources);
    spawn.memory.extensionSource = extensionSource.id;
  }
  else{
    var extensionSource = Game.getObjectById(spawn.memory.extensionSource);
  }
  if (!drawRoad(spawn, extensionSource)){
    return;
  }
  placeExtension(extensionSource);

  //draw roads to the other sources
  for (var i=0; i<sources.length; i++){
    if (sources[i]!=controllerSource && sources[i]!=extensionSource){
      if (!drawRoad(controller,sources[i])){
        return;
      }
    }
  }


}

function drawRoadsToSources(spawn){
  let sources = spawn.room.find(FIND_SOURCES, {filter:function(source){
    return source.memory.active == true;
  }})
}


function placeExtension(source){
  //try all spots in an expanding grid around the source. make sure that there is a road queued already so that it won't be entirely blocked off
  //returns when the result is "too many builds" or "too many extensions"
  for (var range=1; range<6; range++){
    for (var x=-range; x<=range; x++){
      var result = source.room.createConstructionSite(x, source.y+range, STRUCTURE_EXTENSION);
      if (result == -8 || result == -14){
        return;
      }
    }for (var x=-range; x<=range; x++){
      var result = source.room.createConstructionSite(x, source.y-range, STRUCTURE_EXTENSION);
      if (result == -8 || result == -14){
        return;
      }
    }
    for (var y=-range; y<=range; y++){
      var result = source.room.createConstructionSite(source.x+range, y, STRUCTURE_EXTENSION);
      if (result == -8 || result == -14){
        return;
      }
    }
    for (var y=-range; y<=range; y++){
      var result = source.room.createConstructionSite(source.x-range, y, STRUCTURE_EXTENSION);
      if (result == -8 || result == -14){
        return;
      }
    }
  }

}

function findClosestTarget(start, destinations){
  var closest = null;
  var closestDistance = 9999
  for (var i=0; i<destinations.length; i++){
    var path = start.pos.findPathTo(destinations[i]);
    if (path.length < closestDistance){
      closest = destinations[i];
      closestDistance = path.length;
    }
  }
  return closest;
}
function findFurthestTarget(start, destinations){
  var furthest = null;
  var furthestDistance = 0
  for (var i=0; i<destinations.length; i++){
    var path = start.pos.findPathTo(destinations[i]);
    if (path.length > furthestDistance){
      furthest = destinations[i];
      furthestDistance = path.length;
    }
  }
  return furthest;
}

// flag placement refactor

// this gets called after each ring of flags have been placed, an audit to delete flags that are valid individually but block one another

function auditFlagAccessibility(source, level){
  // based on the development level, tell it which flags to look for
  if (level == 1){
    var layer = "INNER";
  }
  if (level == 3){
    var layer = "OUTER";
  }
  room.lookForAtArea(LOOK_FLAGS,Math.max(1,source.pos.y-2), Math.max(1,source.pos.x-2), Math.min(49,source.pos.y+2), Math.min(49,source.pos.x+2), true).forEach(function(flag){
    if ((layer == "INNER" && flag.flag.secondaryColor==COLOR_RED)
    ||(layer == "Outer" && flag.flag.secondaryColor==COLOR_GREEN)){
      if (!checkFlagToSourcePath(flag.flag, layer)){
      // they'll all be removed at the same tick and continue to see one another while doing this check, but that should be acceptable behavior
      flag.flag.remove();
      }
    }
  })
}


// 2 cases: inner flags only care about being blocked by other inner flags, outer flags care about both inner and outer
function checkFlagToSourcePath(flag, layer){
    //https://docs.screeps.com/api/#PathFinder.search
    //since it's only concerned about the inner layer of flags, it's safe to cache the cost matrix and drop all these flags at once

  let roomCallback = function(roomName){
    if (layer == "INNER"){
      if (cachedCostMatrixInner){
        return cachedCostMatrixInner;
      }
    }
    else if (layer == "OUTER"){
      if (cachedCostMatrixOuter){
        return cachedCostMatrixOuter;
      }
    }
    let room = Game.rooms[roomName];
    if (!room) {
      return;
    }
    let cachedCostMatrix = new PathFinder.CostMatrix;
    room.find(FIND_FLAGS,{filter:function(flag){
      if (layer == "INNER"){
        return (flag.secondaryColor == COLOR_RED);
      }
      if (layer == "OUTER"){
        return (flag.secondaryColor == COLOR_GREEN || flag.secondaryColor == COLOR_RED);
      }
      return (flag.secondaryColor in secondaryColorsToAvoid)
    }}).forEach(function(flag){
    //treat Cx flags as unwalkable
    cachedCostMatrix.set(flag.pos.x, flag.pos.y, 255)
    })
    if (layer == "INNER"){
      cachedCostMatrixInner = cachedCostMatrix;
    }
    else if (layer == "OUTER"){
      cachedCostMatrixOuter = cachedCostMatrix;
    }
    return cachedCostMatrix;
  }
  if (room.findPath(flag.pos, room.controller.pos, {
    ignoreCreeps:true,
    ignoreDestructibleStructures:true, //later on, draw roads to each flag so that nothing else will try to build on top of them
    maxRooms:1,
    costCallback:roomCallback
  }).length > 0) {
    return true;
  }
  return false;

}


function placeCxFlag(x, y, primaryColor){
  if (x==0 || y==0 || x==49 || y==49){
    return;
  }
  //a number of checks. is there already a flag in this spot, is terrain valid, is there a viable path back to a source if all other flags have creeps on them, is this near a Rx/Tx flag?
  if (terrain.get(x,y) == TERRAIN_MASK_WALL){
    return;
  }
  // Cx doesn't need to check if a creep is present, but TxRx do
  if (room.lookForAt(LOOK_FLAGS, x, y).length > 0){
    return;
  }

  if (room.lookForAtArea(LOOK_FLAGS,Math.max(1,y-1), Math.max(1,x-1), Math.min(49,y+1), Math.min(x+1), true).filter(function(flag){
    //return flag.color == primaryColor && flag.secondaryColor == COLOR_RED
    return flag.flag.secondaryColor == COLOR_RED
    //checking both colors is necessary for some insane situations where the source is right next to the controller
  }).length == 0){
    return;
  }
  // avoid places where red flags may be placed in the future. There is plausibly some insane scenario where this prevents a source from getting any green flags, but that can be solved in checkDevelopmentStates
  if (room.lookForAtArea(LOOK_SOURCES,Math.max(1,y-1), Math.max(1,x-1), Math.min(49,y+1), Math.min(x+1), true).length > 0){
    return;
  }
  room.createFlag(x,y, null, primaryColor, COLOR_GREEN);
}

function placeRxTxFlag(x, y, primaryColor){
  //a number of checks. is there already a flag in this spot, is terrain valid, is there a viable path back to a source if all other flags have creeps on them, is this near a Rx/Tx flag?
  if (x==0 || y==0 || x==49 || y==49){
    return;
  }
  if (terrain.get(x,y) == TERRAIN_MASK_WALL){
    return;
  }
  // Cx doesn't need to check if a creep is present, but TxRx do
  if (room.lookForAt(LOOK_FLAGS, x, y).length > 0){
    return;
  }
  if (room.lookForAt(LOOK_CREEPS, x, y).length > 0){
    return;
  }
  // this is done after all flags are placed
  // if (!checkFlagToSourcePath(x,y)){
  //   return;
  // }
  room.createFlag(x,y, null, primaryColor, COLOR_RED);
  //since a red flag was placed, the room update function will need to run again to draw the green flags next tick
}

function placeTxRxFlags(target, primaryColor){
  let x = target.pos.x;
  let y = target.pos.y;
  for (var i=-1; i<=1; i++){
    for (var j=-1; j<=1; j++){
      if (i!=0 || j!=0){
        placeRxTxFlag(x+i,y+j, primaryColor)
      }
    }
  }
}

function placeCxFlags(target, primaryColor){
  let x = target.pos.x;
  let y = target.pos.y;
  for (var i=-2; i<=2; i++){
    for (var j=-2; j<=2; j++){
      if (i==-2 || i==2 || j==-2 || j==2){
        placeCxFlag(x+i,y+j, primaryColor)
      }
    }
  }
}

