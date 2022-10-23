//hauls energy from source to controller
// just move + carry

//has target source in memory
//has target destination in memory
//has status in loading: t/f, f by default

var workerUtilities = require('utilities.workers');
// import countAdjacentLoadersUnloaders from 'utilities.workers'
var rxClasses = ['unloader', 'builder'];
const TIMEOUT = 120;
const REFILL_THRESHOLD = 0.25
const IDLE_MINUS = 10;
const IDLE_PLUS = 1;

var roleCarrier = {
  /** @param {Creep} creep **/
  run: function (creep) {

    //new Cx setup with 2 modes: DEPOT and RESUPPLY
    //depot mode will afk on a flag and give energy to any targets until it runs out of energy or the flag despawns. uses onsite variable
    //resupply mode will run around giving energy to any structures that need it

    //change states if necessary
    workerUtilities.cxHousekeeping(creep);
    
    if (creep.memory.loading == true){
      // uses these flags: flag, onSite
      if (!creep.memory.flag){
        if(!workerUtilities.reserveCxFlag(creep, COLOR_ORANGE)){
          if (creep.memory.idle < 100){
            creep.memory.idle += IDLE_PLUS;
          }
          return;
        }
      }
      if (!creep.memory.onSite){
        var flag = Game.flags[creep.memory.flag];
        if (!flag){
          creep.memory.flag = null;
          return;
        }
        creep.moveTo(flag);
        if (creep.pos.isEqualTo(flag.pos)){
          creep.memory.onSite = true;
          return;
        }
      }
      return;
    }
    else{
      if (creep.memory.job == 'DEPOT'){
        jobDepot(creep);
      }
      else if (creep.memory.job == 'RESUPPLY'){
        jobResupply(creep);
      }
    }
  }
}

// uses these flags: flag, onSite
function jobDepot(creep){
  if (creep.memory.onSite == true){
    workerUtilities.deliverEnergy(creep, rxClasses);
    return;
  }
  else{
    // destruction of worksites is handled externally to reduce queries here
    if (creep.memory.flag){
      var flag = Game.flags[creep.memory.flag];
      if (creep.pos.isEqualTo(flag.pos)){
        creep.memory.onSite = true;
        workerUtilities.deliverEnergy(creep, rxClasses);
        return;
      }
      else{
        creep.moveTo(flag.pos);
      }
    }
    else{
      // first try to find a buildsite, then a CxRx flag
      if (reserveBuildFlag(creep)) return;
      if (workerUtilities.reserveCxFlag(creep, COLOR_YELLOW)) return;
      // if it gets this far, give up and become a resupply
      creep.memory.job = 'RESUPPLY'
    }
  }
}

// this is purely for structures
// uses these flags: target
function jobResupply(creep){
  if (!creep.memory.target){
    if (!findResupplyTarget(creep)){
      creep.memory.job = 'DEPOT'
      return;
    }
  }
  var target = Game.getObjectById(creep.memory.target);
  if (!target){
    creep.memory.target = null;
    return;
  }
  if (target.store.getFreeCapacity(RESOURCE_ENERGY)==0){
    creep.memory.target = null;
    return;
  }
  if (creep.transfer(target, RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
    creep.moveTo(target);
  }
}

// returns a boolean so that it can go to CxRx if it doesn't find a target
function reserveBuildFlag(creep){
  var flag = creep.pos.findClosestByPath(FIND_FLAGS, {
    ignoreCreeps:true,
    maxRooms:1, //maybe increase this later, might get strange behavior with swarms of them migrating though
    filter:function(flag){
    return (
      flag.secondaryColor != COLOR_GREEN && 
      flag.color == COLOR_BLUE &&
      !flag.memory.claimed
    )
  }})
  if (!flag) {
    return false;
  }
  else{
    flag.memory.claimed = true;
    flag.memory.creep = creep.name; // used to release the creep once work is finished
    creep.memory.flag = targetFlags[0].name;
  }
}

function findResupplyTarget(creep){
  // there's probably a smarter way to do this, ratios of distances to the different targets maybe?
  // choose a target then calculate whether it's actually more efficient to fill up and walk from the source to the target?
  if (creep.store[RESOURCE_ENERGY] < REFILL_THRESHOLD * creep.store.getCapacity(RESOURCE_ENERGY)){
    creep.memory.loading = true;
    creep.memory.onSite = false;
    return;
    //presumably it has no flag if it's here
  }
  //find a target, claim it, save its id (can be loaded by Game.getObjectById). possibilities are spawns, extensions, builders on builder flags (this case could be a little tricky)
  var structures = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) => {
      return (
        (structure.structureType == STRUCTURE_EXTENSION ||
        structure.structureType == STRUCTURE_SPAWN ||
        structure.structureType == STRUCTURE_TOWER) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 );
      },
  }).sort(function(a,b){return creep.pos.findPathTo(a).length - creep.pos.findPathTo(b).length});
  if (structures.length == 0){
    // give up and become a depot? idk
    return false;
  }
  creep.memory.target = structures[0].id;
  return true;
}


module.exports = roleCarrier;