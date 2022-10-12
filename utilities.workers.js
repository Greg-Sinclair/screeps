//place to put functions shared by the creeps in the loader/carrier/unloader setup

module.exports = {
  'countAdjacentLoadersUnloaders':countAdjacentLoadersUnloaders,
  'cxHousekeeping':cxHousekeeping,
  'reserveCxFlag':reserveCxFlag,
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

// takes a primary color to search for the corresponding green flag of
function reserveCxFlag(creep, color){
  if (color == COLOR_YELLOW){
    var targetRole = "unloader"
  }
  else {
    // this is the default case just so there's something
    var targetRole = "loader"
  }
  // source must have an idling loader
  // loader must have an adjacent open Cx flag
  // this Cx flag must not be the last open Cx flag adjacent to an open Tx flag
  //querying sources is unnecessary, just query the loaders directly

  var targetFlags = creep.room.find(FIND_FLAGS, {filter:function(flag){
    // this is to make it execute faster since it needs to query all flags in the room
    if (flag.secondaryColor != COLOR_GREEN){return false;}
    if (flag.color != color || flag.memory.claimed){return false;}
    // look for an idling loader
    if (flag.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(targetCreep){
      return targetCreep.memory.role == targetRole && targetCreep.memory.idle > 0 && targetCreep.memory.onSite == true
    }}).length == 0){return}
    // now check if it blocks other flags
    if (flag.pos.findInRange(FIND_FLAGS, 1, {filter: function(redFlag){
      // there's an argument that it should only care about "claimed" red flags, since the carrier will likely move away again before a loader spawns and claims it
      return flag.secondaryColor == COLOR_RED && redFlag.pos.lookFor(LOOK_MY_CREEPS).length == 0 && redFlag.memory.claimed == true && flag2.pos.findInRange(FIND_FLAGS, 1, {filter: function(greenFlag){
        return greenFlag.secondaryColor == COLOR_GREEN && greenFlag.claimed == false
      }}).length > 1
    }}).length == 0
  ){
    return true;
  }}}).sort(function(a,b){
    // since it already filters by idle state of the loader, checking the number of loaders is redundant
    // return (creep.pos.findPathTo(a.pos).  length*countAdjacentLoadersUnloaders(a)) - (creep.pos.findPathTo(b.pos).length*countAdjacentLoadersUnloaders(b))});
    return creep.pos.findPathTo(a.pos).  length - creep.pos.findPathTo(b.pos).length;
  });
  if (targetFlags.length > 0){
    targetFlags[0].memory.claimed = true;
    creep.memory.flag = targetFlags[0].name;
    creep.memory.timeout = 0;
    //track the last source it pulled from
    // idk what this would be used for, so it's removed
    // creep.memory.source = targetFlags[0].pos.findInRange(FIND_SOURCES, 2)[0].id;
    // demandingSource hasn't been changed lately, needs to be looked into further and tested
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
  return false;
}
  //old, more convoluted query:
  // var sources = creep.room.find(FIND_SOURCES, {filter: function(source){
  //   return source.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(targetCreep){
  //     return targetCreep.memory.role == "loader" && targetCreep.memory.idle > 0 && targetCreep.memory.onSite == true && targetCreep.pos.findInRange(FIND_FLAGS, 1, {filter: function(flag){
  //       return flag.secondaryColor == COLOR_GREEN && flag.memory.claimed != true && flag.pos.findInRange(FIND_FLAGS, 1, {filter: function(flag2){
  //         // flag 2 is the other red flags that may be blocked if this one is taken
  //         return flag2.secondaryColor == COLOR_RED && flag2.pos.lookFor(LOOK_MY_CREEPS).length == 0 && flag2.pos.findInRange(FIND_FLAGS, 1, {filter: function(flag3){
  //           //flag 3 is the potential green flags that could be used to get to this red flag even if the chosen green flag was taken
  //           return flag3.secondaryColor == COLOR_GREEN && flag3.claimed == false
  //         }}).length > 1
  //       }).length == 0})
  //     }}).length > 0
  //   }}).length > 0 && (creep.memory.role == 'carrier' || source.memory.carrierOnly != true)
  // }}).sort(function(a,b){return creep.pos.findPathTo(a.pos).length-creep.pos.findPathTo(b.pos).length});
//   if (sources.length > 0){
//     var flags = sources[0].pos.findInRange(FIND_FLAGS, 2, {filter: function(flag){
//       return flag.color == COLOR_ORANGE && flag.secondaryColor == COLOR_GREEN && flag.memory.claimed != true
//     }}).sort(function(a,b){return countAdjacentLoadersUnloaders(b)-countAdjacentLoadersUnloaders(a)})
//     if (flags.length > 0){
//       flags[0].memory.claimed = true;
//       creep.memory.flag = flags[0].name;
//       creep.memory.timeout = 0;
//       //track the last source it pulled from
//       creep.memory.source = sources[0].id;
//       //if the creep demanded a source prioritize carriers, it saved that source's name. if it's the last creep with that name saved, remove the flag from the source
//       if (creep.memory.demandingSource){
//         var demandedSource = creep.room.find(FIND_SOURCES, {filter:{id:creep.memory.demandingSource}})
//         creep.memory.demandingSource = null;
//         if (demandedSource.length > 0){
//           var demandingCreeps = creep.room.find(FIND_MY_CREEPS, {filter:function(creep){
//             return creep.memory.demandingSource == demandedSource[0].id
//           }});
//           if (demandingCreeps.length == 0){
//             demandedSource[0].memory.carrierOnly = false;
//           }
//         }
//       }
//       return true;
//     }
//   }
//   //if this was a carrier that gets this far, set a flag in the source to make it only accept carriers
//   //idk how to turn it off afterwards
//   var source = creep.pos.findClosestByPath(FIND_SOURCES, {filter: function(source){
//     return source.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(creep){
//       return creep.memory.role == 'loader'
//     }})
//   }, ignoreCreeps : true })
//   if (source){
//     source.memory.carrierOnly = true;
//     creep.memory.demandingSource = source.id;
//   }
//   return false;
// }


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
  var targets = creep.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(target){
    return  roles.includes(target.memory.role) && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.name != target.name
  }})
  if (targets.length > 0){
    for (var i = 0; i < targets.length; i++){
      if(creep.transfer(targets[0], RESOURCE_ENERGY)==0){
        return true;
      }
    }
  }
  return false;
}
