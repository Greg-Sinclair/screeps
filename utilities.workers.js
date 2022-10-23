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
    creep.memory.onSite = false;
    if (creep.memory.flag){
      Game.flags[creep.memory.flag].memory.claimed = false;
    }
    creep.memory.flag = null;
    creep.memory.target = null;

    // there can be an actual algorithm for this later, for now just default to RESUPPLY since DEPOT is the more aggressive expansion one
    //it'll requery each tick if it can't find either of them, that can be dealt with later
    creep.memory.job == 'RESUPPLY';

  }
  else if (creep.memory.loading == false && creep.store[RESOURCE_ENERGY] == 0){
    creep.memory.loading = true;
    creep.memory.onSite = false;
    if (creep.memory.flag){
      Game.flags[creep.memory.flag].memory.claimed = false;
    }
    creep.memory.flag = null;
    creep.memory.target = null;
  }
  if (creep.memory.compromiseTimer > 0){
    if ((creep.memory.loading == true && creep.store[RESOURCE_ENERGY] == 0) ||(creep.memory.loading == false && creep.store.getFreeCapacity([RESOURCE_ENERGY]) == 0)){
    creep.memory.compromiseTimer -= 1;
      //not entirely sure how carrier idle should work, but this is an obvious case
      if (creep.memory.idle < 100){
        creep.memory.idle++;
      }
      if (creep.memory.compromiseTimer==0){
      //make sure it isn't waiting at a dead spot for too long
      //check this to ensure a TxRx didn't show up in the meantime
      
        if (creep.memory.flag){
          Game.flags[creep.memory.flag].memory.claimed = false;
        }
        creep.memory.flag = null;
        creep.memory.onSite = false;
        // if it fails to find a target again, it does the same query and stays where it is
      
      }
    }
    else{
      creep.memory.compromiseTimer = 0;
    }
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
    }}).length == 0){return false}
    // now check if it blocks other flags
    if (flag.pos.findInRange(FIND_FLAGS, 1, {filter: function(redFlag){
      // there's an argument that it should only care about "claimed" red flags, since the carrier will likely move away again before a loader spawns and claims it
      return redFlag.secondaryColor == COLOR_RED && 
      redFlag.pos.lookFor(LOOK_CREEPS).length == 0 && 
      redFlag.memory.claimed == true && 
      redFlag.pos.findInRange(FIND_FLAGS, 1, {filter: function(greenFlag){
        return greenFlag.secondaryColor == COLOR_GREEN && 
        greenFlag.claimed == false ||
        greenFlag != flag // this flag won't be a useful gap if it's the one we're taking
      }}).length == 0
    }}).length == 0
    ){
      return true;
  }}})
  //if none were found, try ones that don't have a nearby creep just to stay out of the way. other checks still apply
  if (targetFlags.length == 0){
    targetFlags = creep.room.find(FIND_FLAGS, {filter:function(flag){
      // this is to make it execute faster since it needs to query all flags in the room
      if (flag.secondaryColor != COLOR_GREEN){return false;}
      if (flag.color != color || flag.memory.claimed){return false;}
      // now check if it blocks other flags
      if (flag.pos.findInRange(FIND_FLAGS, 1, {filter: function(redFlag){
        // in this version also cares about unclaimed flags since it isn't certain how long the creep will be idling there
        return redFlag.secondaryColor == COLOR_RED && 
        redFlag.pos.lookFor(LOOK_CREEPS).length == 0 && 
        redFlag.pos.findInRange(FIND_FLAGS, 1, {filter: function(greenFlag){
          return greenFlag.secondaryColor == COLOR_GREEN && 
          greenFlag.claimed == false ||
          greenFlag != flag
        }}).length == 0
      }}).length == 0
      ){
        return true;
    }}})
    if (targetFlags.length == 0){
      //if it's STILL zero, wait a few seconds before trying again
      creep.memory.timeout = 5;
    }
    else{
      creep.memory.compromiseTimer = 30; //can't let it rot on that flag, will search for a new one soon
    }
  }
  targetFlags.sort(function(a,b){
    // since it already filters by idle state of the loader, checking the number of loaders is redundant
    // return (creep.pos.findPathTo(a.pos).  length*countAdjacentLoadersUnloaders(a)) - (creep.pos.findPathTo(b.pos).length*countAdjacentLoadersUnloaders(b))});
    return creep.pos.findPathTo(a.pos).length - creep.pos.findPathTo(b.pos).length;
  });
  if (targetFlags.length > 0){
    targetFlags[0].memory.claimed = true;
    targetFlags[0].memory.creep = creep.name;
    creep.memory.flag = targetFlags[0].name;
    //track the last source it pulled from
    // idk what this would be used for, so it's removed
    // creep.memory.source = targetFlags[0].pos.findInRange(FIND_SOURCES, 2)[0].id;
    // demandingSource hasn't been changed lately, needs to be looked into further and tested
    // if (creep.memory.demandingSource){
    //   var demandedSource = creep.room.find(FIND_SOURCES, {filter:{id:creep.memory.demandingSource}})
    //   creep.memory.demandingSource = null;
    //   if (demandedSource.length > 0){
    //     var demandingCreeps = creep.room.find(FIND_MY_CREEPS, {filter:function(creep){
    //       return creep.memory.demandingSource == demandedSource[0].id
    //     }});
    //     if (demandingCreeps.length == 0){
    //       demandedSource[0].memory.carrierOnly = false;
    //     }
    //   }
    // }
    return true;
  }
  return false;
}

function deliverEnergy(creep, roles){
  //takes an array of roles that the creep is willing to give its energy to
  var targets = creep.pos.findInRange(FIND_MY_CREEPS, 1, {filter: function(target){
    return  roles.includes(target.memory.role) && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0 && creep.name != target.name
  }})
  if (targets.length > 0){
    //choose the one that has the least free capacity, so that it can get going
    targets.sort(function(a,b){
      return a.store.getFreeCapacity() - b.store.getFreeCapacity()
    })
    for (var i = 0; i < targets.length; i++){
      if(creep.transfer(targets[0], RESOURCE_ENERGY)==0){
        return true;
      }
    }
  }
  return false;
}
