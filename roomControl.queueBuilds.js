var roomUtilities = require('utilities.rooms');

//globals
var room;
var terrain;

var roomControl = {
  run: function (spawn) {
    room = spawn.room;
    terrain = room.getTerrain();
    queueConstructions(spawn);
    placeLoadFlags(spawn);
    placeUnloadFlags(spawn);
  }
};

module.exports = roomControl;

// function drawRoads(spawn){
//   //to avoid having to do some fancy connectivity algorithm, assume only one Spawn and everything is connected directly to it for now
//   //store a list of connected entities in the spawn

//   var connected = spawn.memory.connected;
//   if (connected == undefined){
//     spawn.memory.connected = new Array();
//     console.log('FIRST PASS')
//     return;
//   }
//   const sources = spawn.room.find(FIND_SOURCES)
//   for (var i=0; i<sources.length; i++){
//     // !!!!! move this check. it should try to draw the path even if it's connected, in case the path gets broken. just shouldn't redundantly add it to the list on success. the list isn't even necessary in this version tbh
//     if (connected.includes(sources[i].id)==false){
//       //try to draw a road to it from the spawn. check the response from the queue construction command, consider it complete once all the road pieces are queued
//       if (drawRoad(spawn, sources[i]) == true){
//         connected.push(sources[i].id);
//         spawn.memory.connected = connected;
//         console.log(connected)
//       }
//     }
//   }
//   //draw a road from the spawn to the controller, and then from the controller to the nearest source
// }

//once a target has been identified, try to draw a road to it. return True if it should be considered connected (all tiles are queued), false otherwise

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

function placeUnloadFlags(spawn){
  // for (var i in Game.flags){Game.flags[i].remove()}
  var control = spawn.room.controller;
  var x = control.pos.x;
  var y = control.pos.y;
  //ensure that duplicate flags aren't placed, concurrency causes it to place multiple flags on the same space in the same call

  //new flag setup (simple 2 rings) since the old one was overkill and potentially vulnerable to a really nested controller
  //the issue with this setup is it puts carrier flags in places that aren't adjacent to unloader flags, should find an efficient way to prevent that. the flags won't summon a creep so it's harmless, unless that real-estate is needed for something else (ie extensions)
  // for (var i=-2; i<=2; i++){
  //   for (var j=-2; j<=2; j++){
  //     if (i==-2 || i==2 || j==-2 || j==2){
  //       placeUnloadCarrierFlag(x+i,y+j)
  //     }
  //     else if (i!=0 || j!=0){
  //       placeUnloadFlag(x+i,y+j)
  //     }
  //   }
  // }

  //v2: doesn't spawn dead carrier flags
  for (var i=-1; i<=1; i++){
    for (var j=-1; j<=1; j++){
      if (i!=0 || j!=0){
        placeUnloadFlag(x+i,y+j)
      }
    }
  }
  for (var i=-2; i<=2; i++){
    for (var j=-2; j<=2; j++){
      if (i==-2 || i==2 || j==-2 || j==2){
        if ((new RoomPosition(x+i, y+j, spawn.room.name)).findInRange(FIND_FLAGS, 1, {filter:function(flag){return flag.color == COLOR_YELLOW && flag.secondaryColor == COLOR_RED}}).length > 0){
          placeUnloadCarrierFlag(x+i,y+j)
        }
      }
    }
  }

  //ring around the controller
  // placeUnloadFlag(x-1,y-1);
  // placeUnloadFlag(x,y-1);
  // placeUnloadFlag(x+1,y-1);
  // placeUnloadFlag(x-1,y);
  // placeUnloadFlag(x+1,y);
  // placeUnloadFlag(x-1,y+1);
  // placeUnloadFlag(x,y+1);
  // placeUnloadFlag(x+1,y+1);
  // //cross pattern. later check their adjacent spaces to make sure none are useless
  // placeUnloadFlag(x-2,y);
  // placeUnloadFlag(x+2,y);
  // placeUnloadFlag(x,y-2);
  // placeUnloadFlag(x,y+2);
  // //X pattern later check their adjacent spaces to make sure none are useless. might actually be better to do this after the carrier ones
  // placeUnloadFlag(x-2,y-2);
  // placeUnloadFlag(x-2,y+2);
  // placeUnloadFlag(x+2,y-2);
  // placeUnloadFlag(x+2,y+2);
  // //place unload carrier flags (knight pattern)
  // placeUnloadCarrierFlag(x-1,y-2)
  // placeUnloadCarrierFlag(x+1,y-2)
  // placeUnloadCarrierFlag(x+2,y-1)
  // placeUnloadCarrierFlag(x+2,y+1)
  // placeUnloadCarrierFlag(x+1,y+2)
  // placeUnloadCarrierFlag(x-1,y+2)
  // placeUnloadCarrierFlag(x-2,y-1)
  // placeUnloadCarrierFlag(x-2,y+1)
}

function placeUnloadFlag(x,y){
  // console.log(`x: ${x}, y: ${y}`)
  //later check for flags + creeps there too
  if (terrain.get(x,y) != TERRAIN_MASK_WALL && room.lookForAt(LOOK_FLAGS,x,y).length == 0 && room.lookForAt(LOOK_CREEPS,x,y).length == 0){
    room.createFlag(x,y, null, COLOR_YELLOW, COLOR_RED);
  }
}
function placeUnloadCarrierFlag(x,y){
  //makes sure there's at least 1 adjacent unload flag
  if (terrain.get(x,y) != TERRAIN_MASK_WALL && room.lookForAt(LOOK_FLAGS,x,y).length == 0){
      room.createFlag(x,y, null, COLOR_YELLOW, COLOR_GREEN);
  }
}

function placeLoadFlags(spawn){
  //formation for these will be a bit simpler
  var sources = spawn.room.find(FIND_SOURCES).filter(function(spawn){return (roomUtilities.isSpaceSafe(spawn.pos)==true)});
  for (var i=0;i<sources.length;i++){
    var source = sources[i];
    var x = source.pos.x;
    var y = source.pos.y;

    // for (var i=-2; i<=2; i++){
    //   for (var j=-2; j<=2; j++){
    //     if (i==-2 || i==2 || j==-2 || j==2){
    //       placeLoadCarrierFlag(x+i,y+j)
    //     }
    //     else if (i!=0 || j!=0){
    //       placeLoadFlag(x+i,y+j)
    //     }
    //   }
    // }

    for (var i=-1; i<=1; i++){
      for (var j=-1; j<=1; j++){
        if (i!=0 || j!=0){
          placeLoadFlag(x+i,y+j)
        }
      }
    }
    for (var i=-2; i<=2; i++){
      for (var j=-2; j<=2; j++){
        if (i==-2 || i==2 || j==-2 || j==2){
          if ((new RoomPosition(x+i, y+j, spawn.room.name)).findInRange(FIND_FLAGS, 1, {filter:function(flag){return flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_RED}}).length > 0){
            placeLoadCarrierFlag(x+i,y+j)
          }
        }
      }
    }

    // placeLoadFlag(x-1,y-1);
    // placeLoadFlag(x,y-1);
    // placeLoadFlag(x+1,y-1);
    // placeLoadFlag(x-1,y);
    // placeLoadFlag(x+1,y);
    // placeLoadFlag(x-1,y+1);
    // placeLoadFlag(x,y+1);
    // placeLoadFlag(x+1,y+1);

    // placeLoadCarrierFlag(x-2,y-2);
    // placeLoadCarrierFlag(x-1,y-2);
    // placeLoadCarrierFlag(x,y-2);
    // placeLoadCarrierFlag(x+1,y-2);
    // placeLoadCarrierFlag(x+2,y-2);
    // placeLoadCarrierFlag(x-2,y-1);
    // placeLoadCarrierFlag(x+2,y-1);
    // placeLoadCarrierFlag(x-2,y);
    // placeLoadCarrierFlag(x+2,y);
    // placeLoadCarrierFlag(x-2,y+1);
    // placeLoadCarrierFlag(x+2,y+1);
    // placeLoadCarrierFlag(x-2,y+2);
    // placeLoadCarrierFlag(x-1,y+2);
    // placeLoadCarrierFlag(x,y+2);
    // placeLoadCarrierFlag(x+1,y+2);
    // placeLoadCarrierFlag(x+2,y+2);
  }
}

function placeLoadFlag(x,y){
  // console.log(`x: ${x}, y: ${y}`)
  //later check for flags + creeps there too
  if (terrain.get(x,y) != TERRAIN_MASK_WALL && room.lookForAt(LOOK_FLAGS,x,y).length == 0 && room.lookForAt(LOOK_CREEPS,x,y).length == 0){
    room.createFlag(x,y, null, COLOR_ORANGE, COLOR_RED);
  }
}
function placeLoadCarrierFlag(x,y){
  //makes sure there's at least 1 adjacent unload flag
  if (terrain.get(x,y) != TERRAIN_MASK_WALL && room.lookForAt(LOOK_FLAGS,x,y).length == 0 && (
    room.lookForAt(LOOK_FLAGS,x-1,y).length > 0 ||
    room.lookForAt(LOOK_FLAGS,x+1,y).length > 0 ||
    room.lookForAt(LOOK_FLAGS,x,y-1).length > 0 ||
    room.lookForAt(LOOK_FLAGS,x,y+1).length > 0
    )){
      room.createFlag(x,y, null, COLOR_ORANGE, COLOR_GREEN);
  }
}
