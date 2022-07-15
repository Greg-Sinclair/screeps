//place to put functions shared by the creeps in the loader/carrier/unloader setup

module.exports = {
  'countAdjacentLoadersUnloaders':countAdjacentLoadersUnloaders,
  'cxHousekeeping':cxHousekeeping,
  'reserveCxPickupFlag':reserveCxPickupFlag,
  'deliverEnergy':deliverEnergy,
}

function countAdjacentLoadersUnloaders(flag){
  if (flag.color == COLOR_YELLOW){
    return flag.room.find(FIND_MY_CREEPS, {filter: function(creep){
      return(
        creep.memory.role == 'unloader'&&
        flag.pos.isNearTo(creep)
      )
    }}).length;

  }
  else if (flag.color == COLOR_ORANGE){
    return flag.room.find(FIND_MY_CREEPS, {filter: function(creep){
      return(
        creep.memory.role == 'loader'&&
        flag.pos.isNearTo(creep)
      )
    }}).length;
  }
}


//refactor of some common code the Cx types use to track idle, flags, etc
function cxHousekeeping(creep){
  //on phase change, reset flag
  if (creep.memory.loading == true && creep.store.getFreeCapacity([RESOURCE_ENERGY]) == 0){
    creep.memory.loading = false;

    if (creep.memory.flag){
      Game.flags[creep.memory.flag].memory.claimed = false;
    }
    creep.memory.flag = null;
    creep.memory.target = null;
  }
  else if (creep.memory.loading == false && creep.store[RESOURCE_ENERGY] == 0){
    creep.memory.loading = true;
    if (creep.memory.flag){
      Game.flags[creep.memory.flag].memory.claimed = false;
    }
    creep.memory.flag = null;
    creep.memory.target = null;
  }
}



// not sure about this refactor. the goal is to let other types (builders) fill up directly from the Tx flags. this does risk builders starving out the carriers, though. having the builders crouch on the flags is decent though computationally expensive (and picking a flag means it doesn't have to keep looking for Tx flags every tick). this seems like the play, just need to give the carriers a way to force the builders off a source if they're trying to use it. flag in the source memory that says "a builder is trying to use this but can't"

//allow the builders to use this as well, on their end run a check for whether a carrier is complaining about the source being clogged

//this is getting to be a headache. probably better to rebuild the Cx flag handling from scratch

function reserveCxPickupFlag(creep){
  //process of choosing a flag: find a source with a loader who has been idling and an open Cx flag, sorted by nearest. take the nearest flag of that loader
  // console.log('trying to reserve cx pickup flag')
  var sources = creep.room.find(FIND_SOURCES, {filter: function(source){
    return source.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(creep){
      return creep.memory.role == "loader" && creep.memory.idle > 0;
    }}).length > 0 && source.pos.findInRange(FIND_FLAGS, 2, {filter: function(flag){
      return flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_GREEN && flag.memory.claimed != true
    }}).length > 0 && (creep.memory.role == 'carrier' || source.memory.carrierOnly != true)
  }}).sort(function(a,b){return creep.pos.findPathTo(a.pos).length-creep.pos.findPathTo(b.pos).length});
  if (sources.length > 0){
    var flags = sources[0].pos.findInRange(FIND_FLAGS, 2, {filter: function(flag){
      return flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_GREEN && flag.memory.claimed != true
    }}).sort(function(a,b){return countAdjacentLoadersUnloaders(b)-countAdjacentLoadersUnloaders(a)})
    if (flags.length > 0){
      flags[0].memory.claimed = true;
      creep.memory.flag = flags[0].name;
      creep.memory.timeout = 0;
      //track the last source it pulled from
      creep.memory.source = sources[0].id;
      //if the creep demanded a source prioritize carriers, it saved that source's name. if it's the last creep with that name saved, remove the flag from the source
      if (creep.memory.demandingSource){
        var demandedSource = creep.room.find(FIND_SOURCES, {filter:{id:creep.memory.demandingSource}})
        creep.memory.demandingSource = null;
        if (demandedSource.length > 0){
          var demandingCreeps = creep.room.find(FIND_MY_CREEPS, {filter:function(creep){
            return creep.memory.demandingSource == demandedSource[0].id
          }});
          if (demandingCreeps.length == 0){
            demandedSource[0].memory.carrierOnly = false;
          }
        }
      }
      return true;
    }
  }
  //if this was a carrier that gets this far, set a flag in the source to make it only accept carriers
  //idk how to turn it off afterwards
  var source = creep.pos.findClosestByPath(FIND_SOURCES, {filter: function(source){
    return source.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(creep){
      return creep.memory.role == 'loader'
    }})
  }, ignoreCreeps : true })
  if (source){
    source.memory.carrierOnly = true;
    creep.memory.demandingSource = source.id;
  }
  return false;
}


// function reserveTxCxFlag(creep){
//   var flags = creep.room.find(FIND_FLAGS, {filter: function(flag) {
//     return (flag.color==COLOR_ORANGE && flag.secondaryColor==COLOR_GREEN && flag.memory.claimed!=true && workerUtilities.countAdjacentLoadersUnloaders(flag)>0 && !flag.pos.findInRange(FIND_FLAGS, 1, {filter:{function(flag2){
//       //ignore flags adjacent to tx flags with a carrier en-route, in order to not blockade them
//       return flag2.color==COLOR_ORANGE && flag2.secondaryColor==COLOR_RED && flag2.memory.claimed == true
//     }}}))
//   }}).sort(function(a,b){return workerUtilities.countAdjacentLoadersUnloaders(b)-workerUtilities.countAdjacentLoadersUnloaders(a)});
//   if (flags.length > 0){
//     //find the source this flag pulls from
//     var flagSources = creep.room.lookForAtArea(LOOK_SOURCES, flags[0].pos.y-2, flags[0].pos.x-2, flags[0].pos.y+2, flags[0].pos.x+2, true)
//     //this should never be 0 if the flags are set up correctly
//     if (flagSources.length > 0) {
//       //this should ideally make it pick the spot with the most valid loaders/unloaders
//       flags[0].memory.claimed = true;
//       creep.memory.flag = flags[0].name;
//       creep.memory.timeout = 0;
//       //track the last source it pulled from
//       creep.memory.source = flagSources[0].source.id;
//     }
//   }
// }

function deliverEnergy(creep, roles){
  //takes an array of roles that the creep is willing to give its energy to
  var targets = creep.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(creep){
    return  roles.includes(creep.memory.role) && creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0
  }})
  if (targets.length > 0){
    for (var i = 0; i < targets.length; i++){
      if(creep.transfer(targets[0], RESOURCE_ENERGY==0)){
        return true;
      }
    }
  }
  return false;
}
