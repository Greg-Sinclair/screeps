

var UPDATE_TIMER = 20;

module.exports = {
  'checkDevelopmentStates': checkDevelopmentStates,
  'checkRoomUpdateTimer': checkRoomUpdateTimer,
  'isSpaceSafe': isSpaceSafe,
  'printRoomDiagnostics': printRoomDiagnostics,
  'resetRoomUpdateTimer': resetRoomUpdateTimer,
}

//tracks whether a given source is fully mined each cycle
//used to determine whether a source has enough loaders
//for now this will be the only metric to determine whether a source is sufficiently developed (and another can be started)
//there may be a reason to call this outside of the times CDS, ie when a loader reaches its flag, but that amount of latency is probably inconsequential
function updateExploitationStates(room) {
  for (let source of room.find(FIND_SOURCES, {filter:function(source){
    return source.memory.active == true;
  }})){
    var harvestCapacity = 0;
    //first case: the loaders are strong enough to fully harvest it
    for (let loader of source.pos.findInRange(FIND_MY_CREEPS, 1, {filter:function(creep){return creep.memory.role=='loader'}})){
      harvestCapacity += loader.getActiveBodyparts(WORK) * 2 //each work part harvests 2 energy per tick
    }
    if (harvestCapacity * 300 > source.energyCapacity){
      source.memory.exploited = true;
      continue;
    }
    //second case: the loaders aren't strong enough, but all the spaces are taken. hopefully rare. It does raise the question of how a future Medic role should decide whether to just let loaders die
    if (source.pos.findInRange(FIND_MY_CREEPS, 1, {filter:function(creep){return creep.memory.role=='loader'}}) == source.pos.findInRange(FIND_MY_FLAGS, 1, {filter:function(flag){return flag.secondaryColor == COLOR_RED}})){
      source.memory.exploited = true;
      continue;
    }
    source.memory.exploited = false;

  }
}

//makes sure the flags aren't borked by terrain config
function checkSourceHasFlags(source){
  if (source.memory.hasFlags == true){
    return;
  }
  if (source.pos.findInRange(FIND_FLAGS, {filter:function(flag){return flag.pos.findInRange(FIND_FLAGS, {filter:function(flag2){return flag.secondaryColor == COLOR_GREEN;}}).length > 0}}).length == 0){
    console.log('wtaf is this terrain');
    console.log('figure out what to do about this');
    source.memory.hasFlags = false;
  }
  else{
    source.memory.hasFlags = true;
  }
}

//decide whether to activate another source, based on the states of the currently active ones
function checkDevelopmentStates(room) {
  updateExploitationStates(room)
  var activeSources = room.find(FIND_SOURCES).filter(function(source){
    return source.memory.active == true;
  });
  if (activeSources.length == 0){
    activateSource(spawn);
    activateSource(spawn);
    return
  }
  if (activeSources.filter(function(source){
    return source.memory.exploited == false;
  }).length <= 1) {
    activateSource(spawn);
  }
}

function activateSource(spawn){
  var promotedSource = spawn.pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps:true, filter: function(source){
    return source.memory.active == false && isSpaceSafe(source.pos)
  }})
  if (!promotedSource){
    return false;
  }
  promotedSource.memory.active = true;
  return true
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
  //console.log('resetting update timer')
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