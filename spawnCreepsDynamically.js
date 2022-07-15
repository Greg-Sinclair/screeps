const roomUtilities = require('utilities.rooms');

var spawnCreepsDynamically = {
  run: function (spawner){

    if (spawner.spawning == true){
      return;
    }
    //check whether it's necessary to panic-spawn some small mobile harvesters
    if (spawner.store[RESOURCE_ENERGY] >= 250){
      checkPanicSpawn(spawner);
      
    }
    
    //2 cases: use all capacity to spawn a creep for a certain role
    //or panic-spawn some creeps to get things rolling
    var capacity = spawner.room.energyCapacityAvailable;
    //later, calculate the actual cost of each type and use that instead, no need to wait for 100% capacity if it can't be used
    if (spawner.room.energyAvailable >= capacity){
      //figure out which type to spawn
      chooseCreepToSpawn(spawner);
      if (done) return;
    }
  }
}

var done=false;
var spawn;

function checkPanicSpawn(spawner){
  spawn = spawner;
  if (spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='loader')}}).length < 2 || spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='carrier')}}).length < 2 || spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='unloader')}}).length < 2){
    spawnHarvesterMobile(spawner);
    if (done) return;
  }
  else{
    var mobileHarvesters = spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='harvester')}});
    if (mobileHarvesters.length > 0){
      for (var i=0; i<mobileHarvesters.length; i++){
        mobileHarvesters[i].memory.role = "builderMobile";
      }
    }
  }
}



function chooseCreepToSpawn(spawner){
  //this may get hairy with multiple spawners, but hopefully time to replenish energy to 100% > spawn time

  //if there aren't carriers running, spawn mobile harvesters. otherwise convert the existing ones into mobile builders

//proceeding through this linearly doesn't work since it relies on a given type being maxed out when what's really needed is a good average
  var counts = [];
  //counts number of starting types (loader, carrier, unloader, mobile builder) to decide which to spawn. weighted because there should be 2 carriers per loader. add new types if necessary.
  counts.push(spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='loader')}}).length);
  counts.push(spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='carrier')}}).length / 2);
  counts.push(spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='unloader')}}).length);
  counts.push(spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='builderMobile')}}).length);
  var min = Math.min(...counts);

  //priority logic if there aren't a lot of each type
  if (min < 5){
    if (spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='loader')}}).length <= min){
      trySpawnLoader(spawner);
      if (done) return;
    }
    if (spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='carrier')}}).length / 2 <= min){
      trySpawnCarrier(spawner);
      if (done) return;
    }
    if (spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='unloader')}}).length <= min){
      trySpawnUnloader(spawner);
      if (done) return;
    }
    // if (spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='builderMobile')}}).length <= min){
    //   trySpawnMobileBuilder(spawner);
    //   if (done) return;
    // }
  }
  //priority for if there are a lot of each type already
  trySpawnCarrier(spawner);
  if (done) return;
  trySpawnUnloader(spawner);
  if (done) return;
  trySpawnLoader(spawner);
  if (done) return;
  // trySpawnMobileBuilder(spawner)
  // if (done) return;
  //once carrier has logic, put it before loader and unloader bc of the situation where it tries to make a loader for each source before any carriers
  
  

  //!!!!!!!!!!!!!



  //balance out the Loader, Carrier, and Unloaders
}

function spawnHarvesterMobile(spawner){
  var n=1;
  while (`HB${n}` in Game.creeps){
    n++;
  }
  if (n>2){
    return;
  }

  // var recipe = new Array();
  // for (var i=1; i<=spawner.room.energyCapacityAvailable/250;i++){
  //   if (recipe.length < 46)
  //   recipe.push(WORK);
  //   recipe.push(CARRY);
  //   recipe.push(MOVE);
  //   recipe.push(MOVE);
  // }

  spawner.spawnCreep([WORK, CARRY, MOVE, MOVE],`HB${n}`, {
      memory: {role: 'harvester'}
    });
  done=true;
}

function trySpawnMobileBuilder(spawner){
  spawnMobileBuilder(spawner)
}

function spawnMobileBuilder(spawner){
  var n=1;
  while (`Bm${n}` in Game.creeps){
    n++;
  }
  if (n>2){
    return;
  }
  var recipe = new Array();
  for (var i=1; i<=spawner.room.energyCapacityAvailable/250;i++){
    if (recipe.length < 46){
      recipe.push(WORK);
      recipe.push(CARRY);
      recipe.push(MOVE);
      recipe.push(MOVE);
    }
  }
  spawner.spawnCreep(recipe,`Bm${n}`, {
    memory: {role: 'builderMobile', idle: 0}
  });
  done=true;
}

function trySpawnLoader(spawner){
  //look for sources that are part of the network. this is only to exclude unused ones, the idle on the Tx is how it checks whether they're overused.
  var sources = spawner.room.find(FIND_SOURCES).filter(function(source){
    return (source.memory.devState == 'partial' || source.memory.devState == 'complete') && roomUtilities.isSpaceSafe(source.pos)
  });
  // console.log(`sources: ${sources.length}`)
  for (var i = 0; i < sources.length; i++){
    if (_(Game.creeps).filter(function(creep){
      return (creep.memory.role=='loader' && creep.memory.source == sources[i].id && creep.memory.idle > 0);
    }).size() == 0){
      //there's either no loader for this source, or they're all reasonably busy. check if there's an open flag
      //the trick with these flags is they don't have a direct pointer to their source, so check if they're directly adjacent to one
      var loadFlags = spawner.room.find(FIND_FLAGS, {filter: function(flag) {
        return (flag.color==COLOR_ORANGE && flag.secondaryColor==COLOR_RED && flag.memory.claimed!=true && findFlagSource(flag)==sources[i])
      }})
      if (loadFlags.length > 0){
        spawnLoader(spawner, sources[i].id);
        return;
      }
    } 
  }
}

function findFlagSource(flag){
  var sources = flag.room.lookForAtArea(LOOK_SOURCES, flag.pos.y-1, flag.pos.x-1, flag.pos.y+1, flag.pos.x+1, true).sort(function(a,b){return spawn.memory.nearestSource == a.id - spawn.memory.nearestSource == a.id})
  if (sources.length > 0) {
    return sources[0].source;
    
  }
  return null;
}

function spawnLoader(spawner, source){
  //might be simpler to just pass in the flag instead, reserve it when the spawn is queued
  var n=1;
  while (`Tx${n}` in Game.creeps){
    n++;
  }
  var recipe = [MOVE, CARRY];
  for (var i=1; i<=(spawner.room.energyCapacityAvailable-100)/100;i++){
    if (recipe.length < 46){
      recipe.push(WORK);
    }
  }
  spawner.spawnCreep(recipe,`Tx${n}`, {
    memory: {role: 'loader', idle: 0, 'source' : source}
  });
  done=true;
}

function trySpawnUnloader(spawner){
  //this is all going to have to change for multi-room setups
  //check how busy the current unloaders are
  //this will return if either there are no unloaders, or any unloader has a low workload (implying no more are needed)
  if (_(Game.creeps).filter(function(creep){
    return (creep.memory.role=='unloader' && creep.memory.idle > 25);
  }).size() > 0){
    return;
  } 
  //check if the controller has any unload slots left
  var unloadFlags = spawner.room.find(FIND_FLAGS, {filter: function(flag) {
    return (flag.color==COLOR_YELLOW && flag.secondaryColor==COLOR_RED && flag.memory.claimed!=true)
  }})
  if (unloadFlags.length > 0){
    spawnUnloader(spawner);
  }
}

function spawnUnloader(spawner){
  var n=1;
  while (`Rx${n}` in Game.creeps){
    n++;
  }
  var recipe = [MOVE, CARRY];
  for (var i=1; i<=(spawner.room.energyCapacityAvailable-100)/100;i++){
    if (recipe.length < 46){
      recipe.push(WORK);
    }
  }
  spawner.spawnCreep(recipe,`Rx${n}`, {
    memory: {role: 'unloader', idle: 0}
  });
  done=true;
}

function trySpawnCarrier(spawner){
  //spawn carrier if the carriers are underworked
  //spawning lots of all 3 will cause them to deplete the sources, all go idle, steady state
  //
  if (_(Game.creeps).filter(function(creep){
    return (creep.memory.role=='carrier' && creep.memory.idle > 25);
  }).size() > 0){
    return;
  } 
  spawnCarrier(spawner);
}

function spawnCarrier(spawner){
  var n=1;
  while (`Cx${n}` in Game.creeps){
    n++;
  }
  var recipe = [];
  for (var i=1; i<=spawner.room.energyCapacityAvailable/100;i++){
    if (recipe.length < 46){
      recipe.push(MOVE);
      recipe.push(CARRY);
    }
  }
  
  spawner.spawnCreep(recipe,`Cx${n}`, {
    memory: {role: 'carrier', 'loading': true, idle:0, timeout:0}
  });
  done=true;
}





module.exports = spawnCreepsDynamically;