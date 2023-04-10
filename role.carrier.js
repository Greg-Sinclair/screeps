//hauls energy from source to controller
// just move + carry

//has target source in memory
//has target destination in memory
//has status in loading: t/f, f by default

var workerUtilities = require('utilities.workers');
// import countAdjacentLoadersUnloaders from 'utilities.workers'
var rxClasses = ['unloader', 'builder'];
const TIMEOUT = 5;
const REFILL_THRESHOLD = 0.25
const DEFAULT_COMPROMISE_TIMER = 60

var roleCarrier = {
  /** @param {Creep} creep **/
  run: function (creep) {
    jobDecide(creep);
    jobExecute(creep);
  }
}

/*
CARRIER has these jobs:
  COLLECT: go pick up energy from a loader
  CONTROLLER: take energy to an unloader
  DELIVER: take energy to source/extensions/tower/etc
  BUILD: stand on a build flag to supply the builders

  These could be enums, but strings is easier on the debugging, can easily be switched to enums later

  on running out of energy, it switches to COLLECT
  on running out of targets to resupply or build, it switches to COLLECT. there is room for some advanced behavior later, ie take a different job if energy > 50%

CARRIER memory variables:
  job (String)
  flag (name String), for loader and unloader flags
  target (name String), for deliver targets
  onSite (boolean), to track whether it's reached the flag (only the flag, not the target)
  timeout (integer), same as all creeps
  compromiseTimer (integer), a timer for the creep to give up and find another target if the current one isn't working


*/
function jobDecide(creep){
  switch(creep.memory.job){
    case 'COLLECT':
      if (creep.store.getFreeCapacity(RESOURCE_ENERGY)==0){
        switchJob(creep);
        chooseTxJob(creep);
      }
      break;
    //for now the only condition on stopping these is running out of energy
    case 'UPGRADE':
    case 'DELIVER':
    case 'BUILD':
      if (creep.store[RESOURCE_ENERGY]==0){
        switchJob(creep);
        creep.memory.job = "COLLECT";
      }
      break;
    default:
      switchJob(creep);
      creep.memory.job = "COLLECT";
  }

}

function jobExecute(creep){
  switch(creep.memory.job){
    case 'COLLECT':
      collectEnergy(creep)
      break;
    case 'UPGRADE':
      upgradeController(creep)
      break;
    case 'DELIVER':
      deliverEnergy(creep)
      break;
    case 'BUILD':
      break;
  }
}

function switchJob(creep){
  var flag = Game.flags[creep.memory.flag];
  if (flag){
    flag.memory.claimed=false;
    flag.memory.creep=null;
  }
  creep.memory.flag = null;
  creep.memory.target = null;
  creep.memory.onSite = false;
  creep.memory.compromiseTimer = DEFAULT_COMPROMISE_TIMER;
}

function chooseTxJob(creep){

  if (false){
    //TODO builder depot code goes here
    return;
  }
  else if (findDeliverTarget(creep)){
    creep.memory.job='DELIVER'
    return;
  }
  else if (workerUtilities.reserveCxFlag(creep, COLOR_YELLOW)){
    creep.memory.job='UPGRADE'
    return;
  }
  else {
    //to save CPU, will not try these queries again for a few ticks
    creep.memory.timeout = TIMEOUT;
  }
}

function collectEnergy(creep){
  if (creep.memory.onSite){
    creep.memory.compromiseTimer -= 1;
    if (creep.memory.compromiseTimer == 0){
      switchJob(creep); //give up and try elsewhere else if it's been waiting for too long
    }
    return
  }
  if (!creep.memory.flag){
    if(!workerUtilities.reserveCxFlag(creep, COLOR_ORANGE)){
      return
    }
  }
  var flag = Game.flags[creep.memory.flag];
  if (creep.pos.isEqualTo(flag.pos)){
    creep.memory.onSite = true;
  }
  else{
    creep.moveTo(flag.pos);
  }
}

function deliverEnergy(creep){
  if (creep.memory.target == null){
    if(!findDeliverTarget(creep)){
      switchJob(creep);
      creep.memory.job = 'UPGRADE'
      return;
    }
  }
  var target = Game.getObjectById(creep.memory.target);
  if (!target || target.store.getFreeCapacity(RESOURCE_ENERGY)==0){
    creep.memory.target = null;
    return;
  }
  if (creep.transfer(target, RESOURCE_ENERGY)==ERR_NOT_IN_RANGE){
    creep.moveTo(target);
  }
}

function findDeliverTarget(creep){
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

function upgradeController(creep){
  if (creep.memory.onSite){
    creep.memory.compromiseTimer -= 1;
    if (creep.memory.compromiseTimer == 0){
      switchJob(creep); //give up and try elsewhere else if it's been waiting for too long
      return
    }
    //for now assume it finds a deliver target. there can be a version that gives up and finds another flag, later
    workerUtilities.deliverEnergy(creep, ['unloader'])
    return;
  }
  if (!creep.memory.flag){
    if(!workerUtilities.reserveCxFlag(creep, COLOR_YELLOW)){
      creep.memory.timeout = TIMEOUT;
      return
    }
  }
  var flag = Game.flags[creep.memory.flag];
  if (creep.pos.isEqualTo(flag.pos)){
    creep.memory.onSite = true;
  }
  else{
    creep.moveTo(flag.pos);
  }
}

// function deliverToExtensions(creep){
// //ensure it's actually entered the facility

//   //look for directly adjacent extensions

//   let extensions = creep.room.lookForAtArea(LOOK_STRUCTURES, creep.pos.y-1,creep.pos.x-1,creep.pos.y+1,creep.pos.x+1, true)
//   for (let extension of extensions){
//     creep.transfer(extension.extension, RESOURCE_ENERGY)
//   }
// }



module.exports = roleCarrier;