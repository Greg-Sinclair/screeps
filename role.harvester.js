var roleHarvester = {
  /** @param {Creep} creep **/
  run: function (creep) {

    //change state at either extreme
    if (creep.store.getFreeCapacity([RESOURCE_ENERGY]) == 0){
      creep.memory.harvesting = false;
    }
    if (creep.store[RESOURCE_ENERGY] == 0){
      creep.memory.harvesting = true;
      if (creep.memory.target) {
        if (Game.getObjectById(creep.memory.target.id) instanceof StructureController){
        //look for other work after dumping all energy in controller
          creep.memory.target = null;
        }
      }
      
    }

    //ignore optimizations here for now. have it decide whether to refill upon finishing a job eventually
    if (creep.memory.harvesting==true){
      harvest(creep);
    }
    else{
      work(creep);
    }
  },//end of run
};

module.exports = roleHarvester;

function harvest(creep) {
  //this is pretty expensive, rework it into a normal flag setup later
  //there's also the case where they camp on top of a flag after it becomes claimed, but that's fine bc they'll end up leaving eventually
  var sources = creep.room.find(FIND_SOURCES, {filter:function(source){
    return source.pos.findInRange(FIND_FLAGS, 1, {filter:function(flag){return flag.color==COLOR_ORANGE && flag.secondaryColor==COLOR_RED && flag.memory.claimed!=true}}).length > 0
  }}).sort(function(a,b){return creep.pos.findPathTo(a.pos).length-creep.pos.findPathTo(b.pos).length});
  if (creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
    creep.moveTo(sources[0], { visualizePathStyle: { stroke: "#ffaa00" }});
  }
}

//called in the work function
function findWork(creep) {
var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
  filter: (structure) => {
    return (
      (structure.structureType == STRUCTURE_EXTENSION ||
      structure.structureType == STRUCTURE_SPAWN ||
      structure.structureType == STRUCTURE_TOWER) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0 );
    },
  });
  if (target) {
    creep.memory.target = target;
  }
  else {
    creep.memory.target = creep.room.controller;
    //return creep.room.controller;
  }
}

function work(creep){
  if (creep.memory.target) {
    var target = Game.getObjectById(creep.memory.target.id);
  }
  //find target if none
  if (target == null){
    findWork(creep);
  }
  //find new target if current one is finished
  else if (target != null && !(target instanceof StructureController)){
    if (target.store.getFreeCapacity(RESOURCE_ENERGY) == 0){
      findWork(creep);
    }
  }
  if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
    creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
  }
}
