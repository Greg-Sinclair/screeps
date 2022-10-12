var sourceUtilities = require('utilities.sources');

var UPDATE_TIMER = 20;

module.exports = {
  'checkDevelopmentStates': checkDevelopmentStates,
  'checkRoomUpdateTimer': checkRoomUpdateTimer,
  'isSpaceSafe': isSpaceSafe,
  'printRoomDiagnostics': printRoomDiagnostics,
  'resetRoomUpdateTimer': resetRoomUpdateTimer,
}
  //these states go 'pending' (not connected yet), 'partial' (ongoing development), 'complete' (roads are finished and has enough Tx (or did at some point))
function checkDevelopmentStates(room) {
  //for the purposes of these queries, spots with enemies nearby may as well not exist. I don't think that's problematic, though there's some absurd situation where enemies run around and the whole room goes Pending
  //if there are no developed sources, set the two nearest the spawner to pending (to avoid a situation where the nearest is in a bottleneck and slows initial growth)
  var partialSources = room.find(FIND_SOURCES).filter(function(source){
    return source.memory.devState=='partial'&&isSpaceSafe(source.pos)
  });
  var completeSources = room.find(FIND_SOURCES).filter(function(source){
    return source.memory.devState=='complete'&&isSpaceSafe(source.pos)
  });

  if (partialSources.length == 0 && completeSources.length == 0){
    console.log('promoting 2 sources')
    //same line twice here so that it activates 2
    var spawn = room.find(FIND_MY_SPAWNS)[0];
    var promotedSource = spawn.pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps:true, filter: function(source){
      return source.memory.devState!='partial'&&source.memory.devState!='complete'&&isSpaceSafe(source.pos)
    }})
    if (!promotedSource){
      return;
    }
    promotedSource.memory.devState = 'partial';
    promotedSource = spawn.pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps:true, filter: function(source){
      return source.memory.devState!='partial'&&source.memory.devState!='complete'&&isSpaceSafe(source.pos)
    }})
    if (!promotedSource){
      return;
    }
    promotedSource.memory.devState = 'partial';
    return;
  }
  //audit all the "partial" sources, if there are none left after promote another to partial
  for (var i in partialSources){
    sourceUtilities.auditDevelopmentState(partialSources[i]);
  }
  // if (partialSources.filter(function(source){
  //   source.memory.devState == 'partial'
  // }).length == 0){
  //it's necessary to re-query this for whatever reason (flattened into an array of names?)
  if (room.find(FIND_SOURCES).filter(function(source){
    return source.memory.devState=='partial'&&isSpaceSafe(source.pos)
  }).length == 0){
    var promotedSource = room.find(FIND_MY_SPAWNS)[0].pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps:true, filter: function(source){
      return source.memory.devState!='partial'&&source.memory.devState!='complete'&&isSpaceSafe(source.pos)
    }})
    if (promotedSource){
      promotedSource.memory.devState = 'partial';
    }
  }
}



  
function checkRoomUpdateTimer(room){
  if (room.memory.updateTimer==null){
    // spawn.memory.updateTimer = UPDATE_TIMER - 1;
    room.memory.updateTimer = 0
    console.log('update timer initialized')
    return true; //fires immediately once without waiting for the timer, then fires a second time immediately (necessary for the green flags to spawn)
  }
  if (room.memory.updateTimer >= UPDATE_TIMER){
    room.memory.updateTimer = 0;
    return true;
  }
  else{
    room.memory.updateTimer++;
    return false;
  }
}

// called in order to queue another run of some admin function for the next tick, ie placing flags in waves
function resetRoomUpdateTimer(room){
  room.memory.updateTimer = UPDATE_TIMER
  console.log('resetting update timer')
}

function printRoomDiagnostics(room){
  var tx = room.find(FIND_MY_CREEPS, {filter: function(creep){
    return (creep.memory.role=="loader" && creep.memory.idle > 0
  )}}).length;
  var cx = room.find(FIND_MY_CREEPS, {filter: function(creep){
    return (creep.memory.role=="carrier" && creep.memory.idle > 0
  )}}).length;
  var rx = room.find(FIND_MY_CREEPS, {filter: function(creep){
    return (creep.memory.role=="unloader" && creep.memory.idle > 0
  )}}).length;
  console.log(`diagnostics for ${room.name}:`)
  console.log(`idle tx: ${tx}`)
  console.log(`idle cx: ${cx}`)
  console.log(`idle rx: ${rx}`)
}



//call this when deciding to set up a construction site or flag, if returns false send in the army
function isSpaceSafe(space) {
  const DISTANCE = 6
  var threat = space.findClosestByRange(FIND_HOSTILE_CREEPS)
  if (threat) {
    if (threat.pos.getRangeTo(space) < DISTANCE){
      return false
    }
  }
  threat = space.findClosestByRange(FIND_HOSTILE_STRUCTURES)
  if (threat) {
    if (threat.pos.getRangeTo(space) < DISTANCE){
      return false
    }
  }
  return true;
}