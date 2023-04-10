const roomUtilities = require('utilities.rooms');
const workerUtilities = require('utilities.workers');

const DEFAULT_MEMORY = {
  'idle':0,
  'timeout':0,
  'job':null,
}
const BUILD_COMPLETION_THRESHOLD = 1000 //ticks

const ENERGY_RATIO_REQUIRED = 1.0

var spawnCreepsDynamically = {
  run: function (spawner){

    if (spawner.spawning == true){
      return;
    }
    //check whether it's necessary to panic-spawn some small mobile harvesters
    // if (spawner.store[RESOURCE_ENERGY] >= 250){
    //   checkPanicSpawn(spawner);

    // }

    //2 cases: use all capacity to spawn a creep for a certain role
    //or panic-spawn some creeps to get things rolling
    //later on dynamically lower the ratio if it seems to get hung up due to an inaccessible extension or something
    if (spawner.room.energyAvailable >= ENERGY_RATIO_REQUIRED * spawner.room.energyCapacityAvailable){
      chooseCreepToSpawn(spawner);
    }
  }
}


/*
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
*/

function chooseCreepToSpawn(spawn){
  //this may get hairy with multiple spawners, but hopefully time to replenish energy to 100% > spawn time

  //if there aren't carriers running, spawn mobile harvesters. otherwise convert the existing ones into mobile builders

const RATIO_LOADER = 1;
const RATIO_CARRIER = 0.75;
// const RATIO_UNLOADER = 1.5;

//proceeding through this linearly doesn't work since it relies on a given type being maxed out when what's really needed is a good average
  var counts = {};
  //counts number of starting types (loader, carrier, unloader, mobile builder) to decide which to spawn. weighted because there should be 2 carriers per loader. add new types if necessary.
  counts['loader'] = spawn.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='loader')}}).length * RATIO_LOADER;
  counts['carrier'] = spawn.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='carrier')}}).length * RATIO_CARRIER;
  var min = _.min(Object.values(counts));

  // idle checks are disabled during setup

  if (min <= 3){
    if (counts['loader'] == min){
      if(spawnLoader(spawn)){
        return;
      }
    }
    if (counts['carrier'] == min){
      if(spawnCarrier(spawn)){
        return;
      }
    }
  }

  // spawn a builder depending on the eta of current projects
  if (buildCompletionTime(spawn.room) > BUILD_COMPLETION_THRESHOLD){
    if (spawnBuilder(spawn)){
      return;
    }
  }
  spawnSupplyChainCreep(spawn)

}


function spawnLoader(spawner){
  var name = pickCreepName('Tx');
  var flagName = workerUtilities.reserveTxRxFlag(spawner, null, name, COLOR_ORANGE)
  var recipe = compileRecipe(
    spawner.room,
    [MOVE,CARRY,WORK],
    [WORK]
  )
  if (spawner.spawnCreep(recipe, name, {
    memory: Object.assign({}, DEFAULT_MEMORY, {
      role: 'loader',
      flag: flagName,
      onSite: false,
      })
  })==0){
    return true
  }
  else{
    //spawn failed, reset the flag
    if (flagName){
    Game.flags[flagName].memory.claimed=false;
    Game.flags[flagName].memory.creep=null;
    }
  }
  return false
}

function spawnUnloader(spawner){
  if (!spawner.room.controller){
    return false;
  }
  var name = pickCreepName('Rx');
  var flagName = workerUtilities.reserveTxRxFlag(spawner, spawner.room.controller, name, COLOR_YELLOW)
  if (flagName == null){
    return false; //it's possible that there are no open spots around the controller
  }
  var recipe = compileRecipe(
    spawner.room,
    [MOVE,CARRY,WORK],
    [WORK]
  )
  if (spawner.spawnCreep(recipe, name, {
    memory: Object.assign({}, DEFAULT_MEMORY, {
      role: 'unloader',
      flag: flagName,
      onSite: false,
    }),
  })==0){
    return true
  }
  else{
    if (flagName){
      Game.flags[flagName].memory.claimed=false;
      Game.flags[flagName].memory.creep=null;
    }
  }
  return false
}

function spawnCarrier(spawner){
  var name = pickCreepName('Cx');
  var recipe = compileRecipe(
    spawner.room,
    [],
    [MOVE,CARRY]
  )
  if(spawner.spawnCreep(recipe,name, {
    memory: Object.assign({}, DEFAULT_MEMORY, {role: 'carrier'})
  })==0){
    return true;
  }
  return false;
}

function spawnMobileBuilder(spawner){
  var name = pickCreepName('Bm');
  var recipe = compileRecipe(
    spawner.room,
    [],
    [MOVE,MOVE,CARRY,WORK]
  )
  if(spawner.spawnCreep(recipe,name, {
    memory: Object.assign({}, DEFAULT_MEMORY, {role: 'builderMobile'})
  })==0){
    return true;
  }
  return false;
}

function spawnBuilder(spawner){
  var name = pickCreepName('B');
  var recipe = compileRecipe(
    spawner.room,
    [CARRY],
    [WORK]
  )
  if(spawner.spawnCreep(recipe,name, {
    memory: Object.assign({}, DEFAULT_MEMORY, {role: 'builder'})
  })==0){
    return true;
  }
  return false;
}

//====================== META SPAWNING FUNCTIONS =================

//figures out which, if any, of carrier/loader/unloader to spawn
function spawnSupplyChainCreep(spawn){
  //loader idle alone is not sufficient to decide whether to spawn a loader. if a source actively needs a loader, then decide whether another loader or one of the others is needed
  var source = workerUtilities.findSourceThatNeedsLoader(spawn);
  let idleLoaders = 0
  let idleUnloaders = 0
  for (let loader of spawn.room.find(FIND_MY_CREEPS, {filter: function(creep){
    return creep.memory.role=='loader'
  }})){
    idleLoaders += loader.memory.idle;
  }

  for (let unloader of spawn.room.find(FIND_MY_CREEPS, {filter: function(creep){
    return creep.memory.role=='unloader'
  }})){
    idleUnloaders += unloader.memory.idle;
  }
  /*
  2 cases to acknowledge here:
  -loaders are not at full capacity, so a mix of loaders/unloaders/carriers is needed
  -loaders are at full capacity, so infinitely spawning more unloaders/carriers will eventually be excessive
  */
 // ! the trigger for spawning an unloader seems a little haphazard
  if (source != null) {
    if (idleLoaders <= 0){
      return spawnLoader(spawn, source)
    }
    else if (idleUnloaders <= 0){
      return spawnUnloader(spawn)
    }
    else{
      return spawnCarrier(spawn)
    }
  }
  else{
    //we already have the maximum number of loaders, so gotta figure out how many carriers is excessive.
    //the only real metric is whether the loaders are the bottleneck of not
    if (idleUnloaders <= 0){
      return spawnUnloader(spawn)
    }
    else if (idleLoaders > 0){
      return spawnCarrier(spawn)
    }
  }
}

//====================== HELPER FUNCTIONS ==========================

// figure out the best-case completion time for the room's structures (assume the workers do nothing but work)
//returns the number of ticks needed to finish everything
function buildCompletionTime(room){
  let throughput = 0
  for (let builder of room.find(FIND_MY_CREEPS, {filter:function(creep){
    return creep.memory.role == 'builder'
  }})){
    throughput += builder.body.filter(x => x===WORK).length * 5;
  }
  if (throughput == 0){return null}
  let energyNeeded = 0
  for (let site of room.find(FIND_MY_CONSTRUCTION_SITES)){
    energyNeeded += site.progressTotal - site.progress
  }
  return energyNeeded / throughput
}




function pickCreepName(template){
  var n=1;
  while (`${template}${n}` in Game.creeps){
    n++;
  }
  return `${template}${n}`
}

//dynamically generates a creep recipe based on the energy capacity of the room
function compileRecipe(room,base,repeating){
  var recipe = base;
  var maxCost = room.energyAvailable;
  var cost = 0;
  var repeatingCost = 0;
  for (let ingredient of base){
    cost += BODYPART_COST[ingredient]
  }
  for (let ingredient of repeating){
    repeatingCost += BODYPART_COST[ingredient]
  }
  if (repeatingCost==0){
    return recipe;
  }
  while (cost <= maxCost - repeatingCost && recipe.length < MAX_CREEP_SIZE){
    for (let ingredient of repeating){
        recipe.push(ingredient);
    }
    cost += repeatingCost
  }
  return recipe;
}



module.exports = spawnCreepsDynamically;