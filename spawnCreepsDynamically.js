const roomUtilities = require('utilities.rooms');
const workerUtilities = require('utilities.workers');

const DEFAULT_MEMORY = {
  'idle':0,
  'timeout':0,
  'job':null,
}


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

function chooseCreepToSpawn(spawner){
  //this may get hairy with multiple spawners, but hopefully time to replenish energy to 100% > spawn time

  //if there aren't carriers running, spawn mobile harvesters. otherwise convert the existing ones into mobile builders

const RATIO_LOADER = 1;
const RATIO_CARRIER = 0.75;
const RATIO_UNLOADER = 1.5;

//proceeding through this linearly doesn't work since it relies on a given type being maxed out when what's really needed is a good average
  var counts = {};
  //counts number of starting types (loader, carrier, unloader, mobile builder) to decide which to spawn. weighted because there should be 2 carriers per loader. add new types if necessary.
  counts['loader'] = spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='loader')}}).length * RATIO_LOADER;
  counts['carrier'] = spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='carrier')}}).length * RATIO_CARRIER;
  counts['unloader'] = spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='unloader')}}).length * RATIO_UNLOADER;
  // counts['builderMobile'] = spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){return(creep.memory.role=='builderMobile')}}).length;
  // var min = Math.min(...Object.values(counts));
  var min = _.min(Object.values(counts));

  // idle checks are disabled during setup

  if (min <= 1){
    if (counts['loader'] == min){
      if(spawnLoader(spawner)){
        return;
      }
    }
    if (counts['carrier'] == min){
      if(spawnCarrier(spawner)){
        return;
      }
    }
    if (counts['unloader'] == min){
      if(spawnUnloader(spawner)){
        return;
      }
    }
  }

  let idleLoaders = 0
  // let idleCarriers = 0
  let idleUnloaders = 0
  let idleMobileBuilders = 0
  let idleBuilders = 0

  for (let loader of spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){
    return creep.memory.role=='loader' && creep.memory.idle > 0
  }})){
    idleLoaders += loader.memory.idle;
  }

  // for (let carrier of spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){
  //   return creep.memory.role=='carrier' && creep.memory.idle > 0
  // }})){
  //   idleCarriers += carrier.memory.idle;
  // }

  for (let unloader of spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){
    return creep.memory.role=='unloader' && creep.memory.idle > 0
  }})){
    idleUnloaders += unloader.memory.idle;
  }

  for (let builder of spawner.room.find(FIND_MY_CREEPS, {filter: function(creep){
    return creep.memory.role=='builder' && creep.memory.idle > 0
  }})){
    idleBuilders += builder.memory.idle;
  }
  // console.log(`idle loaders: ${idleLoaders}, idle unloaders: ${idleUnloaders}`)
  //use the idle count for loader and unloader to decide which of loader/unloader/carrier to spawn
  //if one but not the other is idle, it means the other is overworked
  //giving the carriers some sort of idle implementation may be useful to act as a release valve, another could be checking if all the sources in the room are being fully used. Several cases to consider. May also have idle unloaders because the energy is being used for something else, so it shouldn't be cyclical with those classes.
  //TODO base this on larger room context rather than just idle checks
  //TODO this doesn't remotely work
  if (idleLoaders > 0 && idleUnloaders == 0){
    spawnUnlaoder(spawner);
  }
  else if (idleUnloaders > 0 && idleLoaders == 0){
    spawnLoader(spawner);
  }
  else if (idleLoaders > 0 && idleUnloaders > 0){
    spawnCarrier(spawner)
  }

}


function spawnLoader(spawner){
  var name = pickCreepName('Tx');
  var flagName = workerUtilities.preReserveTxRxFlag(spawner, name, COLOR_ORANGE)
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
    Game.flags[flagName].memory.claimed=false;
    Game.flags[flagName].memory.creep=null;
  }
  return false
}

function spawnUnloader(spawner){
  var name = pickCreepName('Rx');
  var flagName = workerUtilities.preReserveTxRxFlag(spawner, name, COLOR_YELLOW)
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
      })
  })==0){
    return true
  }
  else{
    //spawn failed, reset the flag
    Game.flags[flagName].memory.claimed=false;
    Game.flags[flagName].memory.creep=null;
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


//====================== HELPER FUNCTIONS ==========================

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
  while (cost <= maxCost - repeatingCost){
    for (let ingredient of repeating){
        recipe.push(ingredient);
    }
    cost += repeatingCost
  }
  return recipe;
}



module.exports = spawnCreepsDynamically;